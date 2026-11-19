import type RAPIER_NS from '@dimforge/rapier3d-compat';
import { getAnimal } from '../animals/registry';
import type { GameEvent, NetSession } from '../net/session';
import { decodeTrack, encodeTrack, trackFrame, TRACK_EVERY } from '../net/track';
import { DiceWorld, MAX_STEPS, TIMESTEP, autoRollInput, type SettledDice, type ThrowInput } from '../physics/dice-world';
import { randomSeed } from '../physics/rng';
import type { TableScene } from '../render/scene';
import { applyRoll, bank, canBank, forfeitTurn, newGame, nextTurn, type GameState } from '../rules/game';
import { scoreRoll, type RollResult } from '../rules/scoring';
import type { GameView } from '../ui/view';
import type { DebugFlags } from './debug';
import { saveSetup, toSeats, type Setup } from './settings';

/** `syncing`: an online throw has landed and is waiting for the host's go-ahead. `replaying`: another player's throw is playing back. */
type Phase = 'setup' | 'ready' | 'holding' | 'tumbling' | 'syncing' | 'replaying' | 'cutscene' | 'result' | 'handover' | 'over';

/** Rolls worth this much or more get the zoom-in cutscene (as do Alpha and Tangled). */
export const CUTSCENE_POINTS = 15;
const CUTSCENE_MS = 2600;

const CPU_BANK_AT = 20; // placeholder until the CPU personalities land
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** An online game: the session, and which peer plays each seat. */
export interface NetGame {
  readonly session: NetSession;
  owners: readonly string[];
}

/** Glue between the rules engine, the physics world, the 3D scene and the DOM view. */
export class GameController {
  private state: GameState | null = null;
  private setup: Setup | null = null;
  private world: DiceWorld | null = null;
  private phase: Phase = 'setup';
  private throwCount = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private timers: number[] = [];
  private forced: SettledDice[];
  /** Recent hand positions on the table while the wolves are held, for the throw velocity. */
  private handTrail: { t: number; x: number; z: number }[] = [];
  private hand: { x: number; z: number } = { x: 0, z: 0 };

  // ---------- online play (#2) ----------
  private net: NetGame | null = null;
  /** Events from the host, applied one at a time when the table is free. */
  private queue: { ev: GameEvent; by: string }[] = [];
  /** Catching up after a rejoin: apply events instantly, without tumbles or cutscenes. */
  private catchingUp = false;
  /** Whether the current thrower has taken the wolves this turn (host check for throws). */
  private turnTaken = false;
  /** The tumble being recorded (thrower) or played back (everyone else). */
  private recording: number[] = [];
  private lastSeed: number | null = null;
  private replay: { frames: Int16Array; start: number; settled: SettledDice } | null = null;

  constructor(
    private readonly R: typeof RAPIER_NS,
    private readonly scene: TableScene,
    private readonly view: GameView,
    private readonly debug: DebugFlags,
  ) {
    this.forced = [...debug.forced];
    this.bindInput();
    requestAnimationFrame(this.frame);
  }

  // ---------- lifecycle ----------

  start(setup: Setup, net: NetGame | null = this.net): void {
    this.clearTimers();
    this.setup = setup;
    this.net = net;
    this.queue = [];
    this.turnTaken = false;
    if (net) this.attach(net);
    else saveSetup(setup);
    this.state = newGame({ seats: toSeats(setup), targetScore: setup.targetScore });
    this.view.setSeatColours(setup.seats.map((s) => s.colour));
    this.view.hideSetup();
    this.view.showResult(null);
    this.prepareDice();
    this.phase = 'handover';
    this.refresh();
    const first = this.state.seats[0]!;
    this.view.showHandover(this.state, {
      nextSeat: 0,
      summary: `Race to ${this.state.targetScore}.`,
      ...this.takeButton(0),
    });
    if (this.isCpu(0)) this.later(() => this.takeTurn(), 1100);
    else void first;
  }

  /** Join an online game in progress: deal, then apply every event so far without animation. */
  catchUp(setup: Setup, net: NetGame, replay: readonly { ev: GameEvent; by: string }[]): void {
    this.start(setup, net);
    this.catchingUp = true;
    for (const { ev, by } of replay) this.applyEvent(ev, by);
    this.catchingUp = false;
  }

