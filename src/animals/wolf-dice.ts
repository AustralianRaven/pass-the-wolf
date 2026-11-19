import type { AnimalDefinition, Vec3 } from './body';
import { PIG_HITBOX } from './pig-hitbox';
import { DESIGNS as WOLF_DESIGNS } from './designs';
import type { WolfDesign } from './wolf-design';
import { WOLF_SCORING } from './wolf-scoring';
import type { AnimalScoring } from '../rules/animal';

/** A wolf design's scoring: the shared wolf table under the design's own id and name. */
function scoringFor(design: WolfDesign): AnimalScoring {
  return {
    ...WOLF_SCORING,
    id: design.id,
    name: design.name,
    plural: design.plural ?? `${design.name}s`,
    poseNames: { ...WOLF_SCORING.poseNames, ...design.poseNames },
  };
}

const FIT = { scale: 0.88, offset: [0.02, 0, 0] as Vec3 };

/** 26 unit directions: cube corners, edge midpoints and face centres. */
const DIRECTIONS: readonly Vec3[] = (() => {
  const out: Vec3[] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (!x && !y && !z) continue;
        const l = Math.hypot(x, y, z);
        out.push([x / l, y / l, z / l]);
      }
    }
  }
  return out;
})();

/**
 * The sculpt's parts as convex point clouds, fitted like the rendered model. Each cone becomes
 * the hull of its two end spheres and each ellipsoid a sampled shell, both padded by the fur.
 */
function silhouetteOf(design: WolfDesign): Vec3[][] {
  const w = design.width;
  const fitted = (p: Vec3): Vec3 => [p[0] * FIT.scale + FIT.offset[0], p[1] * FIT.scale + FIT.offset[1], p[2] * w * FIT.scale + FIT.offset[2]];
  return design.parts.map((part) => {
    const fur = design.fur * (part.fur ?? 1) * 0.25;
    if (part.kind === 'cone') {
      return [
        ...DIRECTIONS.map((d) => fitted([part.a[0] + d[0] * (part.ra + fur), part.a[1] + d[1] * (part.ra + fur), part.a[2] + d[2] * (part.ra + fur)])),
        ...DIRECTIONS.map((d) => fitted([part.b[0] + d[0] * (part.rb + fur), part.b[1] + d[1] * (part.rb + fur), part.b[2] + d[2] * (part.rb + fur)])),
      ];
    }
    const [cx, cy, cz] = part.c;
    const [rx, ry, rz] = part.r;
    return DIRECTIONS.map((d) => fitted([cx + d[0] * (rx + fur), cy + d[1] * (ry + fur), cz + d[2] * (rz + fur)]));
  });
}

/**
 * A wolf die: display-only wolf, physics on the shared pig hitbox. The fit shrinks the wolf
 * a little and centres it on the pig's body so it sits inside the hitbox.
 */
function toAnimal(design: WolfDesign): AnimalDefinition {
  return {
    scoring: scoringFor(design),
    parts: PIG_HITBOX,
    fit: FIT,
    silhouette: silhouetteOf(design),
    palette: { body: design.coat.base, accent: design.coat.saddle },
    markAt: design.markAt,
    pitch: design.pitch,
  };
}

export const WOLF_DICE: readonly AnimalDefinition[] = WOLF_DESIGNS.map(toAnimal);
export const WINTER_WOLF: AnimalDefinition = WOLF_DICE[0]!;
