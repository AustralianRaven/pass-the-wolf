import type { AnimalScoring } from './animal';
import { ALPHA_POINTS, DEN_POINTS, DOUBLE_MULTIPLIER } from './constants';
import { isSidePose, type GenericPose, type ScoringPose } from './poses';

export interface DieResult {
  readonly animal: AnimalScoring;
  readonly pose: GenericPose;
}

/** What the physics layer reports once both dice are at rest. */
export interface RollOutcome {
  readonly dice: readonly [DieResult, DieResult];
  /** The two dice rest in contact with each other. */
  readonly touching: boolean;
  /** One die rests on top of the other (implies touching). */
  readonly stacked: boolean;
}

export type RollKind = 'score' | 'den' | 'double' | 'alpha' | 'scattered' | 'tangled';

export interface RollResult {
  readonly kind: RollKind;
  readonly points: number;
  /** Human-readable result, e.g. "Double Howl" or "Sniff + Prowl". */
  readonly label: string;
  /** Ends the turn and loses the turn pot. */
  readonly bust: boolean;
  /** Also wipes the player's banked score. */
  readonly wipesBank: boolean;
}

const result = (kind: RollKind, points: number, label: string, bust = false, wipesBank = false): RollResult => ({
  kind,
  points,
  label,
  bust,
  wipesBank,
});

export function scoreRoll(outcome: RollOutcome): RollResult {
  const [a, b] = outcome.dice;

  if (outcome.stacked) return result('alpha', ALPHA_POINTS, 'Alpha');
  if (outcome.touching) return result('tangled', 0, 'Tangled', true, true);

  const aSide = isSidePose(a.pose);
  const bSide = isSidePose(b.pose);

  if (aSide && bSide) {
    return a.pose === b.pose
      ? result('den', DEN_POINTS, 'Den')
      : result('scattered', 0, 'Scattered', true);
  }

  if (aSide || bSide) {
    const scorer = aSide ? b : a;
    const pose = scorer.pose as ScoringPose;
    return result('score', scorer.animal.points[pose], scorer.animal.poseNames[pose]);
  }

  const aPose = a.pose as ScoringPose;
  const bPose = b.pose as ScoringPose;
  const aName = a.animal.poseNames[aPose];
  const bName = b.animal.poseNames[bPose];
  const sum = a.animal.points[aPose] + b.animal.points[bPose];

  if (aPose === bPose) {
    const label = aName === bName ? `Double ${aName}` : `Double: ${aName} + ${bName}`;
    return result('double', sum * DOUBLE_MULTIPLIER, label);
  }
  return result('score', sum, `${aName} + ${bName}`);
}
