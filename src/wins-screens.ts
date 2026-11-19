import '@fontsource-variable/grenze-gotisch/wght.css';
import '@fontsource/grenze/900.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';
import './ui/demo.css';
import { PICKABLE } from './animals/registry';
import { CPU_NAMES, SEAT_COLOURS } from './game/settings';
import { prewarmWolves } from './render/scene';
import { WINNER_SCENES, randomWinnerScene, type Contender, type WinnerSceneId } from './render/winner-scene';
import { playWinnerCutscene } from './ui/winner-cutscene';
import { COLOUR_NAMES } from './ui/view';

/**
 * The win screens page: choose a cutscene, how many players there are, and each player's
 * name, animal and colour, then watch it. The same cutscenes play at the end of a real game.
 */

interface Seat {
  name: string;
  animal: string;
  colour: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const NAMES = ['Kat', ...CPU_NAMES];
const seatFor = (i: number): Seat => ({ name: NAMES[i] ?? `Player ${i + 1}`, animal: PICKABLE[i % PICKABLE.length]!.scoring.id, colour: SEAT_COLOURS[i % SEAT_COLOURS.length]! });

function boot(): void {
  const mount = document.querySelector<HTMLDivElement>('#app')!;
  const root = el('div', 'table wins-page');
  const live = el('p', 'sr-only', undefined, { role: 'status', 'aria-live': 'polite' });
  const panel = el('nav', 'demo block wins', undefined, { 'aria-labelledby': 'wins-title' });
  const stage = el('div', 'wins__stage', undefined, { 'aria-hidden': 'true' });
  stage.append(el('p', 'wins__hint', 'Pick the players and a scene, then press Play.'));
  root.append(stage, panel, live);
  mount.append(root);
  prewarmWolves();

  let seats: Seat[] = [0, 1, 2].map(seatFor);
  let winner = 0;
  let scene: WinnerSceneId | 'random' = 'random';
  let playing = false;

  const render = () => {
    const sceneSelect = el('select', 'lobby__input', undefined, { id: 'wins-scene' });
    for (const [id, name] of [['random', 'Random'], ...WINNER_SCENES.map((s) => [s.id, s.name])] as const) {
      const o = el('option', '', name, { value: id });
      o.selected = id === scene;
      sceneSelect.append(o);
    }
    sceneSelect.addEventListener('change', () => (scene = sceneSelect.value as WinnerSceneId | 'random'));

    const countSelect = el('select', 'lobby__input', undefined, { id: 'wins-count' });
    for (let n = 2; n <= 6; n++) {
      const o = el('option', '', `${n} players`, { value: String(n) });
      o.selected = n === seats.length;
      countSelect.append(o);
    }
    countSelect.addEventListener('change', () => {
      const n = Number(countSelect.value);
      seats = Array.from({ length: n }, (_, i) => seats[i] ?? seatFor(i));
      winner = Math.min(winner, n - 1);
      render();
    });

    const list = el('ol', 'wins__seats');
    seats.forEach((s, i) => {
      const name = el('input', 'lobby__input wins__name', undefined, { 'aria-label': `Player ${i + 1} name`, maxlength: '16', value: s.name });
      name.addEventListener('input', () => (s.name = name.value));
      const animal = el('select', 'lobby__input', undefined, { 'aria-label': `Player ${i + 1} animal` });
      for (const a of PICKABLE) {
        const o = el('option', '', a.scoring.name, { value: a.scoring.id });
        o.selected = a.scoring.id === s.animal;
        animal.append(o);
      }
      animal.addEventListener('change', () => (s.animal = animal.value));
      const colour = el('select', 'lobby__input', undefined, { 'aria-label': `Player ${i + 1} colour` });
      for (const c of SEAT_COLOURS) {
        const o = el('option', '', COLOUR_NAMES[c] ?? c, { value: c });
        o.selected = c === s.colour;
        colour.append(o);
      }
      const dot = el('span', 'lobby__dot', undefined, { style: `background:${s.colour}`, 'aria-hidden': 'true' });
      colour.addEventListener('change', () => {
        s.colour = colour.value;
        dot.style.background = s.colour;
      });
      const wins = el('input', '', undefined, { type: 'radio', name: 'wins-winner', 'aria-label': `Player ${i + 1} wins` });
      wins.checked = i === winner;
      wins.addEventListener('change', () => (winner = i));
      const row = el('li', 'wins__seat');
      row.append(
        el('div', 'wins__line', undefined),
        el('label', 'wins__won', undefined),
      );
      row.children[0]!.append(dot, name);
      (row.children[1] as HTMLElement).append(wins, el('span', '', 'Winner'));
      row.append(el('div', 'wins__line', undefined));
      row.children[2]!.append(animal, colour);
      list.append(row);
    });

    const play = el('button', 'tab tab--roll wins__play', 'Play', { type: 'button' });
    play.disabled = playing;
    play.addEventListener('click', () => void run());

    panel.replaceChildren(
      el('h1', 'demo__title', 'Win screens', { id: 'wins-title' }),
      el('p', 'demo__lede', 'Every cutscene that can end a game. Choose who plays, who wins and how.'),
      el('label', 'lobby__field', undefined),
      el('label', 'lobby__field', undefined),
      el('h2', 'demo__group', 'The pack'),
      list,
      play,
      el('a', 'demo__back', 'Back to the game', { href: `${import.meta.env.BASE_URL}` }),
    );
    (panel.children[2] as HTMLElement).append(el('span', '', 'Scene'), sceneSelect);
    (panel.children[3] as HTMLElement).append(el('span', '', 'Players'), countSelect);
  };

  const run = async () => {
    if (playing) return;
    playing = true;
    render();
    const cast: Contender[] = seats.map((s, i) => ({ name: s.name.trim() || `Player ${i + 1}`, colour: s.colour, animal: s.animal }));
    const id = scene === 'random' ? randomWinnerScene() : scene;
    await playWinnerCutscene(root, cast[winner]!, cast.filter((_, i) => i !== winner), (t) => (live.textContent = t), id);
    playing = false;
    render();
  };

  render();
  document.documentElement.dataset.ready = 'true';
}

boot();
