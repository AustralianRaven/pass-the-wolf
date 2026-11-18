import type { BodyPart, Vec3 } from './body';

/**
 * The shared hitbox every animal rolls on: an invisible pig, modelled on the classic
 * pig-shaped die. Its shape alone sets the odds, so it is tuned once against the target
 * table (docs/calibration.md) and every animal, wolf or otherwise, is display-only and
 * fitted inside it.
 *
 * Body frame: snout +X, back +Y, marked flank +Z, feet on y = 0.
 */
export interface PigTune {
  /** Body ellipsoid radii: [length, height, width]. */
  readonly body: readonly [number, number, number];
  /** Height of the body's centre above the floor. */
  readonly bodyY: number;
  /** Body moved forward over the legs (x): less rump behind the hind legs to sit back on. */
  readonly bodyX: number;
  /** Leg radius and how far the four legs sit from the centre: [x, z]. */
  readonly legR: number;
  readonly legAt: readonly [number, number];
  /** Hind legs' distance behind the centre (x). Further forward, the pig sits back (Howl) less often. */
  readonly hindX: number;
  /** Tail nub radius: the third point a sitting pig rests on. 0 = no tail. */
  readonly tailR: number;
  /** Snout: radius and how far it reaches forward past the body. */
  readonly snoutR: number;
  readonly snoutLength: number;
  /** Ear flaps: how far out (z) and up they stick; they are what a leaning pig props on. */
  readonly earOut: number;
  readonly earUp: number;
  /** Half-size of a flat seat under the rump, for sitting snout-up (Howl). 0 = none. */
  readonly seat: number;
  /** Shift the body toward the marked flank (+Z): it then lands mark-down (plain side up) more often. */
  readonly bodyShift: number;
  /** Leg density relative to the body: heavier legs land it on its feet more often. */
  readonly legWeight: number;
  /** Snout and ear density: heavier tips it snout-first more often. */
  readonly headWeight: number;
}

/** Tuned against the target table; see docs/calibration.md for the runs behind these numbers. */
export const PIG_TUNE: PigTune = {
  body: [0.5, 0.26, 0.29],
  bodyY: 0.38,
  bodyX: 0.07,
  legR: 0.07,
  legAt: [0.255, 0.17],
  hindX: 0.33,
  tailR: 0,
  snoutR: 0.11,
  snoutLength: 0.14,
  earOut: 0.1,
  earUp: 0.12,
  seat: 0,
  bodyShift: 0,
  legWeight: 1.15,
  headWeight: 1.5,
};

/** Evenly spread unit directions (a Fibonacci sphere). */
function sphereDirs(n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return out;
}
/** Dense enough that the body rolls like a smooth egg, with no flat facets to rest on. */
const BODY_DIRS = sphereDirs(240);

/** Points around a circle in the YZ plane at a given x: a disc, for flat-ended cylinders. */
function disc(x: number, y: number, z: number, r: number, n = 16): Vec3[] {
  return Array.from({ length: n }, (_, i): Vec3 => {
    const a = (i / n) * Math.PI * 2;
    return [x, y + Math.cos(a) * r, z + Math.sin(a) * r];
  });
}

/** Points around a horizontal circle (XZ plane) at height y. */
function ring(x: number, y: number, z: number, r: number, n = 12): Vec3[] {
  return Array.from({ length: n }, (_, i): Vec3 => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  });
}

/** Build the pig hitbox from its tuning. Every part is invisible: only the debug view draws it. */
export function pigHitbox(t: PigTune = PIG_TUNE): BodyPart[] {
  const [bx, by, bz] = t.body;
  const cz = t.bodyShift;
  const parts: BodyPart[] = [];
  // Round body.
  parts.push({ kind: 'hull', points: BODY_DIRS.map((d): Vec3 => [t.bodyX + d[0] * bx, t.bodyY + d[1] * by, cz + d[2] * bz]), invisible: true });
  // Four short, flat-footed legs.
  const bellyY = t.bodyY - by * 0.6;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const x = sx > 0 ? t.legAt[0] : -t.hindX;
      const z = cz + sz * t.legAt[1];
      parts.push({ kind: 'hull', points: [...ring(x, 0, z, t.legR), ...ring(x, bellyY, z, t.legR * 1.1)], density: t.legWeight, invisible: true });
    }
  }
  // Snout: a flat-ended cylinder, the face a snouting pig stands on.
  const sy = t.bodyY + by * 0.15;
  const s0 = t.bodyX + bx * 0.8;
  parts.push({ kind: 'hull', points: [...disc(s0, sy, cz, t.snoutR), ...disc(s0 + t.snoutLength, sy, cz, t.snoutR * 0.85)], density: t.headWeight, invisible: true });
  // Ear flaps: thin wedges out and up from the top of the head.
  for (const sz of [1, -1]) {
    const base: Vec3 = [t.bodyX + bx * 0.55, t.bodyY + by * 0.8, cz + sz * 0.06];
    const tip: Vec3 = [t.bodyX + bx * 0.7, t.bodyY + by * 0.8 + t.earUp, cz + sz * (0.06 + t.earOut)];
    parts.push({
      kind: 'hull',
      points: [base, [base[0] - 0.08, base[1], base[2]], [base[0], base[1] - 0.02, base[2] + sz * 0.02], tip, [tip[0] - 0.03, tip[1] - 0.01, tip[2]]],
      density: t.headWeight,
      invisible: true,
    });
  }
  // Curly tail nub.
  if (t.tailR > 0) {
    parts.push({ kind: 'hull', points: sphereDirs(20).map((d): Vec3 => [t.bodyX - bx - 0.02 + d[0] * t.tailR, t.bodyY + by * 0.3 + d[1] * t.tailR, cz + d[2] * t.tailR]), invisible: true });
  }
  // Optional seat: a flat pad across the rump to sit back on, snout to the sky.
  if (t.seat > 0) {
    const seat: Vec3[] = [];
    for (const y of [t.bodyY - t.seat, t.bodyY + t.seat]) for (const z of [-t.seat, t.seat]) for (const x of [t.bodyX - bx - 0.01, t.bodyX - bx + 0.03]) seat.push([x, y, cz + z]);
    parts.push({ kind: 'hull', points: seat, invisible: true });
  }
  return parts;
}

export const PIG_HITBOX: readonly BodyPart[] = pigHitbox();
