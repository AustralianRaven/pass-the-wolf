import type { SculptPart, V3 } from '../sculpt/sdf';


/**
 * The wolf die's sculpt: a smooth union of parts plus a painted coat.
 * Body frame matches the dice: nose +X, back +Y, marked flank +Z, paws near y = 0.
 */
export interface Coat {
  /** Main body colour. */
  readonly base: string;
  /** Darker saddle along the back, ear tips and tail tip. */
  readonly saddle: string;
  /** Lighter belly, inner legs, muzzle and cheeks. */
  readonly under: string;
  /** Random grizzle flecks mixed into the fur, 0 to 1. */
  readonly grizzle: number;
  /** Colour of the moon mark painted on the +Z flank. */
  readonly mark: string;
}

export interface WolfDesign {
  readonly id: string;
  readonly name: string;
  readonly pitch: string;
  readonly parts: readonly SculptPart[];
  readonly fur: number;
  readonly coat: Coat;
  readonly eyes: readonly V3[];
  /** Points used to colour the face: nose tip and head centre. */
  readonly nose: V3;
  readonly head: V3;
  /** Neck base and head centre: where the seat-coloured collar sits. */
  readonly neck: readonly [V3, V3];
  /** Centre of the flank mark on the +Z side (before width scaling). */
  readonly markAt: V3;
  /** Width (Z) scale for mesh and collider: tunes how often this wolf lands on its side. */
  readonly width: number;
  /** Optional density of the head and muzzle (default: carved light, 0.4). */
  readonly headWeight?: number;
}

interface Leg {
  readonly top: V3;
  readonly mid: V3;
  readonly low: V3;
  readonly paw: V3;
  readonly r: readonly [number, number, number];
}

interface Pose {
  readonly hip: V3;
  readonly chest: V3;
  readonly hipR: number;
  readonly chestR: number;
  readonly brisket: V3;
  readonly neckBase: V3;
  readonly head: V3;
  readonly headR: V3;
  readonly snoutTip: V3;
  readonly snoutR: readonly [number, number];
  readonly earBase: number;
  readonly earTip: V3;
  readonly earR: number;
  readonly ruff: V3;
  readonly ruffR: V3;
  readonly ruffFur: number;
  readonly legs: readonly [Leg, Leg, Leg, Leg];
  readonly tail: readonly V3[];
  readonly tailR: readonly number[];
  readonly hackles?: { readonly c: V3; readonly r: V3 };
  /** Thick fur pads over the ribs. Off for a sleek wolf. */
  readonly flankFur?: boolean;
}

