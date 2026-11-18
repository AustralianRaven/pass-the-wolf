import type RAPIER_NS from '@dimforge/rapier3d-compat';
import { getAnimal } from '../animals/registry';
import { AUTO_ANGLE, DiceWorld, MAX_STEPS, TIMESTEP, autoRollInput, type SettledDice, type ThrowInput } from '../physics/dice-world';
import { randomSeed } from '../physics/rng';
import type { TableScene } from '../render/scene';
import { applyRoll, bank, canBank, newGame, nextTurn, type GameState } from '../rules/game';
import { scoreRoll, type RollResult } from '../rules/scoring';
import type { GameView } from '../ui/view';
import type { DebugFlags } from './debug';
import { saveSetup, toSeats, type Setup } from './settings';

type Phase = 'setup' | 'ready' | 'holding' | 'tumbling' | 'cutscene' | 'result' | 'handover' | 'over';

/** Rolls worth this much or more get the zoom-in cutscene (as do Alpha and Tangled). */
export const CUTSCENE_POINTS = 15;
const CUTSCENE_MS = 2600;

const DEFAULT_ANGLE = AUTO_ANGLE;
const MAX_AIM = (55 * Math.PI) / 180;
const CPU_BANK_AT = 20; // placeholder until the CPU personalities land
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Glue between the rules engine, the physics world, the 3D scene and the DOM view. */
export class GameController {
  private state: GameState | null = null;
  private setup: Setup | null = null;
  private world: DiceWorld | null = null;
  private phase: Phase = 'setup';
  private throwCount = 0;
  private aimAngle = DEFAULT_ANGLE;
  private accumulator = 0;
  private lastFrame = 0;
  private timers: number[] = [];
  private forced: SettledDice[];
  private dragStart: { x: number; y: number } | null = null;
  private chargeStart: number | null = null;
  /** Recent hand positions on the table while the wolves are held, for the throw velocity. */
  private handTrail: { t: number; x: number; z: number }[] = [];
  private hand: { x: number; z: number } = { x: 0, z: 0 };

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

