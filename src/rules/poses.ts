/**
 * Generic resting poses shared by every animal die. Each animal names these its own way;
 * the physics layer only ever reports one of these.
 */
export const GENERIC_POSES = ['sideMarkUp', 'sideMarkDown', 'back', 'upright', 'noseDown', 'tailDown'] as const;
export type GenericPose = (typeof GENERIC_POSES)[number];

/** Poses that score on their own. The two side poses only score as a pair (Den). */
export const SCORING_POSES = ['back', 'upright', 'noseDown', 'tailDown'] as const;
export type ScoringPose = (typeof SCORING_POSES)[number];

export function isSidePose(pose: GenericPose): pose is 'sideMarkUp' | 'sideMarkDown' {
  return pose === 'sideMarkUp' || pose === 'sideMarkDown';
}