const mirror = (v: V3): V3 => [v[0], v[1], -v[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function leg(top: V3, mid: V3, low: V3, paw: V3, r: [number, number, number]): Leg {
  return { top, mid, low, paw, r };
}

function build(p: Pose): { parts: SculptPart[]; eyes: V3[]; nose: V3; neck: [V3, V3]; markAt: V3 } {
  const parts: SculptPart[] = [];
  // Torso: hip to chest, a belly tuck and a deep brisket.
  parts.push({ kind: 'cone', a: p.hip, b: p.chest, ra: p.hipR, rb: p.chestR, blend: 0.08, group: 'torso' });
  parts.push({ kind: 'ellipsoid', c: add(lerp(p.hip, p.chest, 0.45), [0, 0.02, 0]), r: [0.26, p.hipR * 0.72, p.hipR * 0.85], blend: 0.08, group: 'torso' });
  parts.push({ kind: 'ellipsoid', c: p.brisket, r: [0.13, 0.15, p.chestR * 0.75], blend: 0.07, group: 'torso' });
  // Thick flank fur over the ribs. It also makes a side landing rock, which keeps the dice lively.
  const flank: V3 = add(lerp(p.hip, p.chest, 0.5), [0, -0.01, (p.hipR + p.chestR) * 0.5 + 0.045]);
  if (p.flankFur !== false) {
    parts.push({ kind: 'ellipsoid', c: flank, r: [0.12, 0.045, 0.07], blend: 0.07, fur: 1.8, group: 'flankL' });
    parts.push({ kind: 'ellipsoid', c: mirror(flank), r: [0.12, 0.045, 0.07], blend: 0.07, fur: 1.8, group: 'flankR' });
  }
  if (p.hackles) parts.push({ kind: 'ellipsoid', c: p.hackles.c, r: p.hackles.r, blend: 0.08, fur: 2.2, group: 'torso' });

  // Neck, ruff, head.
  parts.push({ kind: 'cone', a: p.neckBase, b: p.head, ra: p.chestR * 0.72, rb: p.headR[1] * 0.95, blend: 0.06, group: 'head' });
  parts.push({ kind: 'ellipsoid', c: p.ruff, r: p.ruffR, blend: 0.09, fur: p.ruffFur, group: 'head' });
  parts.push({ kind: 'ellipsoid', c: p.head, r: p.headR, blend: 0.05, group: 'head' });

  // Muzzle: a tapering snout, a jaw under it, a nose pad and heavy brows.
  const muzzleStart = lerp(p.head, p.snoutTip, 0.28);
  parts.push({ kind: 'cone', a: muzzleStart, b: p.snoutTip, ra: p.snoutR[0], rb: p.snoutR[1], blend: 0.04, fur: 0.3, group: 'muzzle' });
  const jawDrop: V3 = [0, -p.snoutR[0] * 0.7, 0];
  parts.push({
    kind: 'cone',
    a: add(muzzleStart, jawDrop),
    b: add(lerp(muzzleStart, p.snoutTip, 0.8), [0, -p.snoutR[1] * 0.9, 0]),
    ra: p.snoutR[0] * 0.7,
    rb: p.snoutR[1] * 0.6,
    blend: 0.03,
    fur: 0.3,
    group: 'muzzle',
  });
  const nose = add(p.snoutTip, [0.012, 0.006, 0]);
  parts.push({ kind: 'ellipsoid', c: nose, r: [0.026, 0.022, 0.028], blend: 0.015, fur: 0, group: 'muzzle' });
  const toTip: V3 = [p.snoutTip[0] - p.head[0], p.snoutTip[1] - p.head[1], 0];
  const brow = add(p.head, [toTip[0] * 0.35, p.headR[1] * 0.55 + toTip[1] * 0.35, p.headR[2] * 0.45]);
  parts.push({ kind: 'ellipsoid', c: brow, r: [0.045, 0.026, 0.032], blend: 0.03, fur: 0.4, group: 'head' });
  parts.push({ kind: 'ellipsoid', c: mirror(brow), r: [0.045, 0.026, 0.032], blend: 0.03, fur: 0.4, group: 'head' });
  // Cheek fur flaring back from the jaw.
  const cheek = add(p.head, [-p.headR[0] * 0.25, -p.headR[1] * 0.25, p.headR[2] * 0.75]);
  parts.push({ kind: 'ellipsoid', c: cheek, r: [0.07, 0.06, 0.04], blend: 0.05, fur: 1.6, group: 'head' });
  parts.push({ kind: 'ellipsoid', c: mirror(cheek), r: [0.07, 0.06, 0.04], blend: 0.05, fur: 1.6, group: 'head' });

  // Ears: pointed cones set wide on the skull.
  const earBase: V3 = add(p.head, [-p.headR[0] * 0.35, p.headR[1] * 0.75, p.earBase]);
  const earTip: V3 = add(earBase, p.earTip);
  parts.push({ kind: 'cone', a: earBase, b: earTip, ra: p.earR, rb: 0.006, blend: 0.025, fur: 0.2, group: 'earL' });
  parts.push({ kind: 'cone', a: mirror(earBase), b: mirror(earTip), ra: p.earR, rb: 0.006, blend: 0.025, fur: 0.2, group: 'earR' });

  // Legs: upper, lower, pastern and a broad paw.
  p.legs.forEach((l, i) => {
    // Upper and lower leg are separate hulls so a bent knee stays bent in the collider.
    const upper = `leg${i}u`;
    const lower = `leg${i}l`;
    parts.push({ kind: 'cone', a: l.top, b: l.mid, ra: l.r[0], rb: l.r[1], blend: 0.06, group: upper });
    parts.push({ kind: 'cone', a: l.mid, b: l.low, ra: l.r[1], rb: l.r[2], blend: 0.03, fur: 0.5, group: lower });
    parts.push({ kind: 'cone', a: l.low, b: l.paw, ra: l.r[2], rb: l.r[2] * 0.95, blend: 0.02, fur: 0.3, group: lower });
    parts.push({ kind: 'ellipsoid', c: add(l.paw, [0.025, 0.002, 0]), r: [0.055, 0.03, 0.042], blend: 0.025, fur: 0.2, group: lower });
  });

  // Tail: a bushy chain, thickest in the middle.
  for (let i = 0; i < p.tail.length - 1; i++) {
    parts.push({ kind: 'cone', a: p.tail[i]!, b: p.tail[i + 1]!, ra: p.tailR[i]!, rb: p.tailR[i + 1]!, blend: 0.05, fur: 2.2, group: `tail${i}` });
  }

  // Eyes: set into the face where brow meets muzzle.
  const eye: V3 = add(p.head, [toTip[0] * 0.42 + 0.02, p.headR[1] * 0.25 + toTip[1] * 0.42, p.headR[2] * 0.62]);
  const mid = lerp(p.hip, p.chest, 0.45);
  const markAt: V3 = [mid[0] + 0.02, mid[1] - 0.01, (p.hipR + p.chestR) * 0.5 + 0.08];
  return { parts, eyes: [eye, mirror(eye)], nose, neck: [p.neckBase, p.head], markAt };
}

const W = 0.115; // half the track width (legs at ±W): a slightly wide stance keeps the dice playable

/** Four legs from a front and a hind chain on the +Z side, mirrored to -Z. */
function pairs(front: Leg, hind: Leg, frontFar?: Leg, hindFar?: Leg): [Leg, Leg, Leg, Leg] {
  const m = (l: Leg): Leg => ({ ...l, top: mirror(l.top), mid: mirror(l.mid), low: mirror(l.low), paw: mirror(l.paw) });
  return [front, frontFar ?? m(front), hind, hindFar ?? m(hind)];
}

// ---------- The winter wolf: proud and pale, head high, chest out, a great mane and tail raised ----------
const winter = build({
  hip: [-0.29, 0.48, 0],
  chest: [0.2, 0.52, 0],
  hipR: 0.14,
  chestR: 0.19,
  brisket: [0.28, 0.38, 0],
  neckBase: [0.3, 0.62, 0],
  head: [0.44, 0.84, 0],
  headR: [0.115, 0.1, 0.095],
  snoutTip: [0.66, 0.82, 0],
  snoutR: [0.06, 0.033],
  earBase: 0.05,
  earTip: [0.0, 0.12, 0.012],
  earR: 0.037,
  ruff: [0.31, 0.63, 0],
  ruffR: [0.15, 0.18, 0.15],
  ruffFur: 2.4,
  flankFur: false,
  legs: pairs(
    leg([0.27, 0.45, W], [0.29, 0.28, W], [0.29, 0.09, W], [0.3, 0.03, W], [0.072, 0.047, 0.036]),
    leg([-0.29, 0.44, W], [-0.21, 0.27, W + 0.005], [-0.34, 0.13, W], [-0.32, 0.03, W], [0.095, 0.05, 0.036]),
  ),
  tail: [[-0.41, 0.52, 0], [-0.55, 0.56, 0], [-0.64, 0.66, 0], [-0.66, 0.74, 0]],
  tailR: [0.05, 0.075, 0.06, 0.03],
});

export const WINTER_WOLF_DESIGN: WolfDesign = {
  id: 'winter',
  name: 'Winter Wolf',
  pitch: 'Pale coat, thick ruff, steady on its feet.',
  ...winter,
  head: [0.44, 0.84, 0],
  fur: 0.013,
  width: 1,
  coat: { base: '#e3e0d8', saddle: '#a9a69f', under: '#f6f3ec', grizzle: 0.15, mark: '#4e3a86' },
};

/** Every wolf design the game can carve, in picker order. */
export const WOLF_DESIGNS: readonly WolfDesign[] = [WINTER_WOLF_DESIGN];