  start(setup: Setup): void {
    this.clearTimers();
    this.setup = setup;
    saveSetup(setup);
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
      buttonText: first.kind === 'cpu' ? `${first.name} throws first` : 'Take the wolves',
    });
    if (first.kind === 'cpu') this.later(() => this.takeTurn(), 1100);
  }

  newTable(): void {
    this.clearTimers();
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
    this.aimAngle = DEFAULT_ANGLE;
  }

  // ---------- turn flow ----------

  private get seat() {
    return this.state ? this.state.seats[this.state.currentSeat]! : null;
  }

  private get humanTurn(): boolean {
    return this.seat?.kind === 'human';
  }

  takeTurn(): void {
    if (this.phase === 'over') return this.rematch();
    if (!this.state || this.phase !== 'handover') return;
    if (this.state.phase === 'gameOver') return;
    if (this.state.phase === 'handover') this.state = nextTurn(this.state);
    this.view.hideHandover();
    this.view.showResult(null);
    this.prepareDice();
    this.phase = 'ready';
    this.refresh();
    if (!this.humanTurn) this.later(() => this.cpuThrow(), 700);
  }

  throwDice(input: Omit<ThrowInput, 'seed'>): void {
    if (!this.state || !this.world || this.phase !== 'ready' && this.phase !== 'result') return;
    if (this.state.phase !== 'awaitingRoll') return;
    const seed = this.debug.seed !== null ? this.debug.seed + this.throwCount : randomSeed();
    this.throwCount++;
    // Re-seat the dice at the thrower's edge if they're lying where the last throw left them.
    if (this.phase === 'result') this.prepareDice();
    this.world.throwDice({ ...input, seed });
    this.view.showResult(null);
    this.phase = 'tumbling';
    this.accumulator = 0;
    this.refresh();
    if (this.debug.fast) {
      this.onSettled(this.world.settle());
    }
  }

  /** Pick the wolves up from where they lie; they follow the pointer until released. */
  private grabDice(clientX: number, clientY: number): void {
    if (!this.world) return;
    const at = this.scene.pick(clientX, clientY);
    if (!at) return;
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
    this.phase = 'tumbling';
    this.accumulator = 0;
    this.refresh();
    if (this.debug.fast) this.onSettled(this.world.settle());
  }

  private onSettled(physical: SettledDice): void {
    if (!this.state || !this.world) return;
    this.scene.sync(this.world);
    const settled = this.forced.shift() ?? physical;
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
    if (big && !this.debug.fast) {
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
    if (roll.bust) {
      this.phase = 'result';
      this.refresh();
      this.later(() => this.toHandover(roll), 1500);
      return;
    }
    this.phase = 'result';
    this.refresh();
    if (!this.humanTurn) this.later(() => this.cpuDecide(), 1100);
  }

  bank(): void {
    if (!this.state || !canBank(this.state)) return;
    if (this.phase !== 'result' && this.phase !== 'ready') return;
    const pot = this.state.turnPot;
    this.state = bank(this.state);
    this.view.announce(`${this.seat?.name} banks ${pot}.`);
    this.toHandover(null, pot);
  }

  private toHandover(bust: RollResult | null, banked = 0): void {
    if (!this.state) return;
    const state = this.state;
    const seat = state.seats[state.currentSeat]!;
    this.phase = state.phase === 'gameOver' ? 'over' : 'handover';
    this.refresh();
    const last = state.history.at(-1);
    let summary: string;
    if (bust?.kind === 'tangled') summary = `Tangled! ${seat.name} loses ${last?.lost ?? 0} and drops to 0.`;
    else if (bust) summary = `Scattered. ${seat.name} loses ${last?.lost ?? 0} from the pot.`;
    else summary = `${seat.name} banks ${banked}, now on ${state.scores[state.currentSeat]}.`;

    if (state.phase === 'gameOver') {
      this.view.showHandover(state, { nextSeat: state.winner ?? state.currentSeat, summary, buttonText: 'Rematch', gameOver: true });
      return;
    }
    const nextIndex = (state.currentSeat + 1) % state.seats.length;
    const next = state.seats[nextIndex]!;
    this.view.showHandover(state, {
      nextSeat: nextIndex,
      summary,
      buttonText: next.kind === 'cpu' ? `${next.name} is throwing…` : 'Take the wolves',
    });
    if (next.kind === 'cpu') this.later(() => this.takeTurn(), 1600);
  }

  rematch(): void {
    if (this.setup) this.start(this.setup);
  }

  // ---------- computer seats (placeholder brain) ----------

  private cpuThrow(): void {
    if (this.humanTurn || this.phase === 'tumbling') return;
    // Computer seats auto-roll, so they throw with the same calibrated odds as the button.
    this.throwDice(autoRollInput(Math.random));
  }

  private cpuDecide(): void {
    if (!this.state || this.humanTurn || this.phase !== 'result') return;
    const score = this.state.scores[this.state.currentSeat]!;
    const pot = this.state.turnPot;
    if (pot >= CPU_BANK_AT || score + pot >= this.state.targetScore) this.bank();
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
      }
      this.scene.sync(this.world);
      if (rested) this.onSettled(this.world.read());
    }
    if (this.phase === 'holding' && this.world) {
      this.world.hold(this.hand.x, this.hand.z, now / 1000);
      this.scene.sync(this.world);
    }
    this.updateCharge(now);
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
      // On a wolf: pick both up and throw them by hand. Elsewhere: drag to sling them.
      if (this.scene.pickDie(e.clientX, e.clientY) !== null) {
        this.grabDice(e.clientX, e.clientY);
        return;
      }
      this.dragStart = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.phase === 'holding') return this.moveHand(e.clientX, e.clientY);
      if (!this.dragStart) return;
      const aim = this.dragAim(e.clientX, e.clientY);
      const from = this.scene.pick(this.dragStart.x, this.dragStart.y);
      if (!aim || !from) return this.scene.showAim(null);
      const len = 2 + aim.power * 6;
      this.scene.showAimFrom(from, aim.angle, len);
    });
    const release = (e: PointerEvent) => {
      if (this.phase === 'holding') return this.releaseDice();
      if (!this.dragStart) return;
      const aim = this.dragAim(e.clientX, e.clientY);
      this.dragStart = null;
      this.scene.showAim(null);
      if (aim) this.throwDice(aim);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', () => {
      if (this.phase === 'holding') this.releaseDice();
      this.dragStart = null;
      this.scene.showAim(null);
    });

    window.addEventListener('keydown', (e) => {
      if (this.phase === 'setup' || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.view.toggleScoreCard();
        return;
      }
      if (e.code === 'Space') {
        if (e.target instanceof HTMLButtonElement) return; // let buttons activate normally
        e.preventDefault();
        if (this.phase === 'handover' && this.humanNext()) this.takeTurn();
        else if (this.canThrowNow() && this.chargeStart === null && !e.repeat) this.chargeStart = performance.now();
        return;
      }
      if (e.key === 'b' || e.key === 'B') this.bank();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!this.canThrowNow()) return;
        e.preventDefault();
        const delta = (e.key === 'ArrowLeft' ? -1 : 1) * (6 * Math.PI) / 180;
        this.aimAngle = Math.max(DEFAULT_ANGLE - MAX_AIM, Math.min(DEFAULT_ANGLE + MAX_AIM, this.aimAngle + delta));
        this.view.announce(`Aim ${Math.round(((this.aimAngle - DEFAULT_ANGLE) * 180) / Math.PI)} degrees`);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space' || this.chargeStart === null) return;
      const held = (performance.now() - this.chargeStart) / 1000;
      this.chargeStart = null;
      this.scene.showAim(null);
      this.throwDice({ angle: this.aimAngle, power: Math.min(1, 0.25 + held / 1.2) });
    });
    window.addEventListener('resize', () => this.scene.resize());
  }

  private humanNext(): boolean {
    if (!this.state) return false;
    if (this.state.phase === 'awaitingRoll') return this.humanTurn; // first turn of the game
    const next = this.state.seats[(this.state.currentSeat + 1) % this.state.seats.length]!;
    return next.kind === 'human';
  }

  /** Charge meter while Space is held: shown as the aim line growing. */
  private updateCharge(now: number): void {
    if (this.chargeStart === null) return;
    const power = Math.min(1, 0.25 + (now - this.chargeStart) / 1200);
    const from = this.scene.pick(window.innerWidth / 2, window.innerHeight * 0.72);
    if (!from) return;
    const len = 2 + power * 6;
    this.scene.showAimFrom(from, this.aimAngle, len);
  }

  /** Convert a drag to a throw: drag away from yourself to throw, length sets power. */
  private dragAim(x: number, y: number): { angle: number; power: number } | null {
    if (!this.dragStart) return null;
    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;
    const len = Math.hypot(dx, dy);
    if (len < 24 || dy > -8) return null; // too short, or dragged toward the player
    const angle = Math.atan2(dy, dx);
    const clamped = Math.max(DEFAULT_ANGLE - MAX_AIM, Math.min(DEFAULT_ANGLE + MAX_AIM, angle));
    return { angle: clamped, power: Math.min(1, len / 260) };
  }

  // ---------- helpers ----------

  private refresh(): void {
    if (!this.state) return;
    this.view.setState(this.state);
    const human = this.humanTurn;
    const ready = this.phase === 'ready' || this.phase === 'result';
    const awaiting = this.state.phase === 'awaitingRoll';
    let hint = '';
    if (this.phase === 'tumbling') hint = 'Tumbling…';
    else if (this.phase === 'holding') hint = 'Flick and let go to throw.';
    else if (ready && awaiting && human) {
      hint = this.state.turnPot > 0 ? 'Roll again, or bank what you have.' : 'Grab the wolves and fling them, or press Auto-roll.';
    } else if (ready && !human) hint = `${this.seat?.name} is thinking…`;
    this.view.update(this.state, {
      canRoll: human && ready && awaiting,
      canBank: human && ready && canBank(this.state),
      busy: this.phase === 'tumbling',
      hint,
    });
  }

  /** Auto-roll button: the calibrated throw profile, so its odds match the target table. */
  rollButton(): void {
    if (!this.canThrowNow()) return;
    this.throwDice(autoRollInput(Math.random));
  }

  private later(fn: () => void, ms: number): void {
    const wait = this.debug.fast ? Math.min(ms, 50) : reduceMotion() ? Math.min(ms, 600) : ms;
    this.timers.push(window.setTimeout(fn, wait));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