  newTable(): void {
    this.clearTimers();
    if (this.net) {
      this.net.session.leave();
      this.net = null;
    }
    this.phase = 'setup';
    this.view.hideHandover();
    if (this.setup) this.view.showSetup(this.setup);
  }

  /** Put the current seat's dice at rest on their edge of the tray. */
  private prepareDice(): void {
    if (!this.state) return;
    const seat = this.state.seats[this.state.currentSeat]!;
    const animals = [getAnimal(seat.dice[0]), getAnimal(seat.dice[1])] as const;
    this.world?.free();
    this.world = new DiceWorld(this.R, animals);
    this.world.place(0, [-0.9, 0.02, 2.6], { x: 0, y: 0.38, z: 0, w: 0.925 });
    this.world.place(1, [0.9, 0.02, 2.6], { x: 0, y: -0.38, z: 0, w: 0.925 });
    this.world.settle(240);
    this.scene.setDice(animals, this.view.colourOf(this.state.currentSeat));
    this.scene.sync(this.world);
  }

  // ---------- who plays which seat ----------

  private get seat() {
    return this.state ? this.state.seats[this.state.currentSeat]! : null;
  }

  /** This device plays seat `i`: a local human seat, or online, the seat this peer owns. */
  private isMine(i: number): boolean {
    if (!this.state) return false;
    if (this.net) return this.net.owners[i] === this.net.session.selfId;
    return this.state.seats[i]!.kind === 'human';
  }

  /** Seat `i` is a computer player (never online: every online seat is a person). */
  private isCpu(i: number): boolean {
    return !this.net && this.state?.seats[i]?.kind === 'cpu';
  }

  private get humanTurn(): boolean {
    return !!this.state && this.isMine(this.state.currentSeat);
  }

  private get cpuTurn(): boolean {
    return !!this.state && this.isCpu(this.state.currentSeat);
  }

  /** The seat whose player takes the wolves from the handover band now. */
  private seatToTake(): number {
    if (!this.state) return -1;
    if (this.state.phase === 'handover') return (this.state.currentSeat + 1) % this.state.seats.length;
    if (this.state.phase === 'awaitingRoll' && !this.turnTaken) return this.state.currentSeat;
    return -1;
  }

  private takeButton(seat: number): { buttonText: string; locked: boolean } {
    const name = this.state?.seats[seat]?.name ?? '';
    if (this.isCpu(seat)) return { buttonText: `${name} is throwing…`, locked: false };
    if (this.net && !this.isMine(seat)) return { buttonText: `Waiting for ${name}…`, locked: true };
    return { buttonText: 'Take the wolves', locked: false };
  }

  // ---------- turn flow ----------

  takeTurn(): void {
    if (this.phase === 'over') return this.rematch();
    if (!this.state || this.phase !== 'handover' || this.state.phase === 'gameOver') return;
    const seat = this.seatToTake();
    if (this.net) {
      if (this.isMine(seat)) this.net.session.submit({ type: 'take', seat });
      return;
    }
    this.doTakeTurn();
  }

  private doTakeTurn(): void {
    if (!this.state || this.state.phase === 'gameOver') return;
    if (this.state.phase === 'handover') this.state = nextTurn(this.state);
    this.turnTaken = true;
    this.view.hideHandover();
    this.view.showResult(null);
    this.prepareDice();
    this.phase = 'ready';
    this.refresh();
    if (this.cpuTurn) this.later(() => this.cpuThrow(), 700);
  }

  throwDice(input: Omit<ThrowInput, 'seed'>): void {
    if (!this.state || !this.world || this.phase !== 'ready' && this.phase !== 'result') return;
    if (this.state.phase !== 'awaitingRoll') return;
    const seed = this.debug.seed !== null ? this.debug.seed + this.throwCount : randomSeed();
    this.throwCount++;
    // Re-seat the dice at the thrower's edge if they're lying where the last throw left them.
    if (this.phase === 'result') this.prepareDice();
    this.world.throwDice({ ...input, seed });
    this.beginTumble(seed);
  }

