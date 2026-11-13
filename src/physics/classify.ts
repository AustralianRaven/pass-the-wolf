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

/**
 * Classify a resting die by which body axis points most nearly up.
 * Body frame: nose +X, back +Y, marked flank +Z.
 */
export function classifyPose(q: Quat): GenericPose {
  const [ux, uy, uz] = localUp(q);
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  const az = Math.abs(uz);
  if (ay >= ax && ay >= az) return uy > 0 ? 'upright' : 'back';
  if (az >= ax) return uz > 0 ? 'sideMarkUp' : 'sideMarkDown';
  // Nose pointing up means the die rests on its tail end.
  return ux > 0 ? 'tailDown' : 'noseDown';
}
