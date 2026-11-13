import { DEFAULT_TARGET_SCORE, MAX_SEATS, MIN_SEATS } from './constants';
import type { RollResult } from './scoring';

export type SeatKind = 'human' | 'cpu';

export interface Seat {
  readonly id: string;
  readonly name: string;
  readonly kind: SeatKind;
  /** Animal ids for the seat's two dice, e.g. ['wolf', 'wolf']. */
  readonly dice: readonly [string, string];
}

export type TurnOutcome = 'banked' | 'scattered' | 'tangled';

/** One finished turn: the source of truth for the score card. */
export interface TurnRecord {
  readonly round: number;
  readonly seatIndex: number;
  readonly rolls: readonly RollResult[];
  readonly outcome: TurnOutcome;
  /** Points added to the bank (0 on a bust). */
  readonly banked: number;
  /** Points lost: the turn pot on a bust, plus the old bank on Tangled. */
  readonly lost: number;
  readonly scoreAfter: number;
}

export type GamePhase = 'awaitingRoll' | 'handover' | 'gameOver';

export interface GameState {
  readonly targetScore: number;
  readonly seats: readonly Seat[];
  readonly scores: readonly number[];
  readonly currentSeat: number;
  /** 1-based round counter; a round ends when every seat has had a turn. */
  readonly round: number;
  readonly phase: GamePhase;
  readonly turnPot: number;
  readonly turnRolls: readonly RollResult[];
  readonly history: readonly TurnRecord[];
  readonly winner: number | null;
}

export interface GameSettings {
  readonly seats: readonly Seat[];
  readonly targetScore?: number;
}

export function newGame(settings: GameSettings): GameState {
  const { seats } = settings;
  const targetScore = settings.targetScore ?? DEFAULT_TARGET_SCORE;
  if (seats.length < MIN_SEATS || seats.length > MAX_SEATS) {
    throw new Error(`A game needs ${MIN_SEATS} to ${MAX_SEATS} seats; got ${seats.length}.`);
  }
  if (!Number.isInteger(targetScore) || targetScore < 1) {
    throw new Error(`Target score must be a positive whole number; got ${targetScore}.`);
  }
  return {
    targetScore,
    seats,
    scores: seats.map(() => 0),
    currentSeat: 0,
    round: 1,
    phase: 'awaitingRoll',
    turnPot: 0,
    turnRolls: [],
    history: [],
    winner: null,
  };
}

function assertPhase(state: GameState, phase: GamePhase, action: string): void {
  if (state.phase !== phase) throw new Error(`Cannot ${action} during phase "${state.phase}".`);
}

function endTurn(state: GameState, outcome: TurnOutcome, rolls: readonly RollResult[], banked: number, newScore: number): GameState {
  const seatIndex = state.currentSeat;
  const lost = outcome === 'banked' ? 0 : state.turnPot + (outcome === 'tangled' ? state.scores[seatIndex]! : 0);
  const scores = state.scores.map((s, i) => (i === seatIndex ? newScore : s));
  const record: TurnRecord = { round: state.round, seatIndex, rolls, outcome, banked, lost, scoreAfter: newScore };
  const won = newScore >= state.targetScore;
  return {
    ...state,
    scores,
    turnPot: 0,
    turnRolls: rolls,
    history: [...state.history, record],
    phase: won ? 'gameOver' : 'handover',
    winner: won ? seatIndex : null,
  };
}

/** Apply a settled roll to the current turn. */
export function applyRoll(state: GameState, roll: RollResult): GameState {
  assertPhase(state, 'awaitingRoll', 'roll');
  const rolls = [...state.turnRolls, roll];
  if (roll.bust) {
    const score = roll.wipesBank ? 0 : state.scores[state.currentSeat]!;
    return endTurn(state, roll.kind === 'tangled' ? 'tangled' : 'scattered', rolls, 0, score);
  }
  return { ...state, turnPot: state.turnPot + roll.points, turnRolls: rolls };
}

export function canBank(state: GameState): boolean {
  return state.phase === 'awaitingRoll' && state.turnPot > 0;
}

/** Bank the turn pot and end the turn. */
export function bank(state: GameState): GameState {
  assertPhase(state, 'awaitingRoll', 'bank');
  if (state.turnPot <= 0) throw new Error('Nothing to bank yet; roll first.');
  const score = state.scores[state.currentSeat]! + state.turnPot;
  return endTurn(state, 'banked', state.turnRolls, state.turnPot, score);
}

/** Pass the dice to the next seat after a handover. */
export function nextTurn(state: GameState): GameState {
  assertPhase(state, 'handover', 'pass the dice');
  const next = (state.currentSeat + 1) % state.seats.length;
  return {
    ...state,
    currentSeat: next,
    round: next === 0 ? state.round + 1 : state.round,
    phase: 'awaitingRoll',
    turnPot: 0,
    turnRolls: [],
  };
}

/** The seat whose turn comes after the current one. */
export function upNext(state: GameState): Seat {
  return state.seats[(state.currentSeat + 1) % state.seats.length]!;
}
