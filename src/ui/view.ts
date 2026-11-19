import type { GameState, TurnRecord } from '../rules/game';
import { buildScoreCard } from '../rules/scorecard';
import type { RollResult } from '../rules/scoring';
import { SEAT_COLOURS, TARGET_CHOICES, cpuDice, type Setup } from '../game/settings';
import { DEFAULT_DIE, PICKABLE, getAnimal, isPickable } from '../animals/registry';
import { designFor } from '../animals/designs';
import { DEN_POINTS, DOUBLE_MULTIPLIER, MAX_SEATS, MIN_SEATS } from '../rules/constants';
import { SCORING_POSES } from '../rules/poses';
import type { DebugSettings } from '../game/debug';
import { renderPortrait, type PortraitScene } from '../render/portrait';
import { playCutscene } from './cutscene';
import { playWinnerCutscene } from './winner-cutscene';
import type { Contender } from '../render/winner-scene';

/** Tiny element helper: text always goes through textContent, so names can't inject markup. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string> } = {},
  children: (Node | null)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

/** "Your turn" for a seat called You, otherwise "Kat's turn". */
export function turnLine(name: string): string {
  return name.trim().toLowerCase() === 'you' ? 'Your turn' : `${name}'s turn`;
}
export function winsLine(name: string): string {
  return name.trim().toLowerCase() === 'you' ? 'You win!' : `${name} wins!`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Names for the seat colours, used in labels and for screen readers. */
export const COLOUR_NAMES: Record<string, string> = {
  '#a58bd6': 'Lilac',
  '#e07a3a': 'Ember',
  '#5b9bd5': 'Glacier',
  '#6fae6a': 'Pine',
  '#e3b341': 'Gold',
  '#efe7da': 'Snow',
};

/** The animals a player can choose: every carved animal, then one card for what's next. */
interface WolfChoice {
  id: string;
  name: string;
  blurb: string;
  available: boolean;
}
const WOLF_CHOICES: readonly WolfChoice[] = [
  ...PICKABLE.map((a) => ({ id: a.scoring.id, name: a.scoring.name, blurb: designFor(a.scoring.id)?.blurb ?? a.pitch ?? '', available: true })),
  { id: 'soon', name: 'Coming soon', blurb: 'More animals are being carved.', available: false },
];
/** A fresh human seat throws a pair of the default animal (the winter wolf). */
const WINTER_DICE: [string, string] = [DEFAULT_DIE, DEFAULT_DIE];
/** The name of the animal a seat throws. */
const animalName = (id: string) => (isPickable(id) ? getAnimal(id).scoring.name : 'Winter Wolf');

/** A carved block of fixed digit places; a new value swaps the block, it never fades. */
function setDigits(node: HTMLElement, value: number, places = 3): void {
  const text = String(value).padStart(places, ' ');
  if (node.dataset.value === text) return;
  node.dataset.value = text;
  node.setAttribute('aria-label', String(value));
  node.replaceChildren(
    ...[...text].map((ch) => el('span', { class: `digit${ch === ' ' ? ' is-blank' : ''}`, text: ch === ' ' ? '' : ch, attrs: { 'aria-hidden': 'true' } })),
  );
  node.classList.remove('is-swapped');
  void node.offsetWidth;
  node.classList.add('is-swapped');
}

/** Wolf head mark used on the trail and in the den: drawn once, coloured per seat. */
const WOLF_HEAD = 'M0 13 L-2.6 9.5 L-5 10.5 L-6.5 7 L-10 7.5 L-10.5 3.5 L-13 1.5 L-10.5 -1.5 L-9.5 -13 L-5 -6 L0 -7 L5 -6 L9.5 -13 L10.5 -1.5 L13 1.5 L10.5 3.5 L10 7.5 L6.5 7 L5 10.5 L2.6 9.5 Z';
/** Eyes and muzzle cut out of the head, so the mark reads as a wolf and not a crown. */
const WOLF_CUTS = 'M-6 -2 L-2.2 -0.4 L-5.6 0.6 Z M6 -2 L2.2 -0.4 L5.6 0.6 Z M-2 7.6 L2 7.6 L0 10.6 Z M-7.5 -9 L-6.8 -4.5 L-5.6 -6.2 Z M7.5 -9 L6.8 -4.5 L5.6 -6.2 Z M-1 1 L0 6 L1 1 Z';
/** One paw print facing right: a heel pad and three toes, as path data. */
function pawPrint(x: number, y: number): string {
  const dot = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
  return [dot(x, y, 2.1), dot(x + 3.2, y - 2.4, 0.95), dot(x + 3.9, y, 0.95), dot(x + 3.2, y + 2.4, 0.95)].join(' ');
}

/** A walking wolf in profile, facing the cave; feet on y = 0. */
const WOLF_WALK = 'M-21 -9 L-17 -12 L-12 -12 L-6 -13 L4 -13 L8 -16 L10 -22 L12 -18 L14 -21 L15 -16 L20 -14 L22 -11 L16 -10 L12 -8 L11 -3 L12 0 L9 0 L8 -5 L4 -7 L-3 -7 L-6 -3 L-5 0 L-8 0 L-9 -4 L-11 -7 L-12 -2 L-11 0 L-14 0 L-15 -6 L-16 -9 Z';

export interface ViewHandlers {
  onStart(setup: Setup): void;
  onRoll(): void;
  onBank(): void;
  onTakeTurn(): void;
  onNewGame(): void;
  /** Open the "Play with friends" lobby (#2). */
  onOnline(): void;
  onRematch(): void;
  onDebugChange(settings: DebugSettings): void;
  onFloppyChange(on: boolean): void;
}

/** All DOM for the game: setup block, wolf den, HUD, trail strip, score sheet and handover band. */
export class GameView {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly setupSheet: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly plateName: HTMLElement;
  private readonly plateBanked: HTMLElement;
  private readonly platePot: HTMLElement;
  private readonly plateRound: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultLabel: HTMLElement;
  private readonly resultPoints: HTMLElement;
  private readonly live: HTMLElement;
  private readonly rollButton: HTMLButtonElement;
  private readonly bankButton: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly board: SVGSVGElement;
  private readonly handover: HTMLElement;
  private readonly handoverName: HTMLElement;
  private readonly handoverSummary: HTMLElement;
  private readonly handoverButton: HTMLButtonElement;
  private readonly handoverExtra: HTMLElement;
  private readonly scoreDialog: HTMLDialogElement;
  private readonly scoreTable: HTMLElement;
  private readonly den: HTMLDialogElement;
  private readonly denTrack: HTMLElement;
  private readonly denTitle: HTMLElement;
  private denSeat = 0;
  private denIndex = 0;
  private setup!: Setup;
  private seatColours: string[] = [];
  private readonly settingsDialog: HTMLDialogElement;
  private debug: DebugSettings = { enabled: false, showHitboxes: false };

  constructor(
    mount: HTMLElement,
    private readonly handlers: ViewHandlers,
  ) {
    this.canvas = el('canvas', { class: 'scene', attrs: { 'aria-label': 'The dice tray: drag on the felt to throw the wolves' } });

    this.plateName = el('h2', { class: 'plate__name' });
    this.plateRound = el('p', { class: 'plate__round' });
    this.plateBanked = el('span', { class: 'digits' });
    this.platePot = el('span', { class: 'digits digits--pot' });
    const plate = el('section', { class: 'plate block', attrs: { 'aria-label': 'Current player' } }, [
      this.plateName,
      this.plateRound,
      el('dl', { class: 'plate__stats' }, [
        el('div', {}, [el('dt', { text: 'Banked' }), el('dd', {}, [this.plateBanked])]),
        el('div', { class: 'plate__pot' }, [el('dt', { text: 'This turn' }), el('dd', {}, [this.platePot])]),
      ]),
    ]);

    const scoreButton = el('button', { class: 'tab tab--quiet', text: 'Score sheet', attrs: { type: 'button', 'aria-keyshortcuts': 'S' } });
    scoreButton.addEventListener('click', () => this.toggleScoreCard());
    const menuButton = el('button', { class: 'tab tab--quiet', text: 'New game', attrs: { type: 'button' } });
    menuButton.addEventListener('click', () => this.handlers.onNewGame());
    const corner = el('nav', { class: 'corner', attrs: { 'aria-label': 'Game' } }, [scoreButton, menuButton]);

    this.resultLabel = el('span', { class: 'result__label' });
    this.resultPoints = el('span', { class: 'result__points' });
    this.result = el('p', { class: 'result', attrs: { 'aria-hidden': 'true' } }, [this.resultLabel, this.resultPoints]);
    this.live = el('p', { class: 'sr-only', attrs: { 'aria-live': 'polite', role: 'status' } });

    this.rollButton = el('button', { class: 'tab tab--roll', text: 'Auto-roll', attrs: { type: 'button', 'aria-keyshortcuts': 'Space' } });
    this.bankButton = el('button', { class: 'tab tab--bank', text: 'Bank', attrs: { type: 'button', 'aria-keyshortcuts': 'B' } });
    this.rollButton.addEventListener('click', () => this.handlers.onRoll());
    this.bankButton.addEventListener('click', () => this.handlers.onBank());
    this.hint = el('p', { class: 'hint' });
    const actions = el('div', { class: 'actions' }, [this.rollButton, this.bankButton]);
    const console_ = el('div', { class: 'console' }, [this.result, actions, this.hint]);

    this.board = svg('svg', { class: 'trail__svg', role: 'img' });
    const trail = el('footer', { class: 'trail' }, [this.board]);
    new ResizeObserver(() => this.root.style.setProperty('--trail-h', `${trail.offsetHeight}px`)).observe(trail);

    this.hud = el('div', { class: 'hud', attrs: { hidden: '' } }, [plate, corner, console_, trail, this.live]);

    this.handoverName = el('h2', { class: 'handover__name' });
    this.handoverSummary = el('p', { class: 'handover__summary' });
    this.handoverButton = el('button', { class: 'tab tab--roll', attrs: { type: 'button' } });
    this.handoverButton.addEventListener('click', () => this.handlers.onTakeTurn());
    this.handoverExtra = el('div', { class: 'handover__extra' });
    this.handover = el(
      'section',
      { class: 'handover', attrs: { hidden: '', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'handover-name' } },
      [el('div', { class: 'handover__band' }, [this.handoverSummary, this.handoverName, this.handoverButton, this.handoverExtra])],
    );
    this.handoverName.id = 'handover-name';

    this.scoreTable = el('div', { class: 'sheet__body' });
    const closeScore = el('button', { class: 'tab tab--quiet', text: 'Close', attrs: { type: 'button' } });
    closeScore.addEventListener('click', () => this.scoreDialog.close());
    this.scoreDialog = el('dialog', { class: 'sheet scorecard block', attrs: { 'aria-labelledby': 'scorecard-title' } }, [
      el('header', { class: 'sheet__head' }, [el('h2', { text: 'Score sheet', attrs: { id: 'scorecard-title' } }), closeScore]),
      this.scoreTable,
    ]);
    this.scoreDialog.addEventListener('click', (e) => {
      if (e.target === this.scoreDialog) this.scoreDialog.close();
    });

    this.denTitle = el('h2', { attrs: { id: 'den-title' } });
    this.denTrack = el('ol', { class: 'den__track', attrs: { 'aria-label': 'Wolves' } });
    this.den = this.buildDen();

    this.setupSheet = el('section', { class: 'setup', attrs: { 'aria-labelledby': 'setup-title' } });

    const moon = svg('svg', { class: 'moon', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    moon.append(
      svg('path', { class: 'moon__disc', d: 'M96 18 A82 82 0 1 1 96 182 A62 82 0 1 0 96 18 Z' }),
      svg('path', { class: 'moon__gouge', d: 'M128 62 q14 6 22 18 M138 104 q12 2 20 -4 M124 146 q16 -2 26 -12' }),
      svg('path', { class: 'moon__star', d: 'M40 70 L44 80 L54 84 L44 88 L40 98 L36 88 L26 84 L36 80 Z M70 140 L72 146 L78 148 L72 150 L70 156 L68 150 L62 148 L68 146 Z' }),
    );
    this.settingsDialog = this.buildSettings();
    const gear = el('button', { class: 'gear', attrs: { type: 'button', 'aria-label': 'Settings' } }, [this.gearIcon()]);
    gear.addEventListener('click', () => this.openSettings());

    this.root = el('div', { class: 'table' }, [this.canvas, moon, this.hud, this.handover, this.setupSheet, gear, this.scoreDialog, this.den, this.settingsDialog]);
    mount.append(this.root);
  }

  // ---------- Settings ----------

  private gearIcon(): SVGSVGElement {
    const icon = svg('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true' });
    icon.append(
      svg('circle', { cx: 12, cy: 12, r: 3.2 }),
      svg('path', { d: 'M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1' }),
      svg('circle', { cx: 12, cy: 12, r: 6.4 }),
    );
    return icon;
  }

  private buildSettings(): HTMLDialogElement {
    const close = el('button', { class: 'tab tab--quiet', text: 'Close', attrs: { type: 'button' } });
    const body = el('div', { class: 'settings__body' });
    const dialog = el('dialog', { class: 'sheet settings block', attrs: { 'aria-labelledby': 'settings-title' } }, [
      el('header', { class: 'sheet__head' }, [el('h2', { text: 'Settings', attrs: { id: 'settings-title' } }), close]),
      body,
    ]);
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    return dialog;
  }

  /** Set the stored debug options before the first render. */
  private floppy = true;

  setFloppy(on: boolean): void {
    this.floppy = on;
  }

  setDebugSettings(s: DebugSettings): void {
    this.debug = s;
  }

  private renderSettings: () => void = () => {};

  private openSettings(): void {
    const body = this.settingsDialog.querySelector('.settings__body')!;
    const toggle = (label: string, hint: string, checked: boolean, disabled: boolean, onChange: (on: boolean) => void) => {
      const input = el('input', { attrs: { type: 'checkbox' } });
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener('change', () => onChange(input.checked));
      return el('label', { class: `toggle${disabled ? ' is-disabled' : ''}` }, [input, el('span', { class: 'toggle__label', text: label }), el('span', { class: 'toggle__hint', text: hint })]);
    };
    this.renderSettings = () => {
      body.replaceChildren(
        el('fieldset', { class: 'settings__group' }, [
          el('legend', { class: 'sheet__h', text: 'Motion' }),
          toggle('Floppy wolves', 'Tails, ears and legs flop about as the wolves tumble. Looks only: the odds never change.', this.floppy, false, (on) => {
            this.floppy = on;
            this.handlers.onFloppyChange(on);
            this.renderSettings();
          }),
        ]),
        el('fieldset', { class: 'settings__group' }, [
          el('legend', { class: 'sheet__h', text: 'Debug' }),
          toggle('Debug mode', 'Unlocks the tools below.', this.debug.enabled, false, (on) => this.changeDebug({ ...this.debug, enabled: on })),
          el('div', { class: 'settings__sub' }, [
            toggle('Show hitboxes', 'Draw the real physics shapes the wolves roll on. Gold parts are the hidden pig belly and pads.', this.debug.enabled && this.debug.showHitboxes, !this.debug.enabled, (on) => this.changeDebug({ ...this.debug, showHitboxes: on })),
          ]),
        ]),
      );
    };
    this.renderSettings();
    this.settingsDialog.showModal();
  }

  private changeDebug(s: DebugSettings): void {
    this.debug = s;
    this.handlers.onDebugChange(s);
    this.renderSettings();
  }

  // ---------- Setup ----------

  /** The setup as it stands, for the lobby's defaults. */
  get currentSetup(): Setup {
    return this.setup;
  }

  showSetup(setup: Setup): void {
    this.setup = structuredClone(setup);
    for (const seat of this.setup.seats) if (seat.kind === 'human' && !isPickable(seat.dice[0])) seat.dice = [...WINTER_DICE];
    this.hud.hidden = true;
    this.handover.hidden = true;
    this.setupSheet.hidden = false;
    this.renderSetup();
  }

  hideSetup(): void {
    this.setupSheet.hidden = true;
    this.hud.hidden = false;
  }

  private renderSetup(): void {
    const s = this.setup;
    const form = el('form', { class: 'setup__block block' });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlers.onStart(structuredClone(this.setup));
    });

    const title = el('h1', { class: 'wordmark', attrs: { id: 'setup-title' } }, [
      el('span', { class: 'wordmark__small', text: 'Pass the' }),
      el('span', { class: 'wordmark__big', text: 'Wolf' }),
    ]);
    const lede = el('p', { class: 'setup__lede', text: 'Throw two wolves into the tray. Score by how they land. Roll again, or bank it before the pack scatters.' });

    const modeGroup = el('fieldset', { class: 'setup__modes' }, [el('legend', { class: 'sr-only', text: 'Who is playing?' })]);
    for (const [mode, label, detail] of [
      ['solo', 'Solo', 'You against the computer'],
      ['table', 'Table', '2 to 6 players, pass the mouse'],
    ] as const) {
      const input = el('input', { attrs: { type: 'radio', name: 'mode', value: mode } });
      input.checked = s.mode === mode;
      input.addEventListener('change', () => this.setMode(mode));
      modeGroup.append(el('label', { class: 'mode' }, [input, el('span', { class: 'mode__label', text: label }), el('span', { class: 'mode__detail', text: detail })]));
    }

    const seatList = el('ol', { class: 'seats' });
    s.seats.forEach((seat, i) => {
      const name = el('input', {
        class: 'seat__name',
        attrs: { type: 'text', maxlength: '18', autocomplete: 'off', 'aria-label': `Seat ${i + 1} name`, value: seat.name },
      });
      name.addEventListener('input', () => {
        seat.name = name.value;
      });

      const swatches = el('div', { class: 'swatches', attrs: { role: 'radiogroup', 'aria-label': `Seat ${i + 1} collar colour` } });
      const taken = new Set(s.seats.filter((_, j) => j !== i).map((x) => x.colour));
      for (const colour of SEAT_COLOURS) {
        const input = el('input', {
          class: 'swatch',
          attrs: { type: 'radio', name: `colour-${i}`, value: colour, 'aria-label': COLOUR_NAMES[colour] ?? colour },
        });
        input.style.setProperty('--swatch', colour);
        input.checked = seat.colour === colour;
        input.disabled = taken.has(colour);
        input.addEventListener('change', () => {
          seat.colour = colour;
          this.renderSetup();
          this.focusSwatch(i, colour);
        });
        swatches.append(input);
      }

      const wolf = el('button', {
        class: 'seat__wolf',
        attrs: { type: 'button', 'aria-label': `Seat ${i + 1} animal: ${animalName(seat.dice[0])}. Choose animal.` },
      }, [this.wolfMark(seat.colour), el('span', { text: seat.kind === 'cpu' ? 'Computer wolf' : animalName(seat.dice[0]) })]);
      wolf.disabled = seat.kind === 'cpu';
      wolf.addEventListener('click', () => this.openDen(i));

      const kind = el('button', {
        class: `seat__kind${seat.kind === 'cpu' ? ' is-cpu' : ''}`,
        text: seat.kind === 'cpu' ? 'Computer' : 'Human',
        attrs: { type: 'button', 'aria-label': `Seat ${i + 1}: ${seat.kind === 'cpu' ? 'computer' : 'human'} player. Switch.` },
      });
      kind.disabled = s.mode === 'solo';
      kind.addEventListener('click', () => {
        seat.kind = seat.kind === 'cpu' ? 'human' : 'cpu';
        seat.dice = seat.kind === 'cpu' ? cpuDice(i - 1) : [...WINTER_DICE];
        this.renderSetup();
      });

      const remove = el('button', { class: 'seat__remove', text: 'Remove', attrs: { type: 'button', 'aria-label': `Remove seat ${i + 1}` } });
      remove.disabled = s.seats.length <= (s.mode === 'solo' ? 2 : MIN_SEATS) || (s.mode === 'solo' && i === 0);
      remove.addEventListener('click', () => {
        s.seats.splice(i, 1);
        this.renderSetup();
      });

      const li = el('li', { class: 'seat' }, [name, wolf, kind, remove, swatches]);
      li.style.setProperty('--seat', seat.colour);
      seatList.append(li);
    });

    const add = el('button', { class: 'tab tab--quiet', text: s.mode === 'solo' ? 'Add a computer wolf' : 'Add a seat', attrs: { type: 'button' } });
    add.disabled = s.seats.length >= MAX_SEATS;
    add.addEventListener('click', () => {
      const used = new Set(s.seats.map((x) => x.colour));
      const colour = SEAT_COLOURS.find((c) => !used.has(c)) ?? SEAT_COLOURS[0];
      const n = s.seats.length;
      s.seats.push(
        s.mode === 'solo'
          ? { name: ['Ember', 'Birch', 'Sleet', 'Juniper', 'Flint'][n - 1] ?? 'Wolf', kind: 'cpu', colour, dice: cpuDice(n - 1) }
          : { name: `Player ${n + 1}`, kind: 'human', colour, dice: [...WINTER_DICE] },
      );
      this.renderSetup();
    });

    const target = el('select', { class: 'setup__target', attrs: { id: 'target' } });
    for (const t of TARGET_CHOICES) {
      const o = el('option', { text: `First to ${t}`, attrs: { value: String(t) } });
      o.selected = t === s.targetScore;
      target.append(o);
    }
    target.addEventListener('change', () => {
      s.targetScore = Number(target.value);
    });

    const start = el('button', { class: 'tab tab--roll setup__start', text: 'Deal the wolves', attrs: { type: 'submit' } });
    const online = el('button', { class: 'tab tab--quiet setup__online', text: 'Play with friends', attrs: { type: 'button' } });
    online.addEventListener('click', () => this.handlers.onOnline());

    form.append(
      el('header', { class: 'setup__head' }, [title, lede]),
      modeGroup,
      el('div', { class: 'setup__seats' }, [el('h2', { class: 'setup__h', text: 'The pack' }), seatList, add]),
      el('div', { class: 'setup__foot' }, [el('label', { class: 'setup__target-label', text: 'Race to the cave', attrs: { for: 'target' } }), target, start]),
      el('div', { class: 'setup__friends' }, [el('span', { class: 'setup__or', text: 'Not sharing one screen?' }), online]),
    );
    this.setupSheet.replaceChildren(form);
  }

  private focusSwatch(seat: number, colour: string): void {
    this.setupSheet.querySelector<HTMLInputElement>(`input[name="colour-${seat}"][value="${colour}"]`)?.focus();
  }

  /** Small carved wolf head in a seat's collar colour. */
  private wolfMark(colour: string): SVGSVGElement {
    const mark = svg('svg', { class: 'wolfmark', viewBox: '-14 -14 28 28', 'aria-hidden': 'true' });
    mark.append(svg('path', { d: WOLF_HEAD, class: 'wolfmark__head' }), svg('path', { d: WOLF_CUTS, class: 'wolfmark__cut' }), svg('path', { d: 'M-8.5 6 Q0 14 8.5 6', class: 'wolfmark__collar', stroke: colour }));
    return mark;
  }

  private setMode(mode: Setup['mode']): void {
    const s = this.setup;
    if (s.mode === mode) return;
    s.mode = mode;
    if (mode === 'solo') {
      s.seats = s.seats.map((seat, i) => ({ ...seat, kind: i === 0 ? 'human' : 'cpu', dice: i === 0 ? [...WINTER_DICE] : cpuDice(i - 1) }));
      if (s.seats.length < 2) s.seats.push({ name: 'Ember', kind: 'cpu', colour: SEAT_COLOURS[1], dice: cpuDice(0) });
    } else {
      s.seats = s.seats.map((seat, i) => ({ ...seat, kind: 'human', dice: [...WINTER_DICE], name: seat.kind === 'cpu' ? `Player ${i + 1}` : seat.name }));
    }
    this.renderSetup();
  }

  // ---------- The den: pick your wolf ----------

  private buildDen(): HTMLDialogElement {
    const prev = el('button', { class: 'den__arrow', attrs: { type: 'button', 'aria-label': 'Previous animal' } }, [this.arrow(-1)]);
    const next = el('button', { class: 'den__arrow', attrs: { type: 'button', 'aria-label': 'Next animal' } }, [this.arrow(1)]);
    prev.addEventListener('click', () => this.moveDen(-1));
    next.addEventListener('click', () => this.moveDen(1));
    const close = el('button', { class: 'tab tab--quiet', text: 'Close', attrs: { type: 'button' } });
    close.addEventListener('click', () => this.den.close());

    const viewport = el('div', { class: 'den__viewport' }, [this.denTrack]);
    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.moveDen(-1);
      else if (e.key === 'ArrowRight') this.moveDen(1);
      else return;
      e.preventDefault();
    });
    // Drag or swipe: the track scrolls natively with snap points; keep the index in step.
    viewport.addEventListener('scrollend', () => {
      // A scroll the arrows started already set the index. Near the ends a card cannot reach the
      // centre, so re-reading "nearest to centre" would bounce the last card back one.
      if (this.denScrolling) {
        this.denScrolling = false;
        return;
      }
      const mid = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      const cards = [...this.denTrack.children] as HTMLElement[];
      let best = this.denIndex;
      let bestDist = Infinity;
      cards.forEach((c, j) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestDist) [best, bestDist] = [j, d];
      });
      this.setDenIndex(best, false);
    });

    const dialog = el('dialog', { class: 'den block', attrs: { 'aria-labelledby': 'den-title' } }, [
      el('header', { class: 'sheet__head' }, [this.denTitle, close]),
      el('div', { class: 'den__stage' }, [prev, viewport, next]),
      el('p', { class: 'den__note', text: 'You throw a matching pair of whichever animal you pick. They all roll the same odds.' }),
    ]);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    return dialog;
  }

  private arrow(dir: -1 | 1): SVGSVGElement {
    const a = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'icon' });
    a.append(svg('path', { d: dir < 0 ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20' }));
    return a;
  }

  private openDen(seatIndex: number): void {
    this.denSeat = seatIndex;
    const seat = this.setup.seats[seatIndex]!;
    this.denTitle.textContent = `${seat.name.trim() || `Seat ${seatIndex + 1}`}: pick your animal`;
    this.denTrack.replaceChildren(
      ...WOLF_CHOICES.map((w, i) => {
        const card = el('li', { class: `wolfcard${w.available ? '' : ' is-locked'}`, attrs: { 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${WOLF_CHOICES.length}: ${w.name}` } });
        card.style.setProperty('--seat', seat.colour);
        const art = el('div', { class: 'wolfcard__art', attrs: { 'aria-hidden': 'true' } }, [this.wolfMark(w.available ? seat.colour : 'transparent')]);
        if (w.available) {
          const animal = getAnimal(w.id);
          void renderPortrait(animal, seat.colour, { kind: 'single', pose: 'upright' }).then((url) => {
            art.replaceChildren(el('img', { class: 'wolfcard__render', attrs: { src: url, alt: '' } }));
          });
        }
        const pick = el('button', { class: 'tab tab--roll wolfcard__pick', text: w.available ? 'Choose' : 'Locked', attrs: { type: 'button' } });
        pick.disabled = !w.available;
        pick.addEventListener('click', () => {
          seat.dice = [w.id, w.id];
          this.den.close();
          this.renderSetup();
        });
        card.append(art, el('h3', { class: 'wolfcard__name', text: w.name }), el('p', { class: 'wolfcard__blurb', text: w.blurb }), pick);
        return card;
      }),
    );
    this.den.showModal();
    this.setDenIndex(0, true);
  }

  private moveDen(dir: -1 | 1): void {
    this.setDenIndex(this.denIndex + dir, true);
  }

  /** The arrows (not a drag) started the current carousel scroll. */
  private denScrolling = false;

  private setDenIndex(i: number, scroll: boolean): void {
    const n = WOLF_CHOICES.length;
    this.denIndex = Math.max(0, Math.min(n - 1, i));
    const cards = [...this.denTrack.children] as HTMLElement[];
    cards.forEach((c, j) => c.classList.toggle('is-focus', j === this.denIndex));
    if (scroll) this.denScrolling = true;
    if (scroll) cards[this.denIndex]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    const arrows = this.den.querySelectorAll<HTMLButtonElement>('.den__arrow');
    arrows[0]!.disabled = this.denIndex === 0;
    arrows[1]!.disabled = this.denIndex === n - 1;
  }

  // ---------- Table HUD ----------

  setSeatColours(colours: string[]): void {
    this.seatColours = colours;
  }

  colourOf(seat: number): string {
    return this.seatColours[seat] ?? SEAT_COLOURS[0];
  }

  update(state: GameState, opts: { canRoll: boolean; canBank: boolean; busy: boolean; hint: string }): void {
    const seat = state.seats[state.currentSeat]!;
    this.root.style.setProperty('--active', this.colourOf(state.currentSeat));
    this.plateName.textContent = seat.name;
    this.plateRound.textContent = `Round ${state.round} · ${seat.kind === 'cpu' ? 'Computer' : 'Your throw'}`;
    setDigits(this.plateBanked, state.scores[state.currentSeat] ?? 0);
    setDigits(this.platePot, state.turnPot);
    this.rollButton.disabled = !opts.canRoll;
    this.rollButton.textContent = state.turnPot > 0 ? 'Reroll' : 'Auto-roll';
    this.bankButton.disabled = !opts.canBank;
    this.bankButton.textContent = opts.canBank ? `Bank ${state.turnPot}` : 'Bank';
    this.hint.textContent = opts.hint;
    this.root.classList.toggle('is-busy', opts.busy);
    this.drawTrail(state);
    if (this.scoreDialog.open) this.renderScoreCard(state);
  }

  showResult(roll: RollResult | null, who?: string): void {
    if (!roll) {
      this.result.classList.remove('is-shown', 'is-bust', 'is-big');
      return;
    }
    this.resultLabel.textContent = roll.label;
    this.resultPoints.textContent = roll.kind === 'tangled' ? 'Bank wiped' : roll.bust ? 'Turn lost' : `+${roll.points}`;
    this.result.classList.remove('is-shown');
    void this.result.offsetWidth; // re-ink the line
    this.result.classList.add('is-shown');
    this.result.classList.toggle('is-bust', roll.bust);
    this.result.classList.toggle('is-big', !roll.bust && roll.points >= 15);
    this.announce(`${who ? `${who}: ` : ''}${roll.label}. ${this.resultPoints.textContent}.`);
  }

  announce(text: string): void {
    this.live.textContent = text;
  }

  /**
   * The trail home, cut as a linocut frieze: pines and a snow line along the top, a hill on
   * the right with the cave mouth cut into it, and one paw-print route per seat. Each seat's
   * walking wolf stands at its banked score; a broken outline shows where banking now would
   * land it; every bank is cut into the route as a notch, so the climb shows as courses.
   */
  private drawTrail(state: GameState): void {
    const target = state.targetScore;
    const seats = state.seats.length;
    const labelW = 150;
    const trackW = 860;
    const hillW = 150;
    const top = 34;
    const laneH = 40;
    const width = labelW + trackW + hillW;
    const height = top + seats * laneH + 10;
    this.board.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.board.setAttribute('aria-label', `Race to ${target}: ` + state.seats.map((s, i) => `${s.name} ${state.scores[i]}`).join(', '));
    const xAt = (n: number) => labelW + 18 + (Math.min(n, target) / target) * (trackW - 18);
    const laneY = (i: number) => top + i * laneH + laneH - 16;

    const banks: number[][] = state.seats.map(() => []);
    for (const row of buildScoreCard(state)) {
      row.cells.forEach((cell, i) => {
        if (cell?.outcome === 'banked') banks[i]!.push((banks[i]!.at(-1) ?? 0) + cell.banked);
      });
    }

    const nodes: SVGElement[] = [];
    // Pines along the ridge, then the snow line they stand on. Fixed seed: the frieze never shifts.
    let seed = 7;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let x = labelW + 6; x < labelW + trackW - 10; x += 26 + rand() * 30) {
      const h = 14 + rand() * 14;
      const w = h * 0.5;
      const base = top - 4;
      nodes.push(
        svg('path', {
          class: 'frieze__pine',
          d: `M${x} ${base - h} L${x + w * 0.55} ${base - h * 0.55} L${x + w * 0.3} ${base - h * 0.55} L${x + w} ${base} L${x - w} ${base} L${x - w * 0.3} ${base - h * 0.55} L${x - w * 0.55} ${base - h * 0.55} Z`,
        }),
      );
    }
    const snow: string[] = [];
    for (let x = labelW; x <= labelW + trackW; x += 20) snow.push(`${snow.length ? 'L' : 'M'}${x} ${(top - 4 + Math.sin(x / 37) * 1.6).toFixed(1)}`);
    nodes.push(svg('path', { class: 'frieze__snow', d: snow.join(' ') }));

    // A rocky hillside rising to the right, snow on its shoulder, the cave mouth cut into its foot.
    const hx = labelW + trackW - 6;
    nodes.push(
      svg('path', {
        class: 'frieze__hill',
        d: `M${hx - 40} ${height} L${hx - 22} ${top + 10} L${hx - 4} ${top - 2} L${hx + 14} ${top - 14} L${hx + 34} ${top - 10} L${hx + 52} ${top - 26} L${hx + 74} ${top - 22} L${hx + 98} ${top - 32} L${hx + 120} ${top - 20} L${width} ${top - 26} L${width} ${height} Z`,
      }),
      svg('path', { class: 'frieze__snowcap', d: `M${hx - 4} ${top - 2} L${hx + 14} ${top - 14} L${hx + 34} ${top - 10} L${hx + 52} ${top - 26} L${hx + 74} ${top - 22} L${hx + 98} ${top - 32} L${hx + 120} ${top - 20} L${width} ${top - 26}` }),
      svg('path', { class: 'frieze__gouge', d: `M${hx + 6} ${top + 6} l14 -4 M${hx + 104} ${top - 6} l22 -3 M${hx + 118} ${top + 14} l18 2 M${hx + 2} ${top + 40} l10 -2` }),
    );
    const m = top + 8;
    nodes.push(
      svg('path', {
        class: 'frieze__mouth',
        d: `M${hx + 16} ${height} L${hx + 18} ${m + 34} L${hx + 24} ${m + 14} L${hx + 38} ${m + 2} L${hx + 54} ${m} L${hx + 70} ${m + 8} L${hx + 82} ${m + 26} L${hx + 88} ${height} Z`,
      }),
    );

    state.seats.forEach((seat, i) => {
      const y = laneY(i);
      const active = i === state.currentSeat && state.phase !== 'gameOver';
      const colour = this.colourOf(i);
      // Paw prints, alternating either side of the route, one every five points; tens cut larger.
      const paws: string[] = [];
      for (let n = 0; n < target; n += 5) paws.push(pawPrint(xAt(n) + 8, y - 3 + ((n / 5) % 2 === 0 ? -3 : 3)));
      nodes.push(svg('path', { d: paws.join(' '), class: `frieze__paw${active ? ' is-active' : ''}` }));
      if (active) {
        nodes.push(
          svg('line', { x1: xAt(0), x2: hx + 16, y1: y + 14, y2: y + 14, class: 'frieze__rule' }),
          svg('line', { x1: xAt(0), x2: hx + 16, y1: y + 17.5, y2: y + 17.5, class: 'frieze__rule' }),
        );
      }
      for (const b of banks[i]!) {
        nodes.push(svg('rect', { x: xAt(b) - 3, y: y + 2, width: 6, height: 10, class: 'frieze__course', fill: colour }));
      }
      const label = svg('text', { x: 12, y, class: `trail__name${active ? ' is-active' : ''}` });
      label.textContent = seat.name;
      nodes.push(label);
      const scoreText = svg('text', { x: labelW - 14, y, class: 'trail__score', 'text-anchor': 'end' });
      scoreText.textContent = String(state.scores[i]);
      nodes.push(scoreText);

      const score = state.scores[i] ?? 0;
      if (active && state.turnPot > 0) {
        nodes.push(svg('path', { d: WOLF_WALK, class: 'trail__ghost', stroke: colour, transform: `translate(${xAt(score + state.turnPot)} ${y})` }));
      }
      const g = svg('g', { class: 'trail__wolf', transform: `translate(${xAt(score)} ${y})` });
      g.append(svg('path', { d: WOLF_WALK, class: 'trail__body' }), svg('path', { d: 'M8 -15 L11 -8', class: 'trail__collar', stroke: colour }));
      nodes.push(g);
    });
    this.board.replaceChildren(...nodes);
  }

  // ---------- Cutscene ----------

  /** The big-roll cutscene (see src/ui/cutscene.ts). */
  playCutscene(roll: RollResult, ms: number): Promise<void> {
    return playCutscene(this.root, roll, ms, (t) => this.announce(t));
  }

  /** The storm, the cave and the tornado (#5), before the final score band. */
  playWinnerCutscene(winner: Contender, losers: readonly Contender[]): Promise<void> {
    return playWinnerCutscene(this.root, winner, losers, (t) => this.announce(t));
  }

  // ---------- Handover ----------

  showHandover(
    state: GameState,
    opts: { nextSeat: number; summary: string; buttonText: string; gameOver?: boolean; locked?: boolean },
  ): void {
    const next = state.seats[opts.nextSeat]!;
    this.root.style.setProperty('--handover', this.colourOf(opts.nextSeat));
    this.handoverSummary.textContent = opts.summary;
    this.handoverName.textContent = opts.gameOver ? winsLine(next.name) : turnLine(next.name);
    this.handoverButton.textContent = opts.buttonText;
    // Online, only the player whose turn it is can take the wolves.
    this.handoverButton.disabled = !!opts.locked;
    this.handoverExtra.replaceChildren();
    if (opts.gameOver) {
      const again = el('button', { class: 'tab tab--quiet', text: 'New game', attrs: { type: 'button' } });
      again.addEventListener('click', () => this.handlers.onNewGame());
      this.handoverExtra.append(this.buildScoreTable(state), again);
    }
    this.handover.classList.toggle('is-over', !!opts.gameOver);
    this.handover.hidden = false;
    this.handover.classList.remove('is-in');
    void this.handover.offsetWidth;
    this.handover.classList.add('is-in');
    this.announce(`${opts.summary} ${this.handoverName.textContent}.`);
    this.handoverButton.focus({ preventScroll: true });
  }

  hideHandover(): void {
    this.handover.hidden = true;
  }

  get handoverOpen(): boolean {
    return !this.handover.hidden;
  }

  // ---------- Score sheet ----------

  private lastState: GameState | null = null;

  setState(state: GameState): void {
    this.lastState = state;
  }

  toggleScoreCard(): void {
    if (this.scoreDialog.open) {
      this.scoreDialog.close();
      return;
    }
    if (this.lastState) this.renderScoreCard(this.lastState);
    this.scoreDialog.showModal();
  }

  private renderScoreCard(state: GameState): void {
    this.scoreTable.replaceChildren(this.buildScoreTable(state), this.poseTiles());
  }

  /** Every result and what it scores, laid out as a sheet of tiles. */
  private poseTiles(): HTMLElement {
    const tiles = el('ul', { class: 'tiles' });
    // Every tile carries a real render of the current player's animal in that pose, in their colour.
    const seatDie = this.lastState?.seats[this.lastState.currentSeat]?.dice[0];
    const animal = seatDie && isPickable(seatDie) ? getAnimal(seatDie) : getAnimal(DEFAULT_DIE);
    const scoring = animal.scoring;
    const collar = this.lastState ? this.colourOf(this.lastState.currentSeat) : SEAT_COLOURS[0];
    const tile = (name: string, single: string, double: string | null, shot: PortraitScene, tone = '') => {
      const img = el('img', { class: 'tile__art', attrs: { alt: `${name}: how the wolves land`, width: '360', height: '220' } });
      void renderPortrait(animal, collar, shot).then((url) => {
        img.src = url;
        img.classList.add('is-ready');
      });
      return el('li', { class: `tile${tone ? ` tile--${tone}` : ''}` }, [
        el('div', { class: 'tile__frame' }, [img]),
        el('h4', { class: 'tile__name', text: name }),
        el('p', { class: 'tile__pts', text: single }),
        double ? el('p', { class: 'tile__double', text: double }) : null,
      ]);
    };
    tiles.append(tile('Den', `${DEN_POINTS} pt`, 'Both on the same side', { kind: 'pair', poses: ['sideMarkUp', 'sideMarkUp'] }));
    for (const pose of SCORING_POSES) {
      const p = scoring.points[pose];
      tiles.append(tile(scoring.poseNames[pose], `${p} pts`, `Double ${p * 2 * DOUBLE_MULTIPLIER} pts`, { kind: 'single', pose }));
    }
    tiles.append(
      tile('Alpha', 'Instant win', 'One wolf riding the other', { kind: 'alpha' }, 'gold'),
      tile('Scattered', 'Turn lost', 'Opposite sides', { kind: 'pair', poses: ['sideMarkUp', 'sideMarkDown'] }, 'bust'),
      tile('Tangled', 'Bank wiped', 'Wolves touching', { kind: 'touching' }, 'bust'),
    );
    return el('section', { class: 'sheet__section', attrs: { 'aria-labelledby': 'tiles-title' } }, [
      el('h3', { class: 'sheet__h', text: 'How the wolves score', attrs: { id: 'tiles-title' } }),
      tiles,
    ]);
  }

  private buildScoreTable(state: GameState): HTMLElement {
    const rows = buildScoreCard(state);
    const table = el('table', { class: 'card' });
    table.append(el('caption', { text: `Race to ${state.targetScore}. Each cell shows that round's turn.` }));
    const headRow = el('tr', {}, [el('th', { text: 'Round', attrs: { scope: 'col' } })]);
    state.seats.forEach((s, i) => {
      const th = el('th', { attrs: { scope: 'col' } }, [el('span', { class: 'card__collar', attrs: { 'aria-hidden': 'true' } }), document.createTextNode(s.name)]);
      th.style.setProperty('--seat', this.colourOf(i));
      if (i === state.currentSeat && state.phase !== 'gameOver') th.classList.add('is-active');
      headRow.append(th);
    });
    table.append(el('thead', {}, [headRow]));
    const body = el('tbody');
    if (rows.length === 0) {
      body.append(el('tr', {}, [el('td', { class: 'card__empty', text: 'No turns yet. The first throw is waiting.', attrs: { colspan: String(state.seats.length + 1) } })]));
    }
    for (const row of rows) {
      const tr = el('tr', {}, [el('th', { text: String(row.round), attrs: { scope: 'row' } })]);
      for (const cell of row.cells) tr.append(this.cell(cell));
      body.append(tr);
    }
    table.append(body);
    const totals = el('tr', {}, [el('th', { text: 'Total', attrs: { scope: 'row' } })]);
    state.scores.forEach((score, i) => {
      const td = el('td', { class: 'card__total', text: String(score) });
      if (state.winner === i) td.classList.add('is-winner');
      totals.append(td);
    });
    table.append(el('tfoot', {}, [totals]));
    return el('div', { class: 'card__wrap' }, [table]);
  }

  private cell(turn: TurnRecord | null): HTMLElement {
    if (!turn) return el('td', { class: 'card__cell is-empty', text: '' });
    const rolls = `${turn.rolls.length} roll${turn.rolls.length === 1 ? '' : 's'}`;
    if (turn.outcome === 'alpha') {
      return el('td', { class: 'card__cell is-alpha', attrs: { title: rolls } }, [el('span', { class: 'card__pts', text: 'Alpha' })]);
    }
    if (turn.outcome === 'banked') {
      return el('td', { class: 'card__cell', attrs: { title: rolls } }, [el('span', { class: 'card__pts', text: `+${turn.banked}` })]);
    }
    const label = turn.outcome === 'tangled' ? 'Tangled' : turn.outcome === 'skipped' ? 'Away' : 'Scattered';
    return el('td', { class: `card__cell is-bust is-${turn.outcome}`, attrs: { title: rolls } }, [
      el('span', { class: 'card__bust', text: label }),
      el('span', { class: 'card__lost', text: turn.lost > 0 ? `-${turn.lost}` : '0' }),
    ]);
  }
}
