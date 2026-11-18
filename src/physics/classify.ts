import type { GenericPose } from '../rules/poses';

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/** World up (0,1,0) expressed in the body frame: the inverse rotation applied to +Y. */
export function localUp(q: Quat): [number, number, number] {
  const { x, y, z, w } = q;
  // Third row of the rotation matrix = R^T * (0,1,0).
  return [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)];
}

/** Snout this far toward the sky (or the floor) counts as sitting (or nose-down). */
const NOSE_AXIS = 0.6;
/**
 * A die with its snout this far down, tipped at least LEAN_TILT onto a shoulder, is leaning
 * (Pounce). Shallower snout-down tilts are a wolf lying on its side with its nose dipped.
 * Both values sit in gaps between the winter wolf's measured rest states (tools/rests.ts --nose).
 */
const LEAN_NOSE = 0.55;
const LEAN_TILT = 0.5;

/**
 * Classify a resting die by which way world-up points in its body frame.
 * Body frame: nose +X, back +Y, marked flank +Z.
 */
export function classifyPose(q: Quat): GenericPose {
  const [ux, uy, uz] = localUp(q);
  // Snout to the sky: sitting back on the haunches.
  if (ux > NOSE_AXIS) return 'tailDown';
  // Snout to the floor, tipped onto a shoulder: balanced on snout and one foreleg.
  if (ux < -LEAN_NOSE && Math.abs(uz) >= LEAN_TILT) return 'lean';
  if (ux < -NOSE_AXIS) return 'noseDown';
  const ay = Math.abs(uy);
  const az = Math.abs(uz);
  if (ay >= az) return uy > 0 ? 'upright' : 'back';
  return uz > 0 ? 'sideMarkUp' : 'sideMarkDown';
}