  private beginTumble(seed: number): void {
    this.lastSeed = seed;
    this.recording = [];
    if (this.world) trackFrame(this.world, this.recording);
    this.view.showResult(null);
    this.phase = 'tumbling';
    this.accumulator = 0;
    this.refresh();
    if (this.debug.fast && this.world) this.onSettled(this.world.settle());
  }

  /** Pick the wolves up from where they lie; they follow the pointer until released. */
  private grabDice(clientX: number, clientY: number): void {
    if (!this.world) return;
    // A press off the felt (a wall, the night sky) still picks the wolves up where they lie.
    const at = this.scene.pick(clientX, clientY) ?? this.scene.diceCentre();
    this.world.grab();
    this.hand = { x: at.x, z: at.z };
    this.handTrail = [{ t: performance.now(), x: at.x, z: at.z }];
    this.world.hold(at.x, at.z, performance.now() / 1000);
    this.scene.sync(this.world);
    this.view.showResult(null);
    this.phase = 'holding';
    this.refresh();
  }

  private moveHand(clientX: number, clientY: number): void {
    const at = this.scene.pick(clientX, clientY);
    if (!at) return;
    const now = performance.now();
    this.hand = { x: at.x, z: at.z };
    this.handTrail.push({ t: now, x: at.x, z: at.z });
    this.handTrail = this.handTrail.filter((p) => now - p.t < 150);
  }

  /** Let go: the wolves fly with the hand's speed and direction over the last tenth of a second. */
  private releaseDice(): void {
    if (!this.world || this.phase !== 'holding') return;
    const now = performance.now();
    const recent = this.handTrail.filter((p) => now - p.t < 110);
    const first = recent[0] ?? this.handTrail[0];
    const last = recent.at(-1) ?? first;
    const dt = first && last ? Math.max(0.016, (last.t - first.t) / 1000) : 1;
    const velocity = first && last ? { x: (last.x - first.x) / dt, z: (last.z - first.z) / dt } : { x: 0, z: 0 };
    const seed = this.debug.seed !== null ? this.debug.seed + this.throwCount : randomSeed();
    this.throwCount++;
    this.world.release(velocity, seed);
    this.handTrail = [];
    this.beginTumble(seed);
  }

  private onSettled(physical: SettledDice): void {
    if (!this.state || !this.world) return;
    this.scene.sync(this.world);
    const settled = this.forced.shift() ?? physical;
    if (this.net) {
      // Online: send the landing (with its recording) to the host; apply it when the host echoes it.
      trackFrame(this.world, this.recording);
      this.phase = 'syncing';
      this.refresh();
      this.net.session.submit({ type: 'throw', seat: this.state.currentSeat, settled, track: encodeTrack(this.recording), seed: this.lastSeed });
      return;
    }
    this.applySettled(settled);
  }

  /** Score a landing and show it. */
  private applySettled(settled: SettledDice): void {
    if (!this.state) return;
    const seat = this.seat!;
    const roll = scoreRoll({
      dice: [
        { animal: getAnimal(seat.dice[0]).scoring, pose: settled.poses[0] },
        { animal: getAnimal(seat.dice[1]).scoring, pose: settled.poses[1] },
      ],
      touching: settled.touching,
      stacked: settled.stacked,
    });
    this.state = applyRoll(this.state, roll);
    this.view.showResult(roll, seat.name);
    const big = (!roll.bust && roll.points >= CUTSCENE_POINTS) || roll.kind === 'alpha' || roll.kind === 'tangled';
    if (big && !this.debug.fast && !this.catchingUp) {
      this.phase = 'cutscene';
      this.refresh();
      const still = reduceMotion();
      this.scene.focusOn(this.scene.diceCentre(), still ? 1 : 900);
      void this.view.playCutscene(roll, CUTSCENE_MS).then(() => {
        this.scene.focusOn(null, still ? 1 : 700);
        this.afterResult(roll);
      });
      return;
    }
    this.afterResult(roll);
  }

  /** Carry on once the result has been shown (and its cutscene, if any, has finished). */
  private afterResult(roll: RollResult): void {
    this.phase = 'result';
    this.refresh();
    if (roll.winsGame || roll.bust) {
      this.later(() => this.toHandover(roll), 1500);
      return;
    }
    if (this.cpuTurn) this.later(() => this.cpuDecide(), 1100);
  }

