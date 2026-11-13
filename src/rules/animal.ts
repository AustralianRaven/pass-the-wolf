import type { GenericPose, ScoringPose } from './poses';

/** The scoring half of an animal die: names and points. Geometry lives in src/animals. */
export interface AnimalScoring {
  readonly id: string;
  readonly name: string;
  /** Plural used in copy, e.g. "wolves". */
  readonly plural: string;
  readonly poseNames: Readonly<Record<GenericPose, string>>;
  readonly points: Readonly<Record<ScoringPose, number>>;
}
