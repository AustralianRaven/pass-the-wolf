import odds from './direwolf-odds.json';
import { WOLF_SCORING } from './wolf-scoring';
import type { ScoringPose } from '../rules/poses';

/** Measured odds for one die, from `npm run calibrate` (see docs/calibration.md). */
export interface WolfOdds {
  readonly throws: number;
  readonly posePct: Readonly<Record<string, number>>;
  readonly resultPct: Readonly<Record<string, number>>;
  readonly avgPointsPerRoll: number;
}

const TABLE = odds as Readonly<Record<string, WolfOdds>>;
const SCORING: readonly ScoringPose[] = ['back', 'upright', 'noseDown', 'tailDown'];

/** Why each wolf tumbles the way it does: authored from its build and its measured odds. */
const FLAVOUR: Readonly<Record<string, string>> = {
  warden: 'Built square and steady. A fair shot at everything, and the occasional Sniff.',
  stalker: 'Crouched low, it nearly always lands flat or on its feet. Safe points, but it will almost never Sniff or Howl.',
  frostmane: 'Top-heavy and proud. It tips onto its nose or sits back to Howl far more than any other wolf, rarely plays dead, and scatters more often.',
  runner: 'Its striding legs catch the blanket, so it lands on its feet more than most and can sneak the odd Howl.',
  grizzle: 'That heavy old skull drags the nose down and the broad back loves to roll over. The steadiest scorer, but the Howl is behind him.',
};

export interface Trait {
  readonly pose: ScoringPose | 'scattered';
  readonly label: string;
  /** Percentage-point difference from the pack average. */
  readonly delta: number;
}

export function oddsFor(id: string): WolfOdds | undefined {
  return TABLE[id];
}

export function flavourFor(id: string): string {
  return FLAVOUR[id] ?? '';
}

function packAverage(key: (o: WolfOdds) => number): number {
  const all = Object.values(TABLE);
  return all.reduce((sum, o) => sum + key(o), 0) / Math.max(1, all.length);
}

/** Points at stake per percentage point of this trait. Busting costs roughly a typical pot. */
function weight(t: Trait): number {
  return Math.abs(t.delta) * (t.pose === 'scattered' ? 6 : WOLF_SCORING.points[t.pose]);
}

/**
 * The strategy line for a wolf: how its odds differ from the pack average, ranked by how much
 * each difference is worth (a 1% swing in Howl matters more than a 1% swing in Play Dead).
 * Only differences of at least half a percentage point are worth showing.
 */
export function traitsFor(id: string, max = 3): Trait[] {
  const mine = TABLE[id];
  if (!mine) return [];
  const traits: Trait[] = SCORING.map((pose) => ({
    pose,
    label: WOLF_SCORING.poseNames[pose],
    delta: (mine.posePct[pose] ?? 0) - packAverage((o) => o.posePct[pose] ?? 0),
  }));
  traits.push({
    pose: 'scattered',
    label: 'Scattered',
    delta: (mine.resultPct.scattered ?? 0) - packAverage((o) => o.resultPct.scattered ?? 0),
  });
  return traits
    .filter((t) => Math.abs(t.delta) >= 0.5)
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, max);
}

/** "+3.2% Sniff", "−1.1% Play Dead". Uses a true minus sign. */
export function formatTrait(t: Trait): string {
  const sign = t.delta >= 0 ? '+' : '−';
  return `${sign}${Math.abs(t.delta).toFixed(1)}% ${t.label}`;
}