  bank(): void {
    if (!this.state || !canBank(this.state) || !this.humanTurn) return;
    if (this.phase !== 'result' && this.phase !== 'ready') return;
    if (this.net) return this.net.session.submit({ type: 'bank', seat: this.state.currentSeat });
    this.doBank();
  }

  private doBank(): void {
    if (!this.state || !canBank(this.state)) return;
    const pot = this.state.turnPot;
    this.state = bank(this.state);
    this.view.announce(`${this.seat?.name} banks ${pot}.`);
    this.toHandover(null, pot);
  }

  /** `bust` is the roll that ended the turn without a bank: a bust, or the Alpha's instant win. */
  private toHandover(bust: RollResult | null, banked = 0, note = ''): void {
    if (!this.state) return;
    const state = this.state;
    const seat = state.seats[state.currentSeat]!;
    this.turnTaken = false;
    this.phase = state.phase === 'gameOver' ? 'over' : 'handover';
    this.refresh();
    const last = state.history.at(-1);
    let summary: string;
    if (note) summary = note;
    else if (bust?.kind === 'alpha') summary = `Alpha! ${seat.name} rides one wolf on the other to an instant win.`;
    else if (bust?.kind === 'tangled') summary = `Tangled! ${seat.name} loses ${last?.lost ?? 0} and drops to 0.`;
    else if (bust) summary = `Scattered. ${seat.name} loses ${last?.lost ?? 0} from the pot.`;
    else summary = `${seat.name} banks ${banked}, now on ${state.scores[state.currentSeat]}.`;

    if (state.phase === 'gameOver') {
      const host = !this.net || this.net.session.isHost;
      const show = () =>
        this.view.showHandover(state, {
          nextSeat: state.winner ?? state.currentSeat,
          summary,
          buttonText: host ? 'Rematch' : 'Waiting for the host…',
          gameOver: true,
          locked: !host,
        });
      if ((this.debug.fast && !this.debug.winnerScene) || this.catchingUp) return show();
      const contender = (i: number) => ({ name: state.seats[i]!.name, colour: this.view.colourOf(i), animal: state.seats[i]!.dice[0] });
      const winnerIndex = state.winner ?? state.currentSeat;
      const losers = state.seats.map((_, i) => i).filter((i) => i !== winnerIndex).map(contender);
      this.phase = 'cutscene';
      void this.view.playWinnerCutscene(contender(winnerIndex), losers).then(() => {
        this.phase = 'over';
        show();
        this.pump();
      });
      return;
    }
    const nextIndex = (state.currentSeat + 1) % state.seats.length;
    this.view.showHandover(state, { nextSeat: nextIndex, summary, ...this.takeButton(nextIndex) });
    if (this.isCpu(nextIndex)) this.later(() => this.takeTurn(), 1600);
    this.skipIfAway();
  }

  rematch(): void {
    if (!this.setup) return;
    if (this.net) {
      if (this.net.session.isHost) this.net.session.submit({ type: 'rematch' });
      return;
    }
    this.start(this.setup);
  }

  // ---------- online events ----------

  private attach(net: NetGame): void {
    const s = net.session;
    s.onEvent = (ev, by) => {
      this.queue.push({ ev, by });
      this.pump();
    };
    s.onOwners = (owners) => {
      net.owners = owners;
      this.refresh();
    };
    s.validate = (ev, by) => this.validate(ev, by);
    s.onDropped = () => this.skipIfAway();
    s.onClosed = (reason) => {
      this.net = null;
      this.view.announce(reason);
      window.alert(reason);
      this.newTable();
    };
  }

  /** Host: is this action allowed for this peer right now? Checked on the rules state, in order. */
  private validate(ev: GameEvent, by: string): boolean {
    const s = this.state;
    const net = this.net;
    if (!s || !net) return false;
    const owns = (seat: number) => net.owners[seat] === by;
    switch (ev.type) {
      case 'take':
        return ev.seat === this.seatToTakeAfterQueue() && owns(ev.seat);
      case 'throw':
      case 'bank':
        return s.phase === 'awaitingRoll' && ev.seat === s.currentSeat && owns(ev.seat) && (ev.type === 'throw' || canBank(s));
      case 'rematch':
        return by === net.session.selfId && s.phase === 'gameOver';
      case 'skip':
        return by === net.session.selfId;
    }
  }

