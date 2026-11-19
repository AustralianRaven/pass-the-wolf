import '@fontsource-variable/grenze-gotisch/wght.css';
import '@fontsource/grenze/900.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';
import './ui/demo.css';
import { getAnimal } from './animals/registry';
import { DEMO_RESULTS, demoThrow, resultKey, stageAlpha } from './demo/results';
import seeds from './demo/demo-seeds.json';
import { DiceWorld, MAX_STEPS, TIMESTEP, loadRapier } from './physics/dice-world';
import { TableScene, prewarmWolves } from './render/scene';
import { scoreRoll } from './rules/scoring';
import { CUTSCENE_POINTS } from './game/controller';
import { playCutscene } from './ui/cutscene';
import { SEAT_COLOURS } from './game/settings';
import { loadFloppy } from './game/motion';

/**
 * The demo page: pick a result and watch a real Auto-roll throw that lands on it. Each button
 * replays a seed the finder (tools/find-demo-seeds.ts) recorded, so every demo is genuine physics.
 */
const SEEDS = seeds as Record<string, number>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

async function boot(): Promise<void> {
  const mount = document.querySelector<HTMLDivElement>('#app')!;
  const canvas = el('canvas', 'scene', undefined, { 'aria-label': 'The dice tray' });
  const live = el('p', 'sr-only', undefined, { role: 'status', 'aria-live': 'polite' });
  const result = el('p', 'result demo__result', undefined, { 'aria-hidden': 'true' });
  const label = el('span', 'result__label');
  const points = el('span', 'result__points');
  result.append(label, points);

  const panel = el('nav', 'demo block', undefined, { 'aria-labelledby': 'demo-title' });
  panel.append(
    el('h1', 'demo__title', 'Demo', { id: 'demo-title' }),
    el('p', 'demo__lede', 'Pick a result. A real throw that lands on it plays out, with the cutscene when it earns one.'),
  );
  const buttons: HTMLButtonElement[] = [];
  for (const group of ['Singles', 'Doubles', 'Specials'] as const) {
    const list = el('ul', 'demo__list');
    for (const r of DEMO_RESULTS.filter((x) => x.group === group)) {
      const b = el('button', 'demo__pick', r.label, { type: 'button' });
      b.dataset.key = r.key;
      if (r.key !== 'alpha' && SEEDS[r.key] === undefined) {
        b.disabled = true;
        b.title = 'No recorded throw for this result yet';
      }
      buttons.push(b);
      const li = el('li', '');
      li.append(b);
      list.append(li);
    }
    panel.append(el('h2', 'demo__group', group), list);
  }
  panel.append(el('a', 'demo__back', 'Back to the game', { href: `${import.meta.env.BASE_URL}` }));

  const root = el('div', 'table demo-page');
  root.append(canvas, panel, result, live);
  mount.append(root);

  const scene = new TableScene(canvas);
  scene.setWobble(loadFloppy());
  prewarmWolves();
  const R = await loadRapier();
  const wolf = getAnimal('winter');
  const collar = SEAT_COLOURS[0];
  let world: DiceWorld | null = null;
  let busy = false;
  let acc = 0;
  let last = 0;
  let onRest: (() => void) | null = null;

  const reset = () => {
    world?.free();
    world = new DiceWorld(R, [wolf, wolf]);
    scene.setDice([wolf, wolf], collar);
    world.place(0, [-0.9, 0.02, 2.6], { x: 0, y: 0.38, z: 0, w: 0.925 });
    world.place(1, [0.9, 0.02, 2.6], { x: 0, y: -0.38, z: 0, w: 0.925 });
    world.settle(240);
    scene.sync(world);
  };
  reset();

  const frame = (now: number) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (busy && world && onRest) {
      acc += dt;
      let rested = false;
      while (acc >= TIMESTEP && !rested) {
        rested = world.step() || world.steps >= MAX_STEPS;
        acc -= TIMESTEP;
      }
      scene.sync(world);
      if (rested) {
        const done = onRest;
        onRest = null;
        done();
      }
    }
    scene.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => scene.resize());

  const play = (key: string) => {
    const seed = SEEDS[key];
    const staged = key === 'alpha';
    if (busy || (!staged && seed === undefined)) return;
    busy = true;
    for (const b of buttons) b.classList.toggle('is-current', b.dataset.key === key);
    result.classList.remove('is-shown');
    reset();
    if (staged) stageAlpha(world!);
    else world!.throwDice(demoThrow(seed!));
    acc = 0;
    onRest = () => {
      const settled = world!.read();
      const roll = scoreRoll({
        dice: [
          { animal: wolf.scoring, pose: settled.poses[0] },
          { animal: wolf.scoring, pose: settled.poses[1] },
        ],
        touching: settled.touching,
        stacked: settled.stacked,
      });
      label.textContent = roll.label;
      points.textContent = roll.winsGame ? 'Instant win' : roll.kind === 'tangled' ? 'Bank wiped' : roll.bust ? 'Turn lost' : `+${roll.points}`;
      result.classList.add('is-shown');
      result.classList.toggle('is-bust', roll.bust);
      result.classList.toggle('is-big', !roll.bust && roll.points >= CUTSCENE_POINTS);
      const note = staged ? ' (Staged: one wolf dropped onto the other. A real throw almost never does this.)' : resultKey(settled) === key ? '' : ' (The physics changed since this throw was recorded.)';
      live.textContent = `${roll.label}. ${points.textContent}.${note}`;
      const big = (!roll.bust && roll.points >= CUTSCENE_POINTS) || roll.kind === 'alpha' || roll.kind === 'tangled';
      if (!big) {
        busy = false;
        return;
      }
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scene.focusOn(scene.diceCentre(), still ? 1 : 900);
      void playCutscene(root, roll, 2600, (t) => (live.textContent = t)).then(() => {
        scene.focusOn(null, still ? 1 : 700);
        busy = false;
      });
    };
  };
  for (const b of buttons) b.addEventListener('click', () => play(b.dataset.key!));
  document.documentElement.dataset.ready = 'true';
}

void boot();
