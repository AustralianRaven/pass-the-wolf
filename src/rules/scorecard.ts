import type { GameState, TurnRecord } from './game';

export interface ScoreCardRow {
  readonly round: number;
  /** One cell per seat; null when that seat has not played the round yet. */
  readonly cells: readonly (TurnRecord | null)[];
}

/** Rounds × seats view of the game history, for the score card. */
export function buildScoreCard(state: GameState): ScoreCardRow[] {
  const rounds = state.history.length ? Math.max(...state.history.map((t) => t.round)) : 0;
  const rows: ScoreCardRow[] = [];
  for (let round = 1; round <= rounds; round++) {
    rows.push({
      round,
      cells: state.seats.map((_, seatIndex) => state.history.find((t) => t.round === round && t.seatIndex === seatIndex) ?? null),
    });
  }
  return rows;
}
