import '@fontsource-variable/grenze-gotisch/wght.css';
import '@fontsource/grenze/900.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';
import { GameController } from './game/controller';
import { loadDebugSettings, readDebugFlags, saveDebugSettings } from './game/debug';
import { loadSetup } from './game/settings';
import { loadRapier } from './physics/dice-world';
import { prewarmWolves, TableScene } from './render/scene';
import { GameView } from './ui/view';

async function boot(): Promise<void> {
  const mount = document.querySelector<HTMLDivElement>('#app');
  if (!mount) throw new Error('Missing #app root');

  let controller: GameController | null = null;
  let scene: TableScene | null = null;
  const debug = loadDebugSettings();
  const view = new GameView(mount, {
    onDebugChange: (s) => {
      saveDebugSettings(s);
      scene?.setShowHitboxes(s.enabled && s.showHitboxes);
    },
    onStart: (setup) => controller?.start(setup),
    onRoll: () => controller?.rollButton(),
    onBank: () => controller?.bank(),
    onTakeTurn: () => controller?.takeTurn(),
    onNewGame: () => controller?.newTable(),
    onRematch: () => controller?.rematch(),
  });
  view.setDebugSettings(debug);
  view.showSetup(loadSetup());

  scene = new TableScene(view.canvas);
  scene.setShowHitboxes(debug.enabled && debug.showHitboxes);
  const R = await loadRapier();
  controller = new GameController(R, scene, view, readDebugFlags());
  document.documentElement.dataset.ready = 'true';
  prewarmWolves();
}

boot().catch((err: unknown) => {
  console.error(err);
  const mount = document.querySelector('#app');
  if (mount) {
    const p = document.createElement('p');
    p.className = 'boot-error';
    p.textContent = 'The table failed to load. This game needs WebGL and WebAssembly; try a current Chrome, Edge or Firefox.';
    mount.replaceChildren(p);
  }
});
