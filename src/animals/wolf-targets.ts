import type { GenericPose } from '../rules/poses';

/**
 * The odds every animal die is tuned to (issue #1): Kern (2006) single-pig odds, with the
 * sitting Howl added as the rarest pose. Percent per die, auto-roll throws only.
 */
export const POSE_TARGETS: Readonly<Record<GenericPose, number>> = {
  sideMarkDown: 34.8,
  sideMarkUp: 30.0,
  back: 22.4,
  upright: 8.8,
  noseDown: 3.0,
  lean: 0.6,
  tailDown: 0.4,
};

/**
 * Percent per throw for the results that need both dice. Alpha (the piggyback) has no rate
 * target: it only has to be possible, which a recorded demo throw proves (tests/unit/demo.test.ts).
 */
export const ROLL_TARGETS = { tangled: 1.6 } as const;

/** A measured value passes when it is within this fraction of its target (±10%). */
export const TOLERANCE = 0.1;