  /** The host checks against the state after its queued events, not its (maybe mid-animation) screen. */
  private seatToTakeAfterQueue(): number {
    return this.queue.length ? -1 : this.seatToTake();
  }

  /** The table is free to take the next event: nothing is tumbling, replaying or mid-cutscene. */
  private get idle(): boolean {
    if (['ready', 'handover', 'over', 'syncing'].includes(this.phase)) return true;
    return this.phase === 'result' && this.state?.phase === 'awaitingRoll';
  }

  private pump(): void {
    while (this.queue.length && this.idle) {
      const { ev, by } = this.queue.shift()!;
      this.applyEvent(ev, by);
    }
  }

  private applyEvent(ev: GameEvent, by: string): void {
    if (!this.state || !this.net) return;
    switch (ev.type) {
      case 'take':
        this.doTakeTurn();
        break;
      case 'bank':
        this.doBank();
        break;
      case 'rematch':
        if (this.setup) this.start(this.setup, this.net);
        break;
      case 'skip':
        this.doSkip(ev.seat);
        break;
      case 'throw':
        if (by === this.net.session.selfId || this.catchingUp || reduceMotion()) {
          // Our own throw (already seen), or no time to show it: just score it.
          if (by !== this.net.session.selfId && this.world) this.showFinalFrame(ev.track);
          this.applySettled(ev.settled);
        } else {
          this.startReplay(ev.track, ev.settled);
        }
        break;
    }
  }

  /** Host: when the player due to throw or take has dropped out, skip their turn. */
  private skipIfAway(): void {
    const net = this.net;
    if (!net?.session.isHost || !this.state) return;
    const connected = (seat: number) => net.session.roster.find((p) => p.id === net.owners[seat])?.connected ?? false;
    const due = this.state.phase === 'awaitingRoll' ? this.state.currentSeat : this.seatToTake();
    if (due >= 0 && this.state.phase !== 'gameOver' && !connected(due)) this.later(() => net.session.force({ type: 'skip', seat: due }), 1200);
  }

  private doSkip(seat: number): void {
    if (!this.state || this.state.phase === 'gameOver') return;
    if (this.state.phase === 'handover' && (this.state.currentSeat + 1) % this.state.seats.length === seat) this.state = nextTurn(this.state);
    if (this.state.currentSeat !== seat || this.state.phase !== 'awaitingRoll') return;
    this.state = forfeitTurn(this.state);
    this.view.hideHandover();
    this.toHandover(null, 0, `${this.state.seats[seat]!.name} is away, so their turn is skipped.`);
  }

  private startReplay(track: string, settled: SettledDice): void {
    const frames = decodeTrack(track);
    if (this.phase === 'result') this.prepareDice();
    this.view.showResult(null);
    this.replay = { frames, start: performance.now(), settled };
    this.phase = 'replaying';
    this.refresh();
  }

  /** Pose both dice on one recorded frame (14 numbers: position and rotation of each die). */
  private poseFrame(frames: Int16Array, i: number): void {
    if (!this.world) return;
    for (const d of [0, 1] as const) {
      const o = i * 14 + d * 7;
      const q = { x: frames[o + 3]! / 32767, y: frames[o + 4]! / 32767, z: frames[o + 5]! / 32767, w: frames[o + 6]! / 32767 };
      const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
      this.world.place(d, [frames[o]! / 1000, frames[o + 1]! / 1000, frames[o + 2]! / 1000], { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len });
    }
    this.scene.sync(this.world);
  }

  private showFinalFrame(track: string): void {
    const frames = decodeTrack(track);
    if (frames.length >= 14) this.poseFrame(frames, frames.length / 14 - 1);
  }

  // ---------- computer seats (placeholder brain) ----------

  private cpuThrow(): void {
    if (!this.cpuTurn || this.phase === 'tumbling') return;
    // Computer seats auto-roll, so they throw with the same calibrated odds as the button.
    this.throwDice(autoRollInput(Math.random));
  }

  private cpuDecide(): void {
    if (!this.state || !this.cpuTurn || this.phase !== 'result') return;
    const score = this.state.scores[this.state.currentSeat]!;
    const pot = this.state.turnPot;
    if (pot >= CPU_BANK_AT || score + pot >= this.state.targetScore) this.doBank();
    else this.cpuThrow();
  }

