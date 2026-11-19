import type { AnimalScoring } from '../rules/animal';

export type Vec3 = readonly [number, number, number];

/**
 * One convex piece of an animal die. The physics collider and the rendered mesh
 * are both built from this list, so they can never drift apart.
 *
 * Body frame: the animal faces +X, its back points +Y, and its marked flank faces +Z.
 */
export type BodyPart =
  | { readonly kind: 'capsule'; readonly from: Vec3; readonly to: Vec3; readonly radius: number; readonly density?: number }
  | { readonly kind: 'ball'; readonly at: Vec3; readonly radius: number; readonly density?: number }
  | { readonly kind: 'box'; readonly at: Vec3; readonly half: Vec3; readonly density?: number }
  /** Convex hull of a point cloud (used for sculpted animals). */
  | { readonly kind: 'hull'; readonly points: readonly Vec3[]; readonly density?: number; readonly invisible?: boolean };

export interface AnimalPalette {
  /** Main carved-wood colour. */
  readonly body: string;
  /** Darker accent for nose, ears and the flank mark. */
  readonly accent: string;
}

export interface AnimalDefinition {
  readonly scoring: AnimalScoring;
  /** The physics hitbox. Display-only animals share the pig hitbox (src/animals/pig-hitbox.ts). */
  readonly parts: readonly BodyPart[];
  /** How the visible model sits inside the hitbox: a uniform scale, then an offset in body units. */
  readonly fit?: { readonly scale: number; readonly offset: Vec3 };
  /**
   * The visible model as convex point clouds in the body frame, fit applied. Tangled and Alpha
   * are judged on these, so a landing scores what the player sees, not the hidden hitbox.
   * Omitted, the hitbox stands in.
   */
  readonly silhouette?: readonly (readonly Vec3[])[];
  readonly palette: AnimalPalette;
  /** Where the flank mark sits, on the +Z side of the body. */
  readonly markAt: Vec3;
  /** Shown in the dice picker. */
  readonly pitch?: string;
}
