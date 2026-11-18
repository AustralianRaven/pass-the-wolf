import type { SculptPart, V3 } from '../sculpt/sdf';
import type { AnimalDefinition, BodyPart } from './body';
import { WOLF_DESIGNS, type WolfDesign } from './wolf-design';
import { WOLF_SCORING } from './wolf-scoring';
import type { AnimalScoring } from '../rules/animal';

/** Density of the lower legs relative to the body. */
export const FOOT_WEIGHT = 7;
/** Head, ears and tail are carved hollow-light so the wolf is bottom-heavy. */
export const LIGHT = 0.4;

/** Evenly spread unit directions (a Fibonacci sphere), used to sample spheres and ellipsoids for hulls. */
function sphereDirs(n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return out;
}
const DIRS = sphereDirs(26);
/** Dense enough that the belly rolls like a smooth egg, with no flat facets to rest on. */
const BELLY_DIRS = sphereDirs(240);

function partPoints(p: SculptPart): V3[] {
  if (p.kind === 'ellipsoid') return DIRS.map((d) => [p.c[0] + d[0] * p.r[0], p.c[1] + d[1] * p.r[1], p.c[2] + d[2] * p.r[2]]);
  const sphere = (c: V3, r: number): V3[] => DIRS.map((d) => [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
  return [...sphere(p.a, p.ra), ...sphere(p.b, p.rb)];
}

/** Collapse the sculpt into one convex hull per group: torso, head, muzzle, each ear, leg segment and tail link. */
export function colliderParts(design: WolfDesign): BodyPart[] {
  const groups = new Map<string, V3[]>();
  for (const part of design.parts) {
    const key = part.group ?? 'misc';
    groups.set(key, [...(groups.get(key) ?? []), ...partPoints(part).map(([x, y, z]): V3 => [x, y, z * design.width])]);
  }
  // Weighted lower legs, like a figure die with a heavy base: it gives the wolf a fair chance of landing on its feet.
  const density = (key: string) => (/^leg\dl$/.test(key) ? (design.tune?.feet ?? FOOT_WEIGHT) : /^(head|muzzle)/.test(key) ? (design.tune?.head ?? design.headWeight ?? LIGHT) : /^(ear|tail)/.test(key) ? LIGHT : 1);
  const hulls: BodyPart[] = [...groups].map(([key, points]) => ({ kind: 'hull' as const, points, density: density(key) }));
  const tune = design.tune ?? {};
  const torso = groups.get('torso') ?? [];
  const xs = torso.map((p) => p[0]);
  // A flat pad along the spine, tucked just inside the fur, so a wolf can rest on its back.
  const top = Math.max(...torso.map((p) => p[1]));
  const sw = tune.spine ?? 0.12;
  const x0 = Math.min(...xs) + 0.12;
  const x1 = Math.max(...xs) - 0.12;
  const pad: V3[] = [];
  for (const x of [x0, x1]) for (const z of [-sw, sw]) for (const y of [top - 0.05, top - 0.015]) pad.push([x, y, z]);
  hulls.push({ kind: 'hull', points: pad, invisible: true });
  // A flat seat under the haunches: the wolf can sit back on it, snout to the sky, to Howl.
  const rump = tune.rump ?? 0;
  if (rump > 0) {
    const rear = Math.min(...xs) - 0.02;
    const seat: V3[] = [];
    for (const y of [0.47 - rump, 0.47 + rump]) for (const z of [-rump, rump]) for (const x of [rear, rear + 0.04]) seat.push([x, y, z * design.width]);
    hulls.push({ kind: 'hull', points: seat, invisible: true });
  }
  // A flat roof over back and head: a high-headed wolf can otherwise only topple off its ears.
  const roof = tune.roof ?? 0;
  if (roof > 0) {
    const plate: V3[] = [];
    const rw = tune.roofWidth ?? 0.14;
    for (const x of [-0.32, 0.5]) for (const z of [-rw, rw]) for (const y of [roof - 0.03, roof]) plate.push([x, y, z]);
    hulls.push({ kind: 'hull', points: plate, invisible: true });
  }
  // A stance plate under the paws, as wide as a pig's footprint.
  const stance = tune.stance ?? 0;
  if (stance > 0) {
    const feet: V3[] = [];
    for (const x of [-0.36, 0.34]) for (const z of [-stance, stance]) for (const y of [0, 0.03]) feet.push([x, y, z]);
    hulls.push({ kind: 'hull', points: feet, invisible: true, density: 4 });
  }
  // The hidden pig: a round belly around the torso. Nobody sees it; it decides how the die rolls.
  const belly = tune.belly;
  if (belly) {
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = torso.reduce((sum, p) => sum + p[1], 0) / Math.max(1, torso.length);
    const cz = tune.bellyShift ?? 0;
    hulls.push({ kind: 'hull', points: BELLY_DIRS.map((d): V3 => [cx + d[0] * belly[0], cy + d[1] * belly[1], cz + d[2] * belly[2]]), invisible: true });
  }
  return hulls;
}

/** A wolf design's scoring: the shared wolf table under the design's own id and name. */
function scoringFor(design: WolfDesign): AnimalScoring {
  return { ...WOLF_SCORING, id: design.id, name: design.name, plural: `${design.name}s` };
}

function toAnimal(design: WolfDesign): AnimalDefinition {
  return {
    scoring: scoringFor(design),
    parts: colliderParts(design),
    palette: { body: design.coat.base, accent: design.coat.saddle },
    markAt: design.markAt,
    pitch: design.pitch,
  };
}

/** Build a die from a design, optionally with different tuning (used by the calibration tools). */
export function wolfDie(design: WolfDesign, tune?: WolfDesign['tune']): AnimalDefinition {
  return toAnimal(tune ? { ...design, tune: { ...design.tune, ...tune } } : design);
}

export const WOLF_DICE: readonly AnimalDefinition[] = WOLF_DESIGNS.map((d) => wolfDie(d));
export const WINTER_WOLF: AnimalDefinition = WOLF_DICE[0]!;
