import type { GameState, TurnRecord } from '../rules/game';
import { buildScoreCard } from '../rules/scorecard';
import type { RollResult } from '../rules/scoring';
import { SEAT_COLOURS, TARGET_CHOICES, type Setup } from '../game/settings';
import { MAX_SEATS, MIN_SEATS } from '../rules/constants';

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

export interface ViewHandlers {
  onStart(setup: Setup): void;
  onRoll(): void;
  onBank(): void;
  onTakeTurn(): void;
  onNewGame(): void;
  onRematch(): void;
}

/** All DOM for the game: setup sheet, HUD, pegboard, score card and handover band. */
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
  private setup!: Setup;
  private seatColours: string[] = [];

  constructor(
    mount: HTMLElement,
    private readonly handlers: ViewHandlers,
  ) {
    this.canvas = el('canvas', { class: 'scene', attrs: { 'aria-label': 'The table: drag on the blanket to throw the wolves' } });

    this.plateName = el('h2', { class: 'plate__name' });
    this.plateRound = el('p', { class: 'plate__round' });
    this.plateBanked = el('span', { class: 'num' });
    this.platePot = el('span', { class: 'num' });
    const plate = el('section', { class: 'plate', attrs: { 'aria-label': 'Current player' } }, [
      this.plateName,
      this.plateRound,
      el('dl', { class: 'plate__stats' }, [
        el('div', {}, [el('dt', { text: 'Banked' }), el('dd', {}, [this.plateBanked])]),
        el('div', { class: 'plate__pot' }, [el('dt', { text: 'This turn' }), el('dd', {}, [this.platePot])]),
      ]),
    ]);

    const scoreButton = el('button', { class: 'tab tab--small', text: 'Score card', attrs: { type: 'button', 'aria-keyshortcuts': 'S' } });
    scoreButton.addEventListener('click', () => this.toggleScoreCard());
    const menuButton = el('button', { class: 'tab tab--small', text: 'New table', attrs: { type: 'button' } });
    menuButton.addEventListener('click', () => this.handlers.onNewGame());
    const corner = el('nav', { class: 'corner', attrs: { 'aria-label': 'Game' } }, [scoreButton, menuButton]);

    this.resultLabel = el('p', { class: 'result__label' });
    this.resultPoints = el('p', { class: 'result__points' });
    this.result = el('div', { class: 'result', attrs: { 'aria-hidden': 'true' } }, [this.resultLabel, this.resultPoints]);
    this.live = el('p', { class: 'sr-only', attrs: { 'aria-live': 'polite', role: 'status' } });

    this.rollButton = el('button', { class: 'tab tab--roll', text: 'Roll', attrs: { type: 'button', 'aria-keyshortcuts': 'Space' } });
    this.bankButton = el('button', { class: 'tab tab--bank', text: 'Bank', attrs: { type: 'button', 'aria-keyshortcuts': 'B' } });
    this.rollButton.addEventListener('click', () => this.handlers.onRoll());
    this.bankButton.addEventListener('click', () => this.handlers.onBank());
    this.hint = el('p', { class: 'hint' });
    const actions = el('div', { class: 'actions' }, [this.rollButton, this.bankButton]);

    this.board = svg('svg', { class: 'pegboard__svg', role: 'img' });
    const pegboard = el('footer', { class: 'pegboard' }, [this.board]);
    new ResizeObserver(() => this.root.style.setProperty('--board-h', `${pegboard.offsetHeight}px`)).observe(pegboard);

    this.hud = el('div', { class: 'hud', attrs: { hidden: '' } }, [plate, corner, this.result, this.hint, actions, pegboard, this.live]);

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

    this.scoreTable = el('div', { class: 'scorecard__body' });
    const closeScore = el('button', { class: 'tab tab--small', text: 'Close', attrs: { type: 'button' } });
    closeScore.addEventListener('click', () => this.scoreDialog.close());
    this.scoreDialog = el('dialog', { class: 'scorecard', attrs: { 'aria-labelledby': 'scorecard-title' } }, [
      el('header', { class: 'scorecard__head' }, [el('h2', { text: 'Score card', attrs: { id: 'scorecard-title' } }), closeScore]),
      this.scoreTable,
    ]);
    this.scoreDialog.addEventListener('click', (e) => {
      if (e.target === this.scoreDialog) this.scoreDialog.close();
    });

    this.setupSheet = el('section', { class: 'setup', attrs: { 'aria-labelledby': 'setup-title' } });

    this.root = el('div', { class: 'table' }, [this.canvas, this.hud, this.handover, this.setupSheet, this.scoreDialog]);
    mount.append(this.root);
  }

  // ---------- Setup ----------

  showSetup(setup: Setup): void {
    this.setup = structuredClone(setup);
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
    const form = el('form', { class: 'setup__card' });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlers.onStart(structuredClone(this.setup));
    });

    const brand = el('div', { class: 'setup__brand' }, [
      el('img', { class: 'setup__mark', attrs: { src: `${import.meta.env.BASE_URL}favicon.svg`, alt: '', width: '96', height: '96' } }),
      el('h1', { class: 'wordmark', attrs: { id: 'setup-title' } }, [document.createTextNode('Pass the '), el('span', { text: 'Wolf' })]),
    ]);
    const lede = el('p', { class: 'setup__lede', text: 'Throw two wooden wolves. Score by how they land. Roll again or bank it before the pack scatters.' });

    const modeGroup = el('fieldset', { class: 'setup__modes' }, [el('legend', { text: 'Who is playing?' })]);
    for (const [mode, label, detail] of [
      ['solo', 'Solo', 'You against the computer'],
      ['table', 'Table', '2 to 6 players, pass the mouse'],
    ] as const) {
      const input = el('input', { attrs: { type: 'radio', name: 'mode', value: mode } });
      input.checked = s.mode === mode;
      input.addEventListener('change', () => {
        this.setMode(mode);
      });
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
      const peg = el('span', { class: 'seat__peg', attrs: { 'aria-hidden': 'true' } });
      peg.style.setProperty('--seat', seat.colour);

      const kind = el('button', {
        class: `seat__kind${seat.kind === 'cpu' ? ' is-cpu' : ''}`,
        text: seat.kind === 'cpu' ? 'Computer' : 'Human',
        attrs: { type: 'button', 'aria-label': `Seat ${i + 1}: ${seat.kind === 'cpu' ? 'computer' : 'human'} player. Switch.` },
      });
      kind.disabled = s.mode === 'solo';
      kind.addEventListener('click', () => {
        seat.kind = seat.kind === 'cpu' ? 'human' : 'cpu';
        this.renderSetup();
      });

      const remove = el('button', { class: 'seat__remove', text: 'Remove', attrs: { type: 'button', 'aria-label': `Remove seat ${i + 1}` } });
      remove.disabled = s.seats.length <= (s.mode === 'solo' ? 2 : MIN_SEATS) || (s.mode === 'solo' && i === 0);
      remove.addEventListener('click', () => {
        s.seats.splice(i, 1);
        this.renderSetup();
      });
      seatList.append(el('li', { class: 'seat' }, [peg, name, kind, remove]));
    });

    const add = el('button', { class: 'tab tab--small', text: s.mode === 'solo' ? 'Add a computer wolf' : 'Add a seat', attrs: { type: 'button' } });
    add.disabled = s.seats.length >= MAX_SEATS;
    add.addEventListener('click', () => {
      const used = new Set(s.seats.map((x) => x.colour));
      const colour = SEAT_COLOURS.find((c) => !used.has(c)) ?? SEAT_COLOURS[0];
      const n = s.seats.length;
      s.seats.push(
        s.mode === 'solo'
          ? { name: ['Ember', 'Birch', 'Sleet', 'Juniper', 'Flint'][n - 1] ?? 'Wolf', kind: 'cpu', colour }
          : { name: `Player ${n + 1}`, kind: 'human', colour },
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

    form.append(
      brand,
      lede,
      modeGroup,
      el('div', { class: 'setup__seats' }, [el('h2', { class: 'setup__h', text: 'Seats' }), seatList, add]),
      el('div', { class: 'setup__foot' }, [el('label', { class: 'setup__target-label', text: 'Race', attrs: { for: 'target' } }), target, start]),
    );
    this.setupSheet.replaceChildren(form);
  }

  private setMode(mode: Setup['mode']): void {
    const s = this.setup;
    if (s.mode === mode) return;
    s.mode = mode;
    if (mode === 'solo') {
      s.seats = s.seats.map((seat, i) => ({ ...seat, kind: i === 0 ? 'human' : 'cpu' }));
      if (s.seats.length < 2) s.seats.push({ name: 'Ember', kind: 'cpu', colour: SEAT_COLOURS[1] });
    } else {
      s.seats = s.seats.map((seat, i) => ({ ...seat, kind: 'human', name: seat.kind === 'cpu' ? `Player ${i + 1}` : seat.name }));
    }
    this.renderSetup();
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
    this.plateBanked.textContent = String(state.scores[state.currentSeat] ?? 0);
    this.platePot.textContent = String(state.turnPot);
    this.rollButton.disabled = !opts.canRoll;
    this.bankButton.disabled = !opts.canBank;
    this.bankButton.textContent = opts.canBank ? `Bank ${state.turnPot}` : 'Bank';
    this.hint.textContent = opts.hint;
    this.root.classList.toggle('is-busy', opts.busy);
    this.drawPegboard(state);
    if (this.scoreDialog.open) this.renderScoreCard(state);
  }

  showResult(roll: RollResult | null, who?: string): void {
    if (!roll) {
      this.result.classList.remove('is-shown', 'is-bust', 'is-big');
      return;
    }
    this.resultLabel.textContent = roll.label;
    this.resultPoints.textContent =
      roll.kind === 'tangled' ? 'Bank wiped' : roll.bust ? 'Turn pot lost' : `+${roll.points}`;
    this.result.classList.remove('is-shown');
    void this.result.offsetWidth; // restart the entrance
    this.result.classList.add('is-shown');
    this.result.classList.toggle('is-bust', roll.bust);
    this.result.classList.toggle('is-big', !roll.bust && roll.points >= 20);
    this.announce(`${who ? `${who}: ` : ''}${roll.label}. ${this.resultPoints.textContent}.`);
  }

  announce(text: string): void {
    this.live.textContent = text;
  }

  private drawPegboard(state: GameState): void {
    const target = state.targetScore;
    const seats = state.seats.length;
    const hole = 10;
    const groupGap = 8;
    const labelW = 120;
    const laneH = 22;
    const groups = Math.ceil(target / 10);
    const width = labelW + target * hole + (groups - 1) * groupGap + 40;
    const height = seats * laneH + 12;
    this.board.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.board.setAttribute(
      'aria-label',
      `Race to ${target}: ` + state.seats.map((s, i) => `${s.name} ${state.scores[i]}`).join(', '),
    );
    const holeX = (n: number) => labelW + (n - 1) * hole + Math.floor((n - 1) / 10) * groupGap + hole / 2;

    const nodes: SVGElement[] = [];
    state.seats.forEach((seat, i) => {
      const y = 6 + i * laneH + laneH / 2;
      const active = i === state.currentSeat && state.phase !== 'gameOver';
      const colour = this.colourOf(i);
      if (active) {
        nodes.push(svg('rect', { x: 2, y: y - laneH / 2 + 1, width: width - 4, height: laneH - 2, rx: 4, class: 'lane--active', fill: colour }));
      }
      const label = svg('text', { x: 10, y: y + 4, class: `lane__name${active ? ' is-active' : ''}` });
      label.textContent = seat.name;
      nodes.push(label);
      const scoreText = svg('text', { x: labelW - 10, y: y + 4, class: 'lane__score', 'text-anchor': 'end' });
      scoreText.textContent = String(state.scores[i]);
      nodes.push(scoreText);
      for (let n = 1; n <= target; n++) {
        nodes.push(svg('circle', { cx: holeX(n), cy: y, r: n % 10 === 0 ? 2.6 : 2.1, class: 'hole' }));
      }
      const score = Math.min(target, state.scores[i] ?? 0);
      if (active && state.turnPot > 0) {
        const ghost = Math.min(target, score + state.turnPot);
        nodes.push(svg('circle', { cx: holeX(ghost), cy: y, r: 4.6, class: 'peg peg--ghost', stroke: colour }));
      }
      if (score > 0) nodes.push(svg('circle', { cx: holeX(score), cy: y, r: 4.6, class: 'peg', fill: colour }));
    });
    // Finish post
    nodes.push(svg('rect', { x: holeX(target) + 10, y: 4, width: 4, height: height - 8, rx: 2, class: 'finish' }));
    this.board.replaceChildren(...nodes);
  }

  // ---------- Handover ----------

  showHandover(
    state: GameState,
    opts: { nextSeat: number; summary: string; buttonText: string; gameOver?: boolean },
  ): void {
    const next = state.seats[opts.nextSeat]!;
    this.root.style.setProperty('--handover', this.colourOf(opts.nextSeat));
    this.handoverSummary.textContent = opts.summary;
    this.handoverName.textContent = opts.gameOver ? winsLine(next.name) : turnLine(next.name);
    this.handoverButton.textContent = opts.buttonText;
    this.handoverExtra.replaceChildren();
    if (opts.gameOver) {
      const again = el('button', { class: 'tab tab--small', text: 'New table', attrs: { type: 'button' } });
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

  // ---------- Score card ----------

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
    this.scoreTable.replaceChildren(this.buildScoreTable(state));
  }

  private buildScoreTable(state: GameState): HTMLElement {
    const rows = buildScoreCard(state);
    const table = el('table', { class: 'card' });
    table.append(el('caption', { text: `Race to ${state.targetScore}. Each cell shows that round's turn.` }));
    const headRow = el('tr', {}, [el('th', { text: 'Round', attrs: { scope: 'col' } })]);
    state.seats.forEach((s, i) => {
      const th = el('th', { attrs: { scope: 'col' } }, [el('span', { class: 'card__peg', attrs: { 'aria-hidden': 'true' } }), document.createTextNode(s.name)]);
      th.style.setProperty('--seat', this.colourOf(i));
      if (i === state.currentSeat && state.phase !== 'gameOver') th.classList.add('is-active');
      headRow.append(th);
    });
    table.append(el('thead', {}, [headRow]));
    const body = el('tbody');
    if (rows.length === 0) {
      body.append(el('tr', {}, [el('td', { class: 'card__empty', text: 'No turns yet. First throw is waiting.', attrs: { colspan: String(state.seats.length + 1) } })]));
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
    if (turn.outcome === 'banked') {
      return el('td', { class: 'card__cell', attrs: { title: rolls } }, [el('span', { class: 'card__pts', text: `+${turn.banked}` })]);
    }
    const label = turn.outcome === 'tangled' ? 'Tangled' : 'Scattered';
    return el('td', { class: `card__cell is-bust is-${turn.outcome}`, attrs: { title: rolls } }, [
      el('span', { class: 'card__bust', text: label }),
      el('span', { class: 'card__lost', text: turn.lost > 0 ? `-${turn.lost}` : '0' }),
    ]);
  }
}
