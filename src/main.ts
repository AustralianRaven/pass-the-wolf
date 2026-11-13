import '@fontsource/alfa-slab-one/400.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';
import { GameController } from './game/controller';
import { readDebugFlags } from './game/debug';
import { loadSetup } from './game/settings';
import { loadRapier } from './physics/dice-world';
import { prewarmDirewolves, TableScene } from './render/scene';
import { GameView } from './ui/view';

async function boot(): Promise<void> {
  const mount = document.querySelector<HTMLDivElement>('#app');
  if (!mount) throw new Error('Missing #app root');

  let controller: GameController | null = null;
  const view = new GameView(mount, {
    onStart: (setup) => controller?.start(setup),
    onRoll: () => controller?.rollButton(),
    onBank: () => controller?.bank(),
    onTakeTurn: () => controller?.takeTurn(),
    onNewGame: () => controller?.newTable(),
    onRematch: () => controller?.rematch(),
  });
  view.showSetup(loadSetup());

  const scene = new TableScene(view.canvas);
  const R = await loadRapier();
  controller = new GameController(R, scene, view, readDebugFlags());
  document.documentElement.dataset.ready = 'true';
  prewarmDirewolves();
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