  // ---------- frame loop ----------

  private frame = (now: number): void => {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (this.phase === 'tumbling' && this.world) {
      this.accumulator += dt;
      let rested = false;
      while (this.accumulator >= TIMESTEP && !rested) {
        rested = this.world.step();
        this.accumulator -= TIMESTEP;
        if (this.world.steps >= MAX_STEPS) rested = true;
        if (this.net && this.world.steps % TRACK_EVERY === 0) trackFrame(this.world, this.recording);
      }
      this.scene.sync(this.world);
      if (rested) this.onSettled(this.world.read());
    }
    if (this.phase === 'holding' && this.world) {
      this.world.hold(this.hand.x, this.hand.z, now / 1000);
      this.scene.sync(this.world);
    }
    if (this.phase === 'replaying' && this.replay) {
      const count = this.replay.frames.length / 14;
      const i = Math.min(count - 1, Math.floor(((now - this.replay.start) / 1000) * (1 / (TIMESTEP * TRACK_EVERY))));
      if (count > 0) this.poseFrame(this.replay.frames, i);
      if (i >= count - 1) {
        const settled = this.replay.settled;
        this.replay = null;
        this.applySettled(settled);
      }
    }
    this.scene.render();
    requestAnimationFrame(this.frame);
  };

  // ---------- input ----------

  private canThrowNow(): boolean {
    return this.humanTurn && (this.phase === 'ready' || this.phase === 'result') && this.state?.phase === 'awaitingRoll';
  }

  private bindInput(): void {
    const canvas = this.scene.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.canThrowNow()) return;
      canvas.setPointerCapture(e.pointerId);
      // Any press on the tray picks both wolves up: hold, shake and let go to throw.
      this.grabDice(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.phase === 'holding') this.moveHand(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', () => this.releaseDice());
    canvas.addEventListener('pointercancel', () => this.releaseDice());

    window.addEventListener('keydown', (e) => {
      if (this.phase === 'setup' || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.view.toggleScoreCard();
        return;
      }
      if (e.code === 'Space') {
        if (e.target instanceof HTMLButtonElement) return; // let buttons activate normally
        e.preventDefault();
        if (this.phase === 'handover' && this.isMine(this.seatToTake())) this.takeTurn();
        else if (!e.repeat) this.rollButton(); // one press, one Auto-roll
        return;
      }
      if (e.key === 'b' || e.key === 'B') this.bank();
    });
    window.addEventListener('resize', () => this.scene.resize());
  }

  // ---------- helpers ----------

  private refresh(): void {
    if (!this.state) return;
    this.view.setState(this.state);
    const human = this.humanTurn;
    const ready = this.phase === 'ready' || this.phase === 'result';
    const awaiting = this.state.phase === 'awaitingRoll';
    const name = this.seat?.name;
    let hint = '';
    if (this.phase === 'tumbling') hint = 'Tumbling…';
    else if (this.phase === 'syncing') hint = 'Sending your throw to the table…';
    else if (this.phase === 'replaying') hint = `${name} throws…`;
    else if (this.phase === 'holding') hint = 'Flick and let go to throw.';
    else if (ready && awaiting && human) {
      hint = this.state.turnPot > 0 ? 'Roll again, or bank what you have.' : 'Grab the wolves and fling them, or press Auto-roll.';
    } else if (ready && !human) hint = this.net ? `${name} is deciding…` : `${name} is thinking…`;
    this.view.update(this.state, {
      canRoll: human && ready && awaiting,
      canBank: human && ready && canBank(this.state),
      busy: this.phase === 'tumbling' || this.phase === 'syncing' || this.phase === 'replaying',
      hint,
    });
    this.pump();
  }

  /** Auto-roll button: the calibrated throw profile, so its odds match the target table. */
  rollButton(): void {
    if (!this.canThrowNow()) return;
    this.throwDice(autoRollInput(Math.random));
  }

  private later(fn: () => void, ms: number): void {
    if (this.catchingUp) return fn();
    const wait = this.debug.fast ? Math.min(ms, 50) : reduceMotion() ? Math.min(ms, 600) : ms;
    this.timers.push(window.setTimeout(fn, wait));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
