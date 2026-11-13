import type { SculptPart, V3 } from '../sculpt/sdf';
import type { AnimalDefinition, BodyPart } from './body';
import { DIREWOLVES, type DirewolfDesign } from './direwolves';
import { WOLF_SCORING } from './wolf-scoring';
import type { AnimalScoring } from '../rules/animal';

/** Density of the lower legs relative to the body. */
export const FOOT_WEIGHT = 7;
/** Head, ears and tail are carved hollow-light so the wolf is bottom-heavy. */
export const LIGHT = 0.4;

/** Unit directions used to sample a sphere or ellipsoid for its hull. */
const DIRS: V3[] = (() => {
  const out: V3[] = [];
  for (let i = 0; i < 26; i++) {
    // Fibonacci sphere: evenly spread points.
    const y = 1 - (2 * (i + 0.5)) / 26;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return out;
})();

function partPoints(p: SculptPart): V3[] {
  if (p.kind === 'ellipsoid') return DIRS.map((d) => [p.c[0] + d[0] * p.r[0], p.c[1] + d[1] * p.r[1], p.c[2] + d[2] * p.r[2]]);
  const sphere = (c: V3, r: number): V3[] => DIRS.map((d) => [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
  return [...sphere(p.a, p.ra), ...sphere(p.b, p.rb)];
}

/** Collapse the sculpt into one convex hull per group: torso, head, muzzle, each ear, leg segment and tail link. */
export function colliderParts(design: DirewolfDesign): BodyPart[] {
  const groups = new Map<string, V3[]>();
  for (const part of design.parts) {
    const key = part.group ?? 'misc';
    groups.set(key, [...(groups.get(key) ?? []), ...partPoints(part).map(([x, y, z]): V3 => [x, y, z * design.width])]);
  }
  // Weighted lower legs, like a figure die with a heavy base: it gives the wolf a fair chance of landing on its feet.
  const density = (key: string) => (/^leg\dl$/.test(key) ? FOOT_WEIGHT : /^(head|muzzle)/.test(key) ? (design.headWeight ?? LIGHT) : /^(ear|tail)/.test(key) ? LIGHT : 1);
  const hulls: BodyPart[] = [...groups].map(([key, points]) => ({ kind: 'hull' as const, points, density: density(key) }));
  // A flat pad along the spine, tucked just inside the fur, so a wolf can rest on its back.
  const torso = groups.get('torso') ?? [];
  const top = Math.max(...torso.map((p) => p[1]));
  const xs = torso.map((p) => p[0]);
  const x0 = Math.min(...xs) + 0.12;
  const x1 = Math.max(...xs) - 0.12;
  const pad: V3[] = [];
  for (const x of [x0, x1]) for (const z of [-0.12, 0.12]) for (const y of [top - 0.05, top - 0.015]) pad.push([x, y, z]);
  hulls.push({ kind: 'hull', points: pad });
  return hulls;
}

/** Every direwolf scores from the same table; what differs is how often each pose lands. */
function scoringFor(design: DirewolfDesign): AnimalScoring {
  return { ...WOLF_SCORING, id: design.id, name: design.name, plural: `${design.name}s` };
}

function toAnimal(design: DirewolfDesign): AnimalDefinition {
  return {
    scoring: scoringFor(design),
    parts: colliderParts(design),
    palette: { body: design.coat.base, accent: design.coat.saddle },
    markAt: design.markAt,
    pitch: design.pitch,
  };
}

export const DIREWOLF_ANIMALS: readonly AnimalDefinition[] = DIREWOLVES.map(toAnimal);
