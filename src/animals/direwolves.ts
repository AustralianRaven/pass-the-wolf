import type { SculptPart, V3 } from '../sculpt/sdf';


/**
 * Five direwolf candidates. Each is a sculpt (smooth union of parts) plus a painted coat.
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

export interface DirewolfDesign {
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
  parts.push({ kind: 'ellipsoid', c: flank, r: [0.12, 0.045, 0.07], blend: 0.07, fur: 1.8, group: 'flankL' });
  parts.push({ kind: 'ellipsoid', c: mirror(flank), r: [0.12, 0.045, 0.07], blend: 0.07, fur: 1.8, group: 'flankR' });
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

// ---------- 1. Warden: the classic direwolf, four-square and massive ----------
const warden = build({
  hip: [-0.3, 0.47, 0],
  chest: [0.22, 0.48, 0],
  hipR: 0.14,
  chestR: 0.18,
  brisket: [0.27, 0.35, 0],
  neckBase: [0.3, 0.55, 0],
  head: [0.5, 0.7, 0],
  headR: [0.12, 0.1, 0.095],
  snoutTip: [0.73, 0.63, 0],
  snoutR: [0.062, 0.034],
  earBase: 0.055,
  earTip: [-0.02, 0.11, 0.018],
  earR: 0.038,
  ruff: [0.35, 0.57, 0],
  ruffR: [0.16, 0.17, 0.165],
  ruffFur: 2.6,
  legs: pairs(
    leg([0.27, 0.42, W], [0.29, 0.27, W], [0.3, 0.09, W], [0.31, 0.03, W], [0.07, 0.046, 0.036]),
    leg([-0.3, 0.43, W], [-0.22, 0.26, W + 0.005], [-0.35, 0.13, W], [-0.33, 0.03, W], [0.095, 0.05, 0.036]),
  ),
  tail: [[-0.42, 0.5, 0], [-0.54, 0.38, 0], [-0.6, 0.22, 0], [-0.6, 0.12, 0]],
  tailR: [0.05, 0.075, 0.06, 0.03],
});

// ---------- 2. Stalker: crouched, head low, hackles up ----------
const stalker = build({
  hip: [-0.3, 0.42, 0],
  chest: [0.2, 0.39, 0],
  hipR: 0.14,
  chestR: 0.17,
  brisket: [0.24, 0.28, 0],
  neckBase: [0.3, 0.43, 0],
  head: [0.55, 0.45, 0],
  headR: [0.12, 0.095, 0.095],
  snoutTip: [0.78, 0.4, 0],
  snoutR: [0.06, 0.033],
  earBase: 0.06,
  earTip: [-0.035, 0.1, 0.025],
  earR: 0.036,
  ruff: [0.36, 0.46, 0],
  ruffR: [0.14, 0.13, 0.14],
  ruffFur: 2.2,
  hackles: { c: [0.08, 0.53, 0], r: [0.3, 0.04, 0.045] },
  legs: pairs(
    leg([0.25, 0.33, W], [0.36, 0.2, W], [0.33, 0.07, W], [0.36, 0.03, W], [0.064, 0.043, 0.034]),
    leg([-0.3, 0.38, W], [-0.17, 0.22, W + 0.01], [-0.36, 0.11, W], [-0.31, 0.03, W], [0.09, 0.048, 0.035]),
  ),
  tail: [[-0.42, 0.46, 0], [-0.58, 0.42, 0], [-0.72, 0.36, 0]],
  tailR: [0.05, 0.07, 0.035],
});

// ---------- 3. Frostmane: proud alpha, head high, chest out, tail raised ----------
const frostmane = build({
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
  ruff: [0.33, 0.66, 0],
  ruffR: [0.17, 0.2, 0.18],
  ruffFur: 3,
  legs: pairs(
    leg([0.27, 0.45, W], [0.29, 0.28, W], [0.29, 0.09, W], [0.3, 0.03, W], [0.072, 0.047, 0.036]),
    leg([-0.29, 0.44, W], [-0.21, 0.27, W + 0.005], [-0.34, 0.13, W], [-0.32, 0.03, W], [0.095, 0.05, 0.036]),
  ),
  tail: [[-0.41, 0.52, 0], [-0.55, 0.56, 0], [-0.64, 0.66, 0], [-0.66, 0.74, 0]],
  tailR: [0.05, 0.075, 0.06, 0.03],
});

// ---------- 4. Timber Runner: mid-lope, stretched out, tail streaming ----------
const runner = build({
  hip: [-0.33, 0.44, 0],
  chest: [0.22, 0.45, 0],
  hipR: 0.13,
  chestR: 0.17,
  brisket: [0.27, 0.33, 0],
  neckBase: [0.32, 0.52, 0],
  head: [0.56, 0.6, 0],
  headR: [0.115, 0.095, 0.09],
  snoutTip: [0.8, 0.56, 0],
  snoutR: [0.058, 0.032],
  earBase: 0.055,
  earTip: [-0.06, 0.09, 0.02],
  earR: 0.035,
  ruff: [0.37, 0.53, 0],
  ruffR: [0.15, 0.15, 0.15],
  ruffFur: 2,
  legs: pairs(
    // near fore reaching forward, far fore under the body
    leg([0.28, 0.4, W], [0.4, 0.26, W], [0.48, 0.12, W], [0.52, 0.03, W], [0.066, 0.044, 0.034]),
    // near hind driving back, far hind under the body
    leg([-0.33, 0.4, W], [-0.36, 0.24, W], [-0.52, 0.12, W], [-0.56, 0.03, W], [0.09, 0.048, 0.034]),
    leg([0.26, 0.4, -W], [0.25, 0.25, -W], [0.2, 0.1, -W], [0.2, 0.03, -W], [0.066, 0.044, 0.034]),
    leg([-0.31, 0.4, -W], [-0.18, 0.25, -W], [-0.24, 0.1, -W], [-0.2, 0.03, -W], [0.09, 0.048, 0.034]),
  ),
  tail: [[-0.45, 0.46, 0], [-0.62, 0.43, 0], [-0.78, 0.38, 0]],
  tailR: [0.045, 0.065, 0.03],
});

// ---------- 5. Old Grizzle: heavy old wolf, huge head, shaggy coat ----------
const grizzle = build({
  hip: [-0.29, 0.46, 0],
  chest: [0.2, 0.47, 0],
  hipR: 0.15,
  chestR: 0.2,
  brisket: [0.26, 0.33, 0],
  neckBase: [0.3, 0.53, 0],
  head: [0.5, 0.64, 0],
  headR: [0.135, 0.112, 0.11],
  snoutTip: [0.74, 0.57, 0],
  snoutR: [0.07, 0.04],
  earBase: 0.065,
  earTip: [-0.035, 0.085, 0.03],
  earR: 0.04,
  ruff: [0.34, 0.52, 0],
  ruffR: [0.19, 0.2, 0.19],
  ruffFur: 3.4,
  legs: pairs(
    leg([0.26, 0.41, W + 0.01], [0.28, 0.26, W + 0.01], [0.29, 0.09, W + 0.01], [0.3, 0.03, W + 0.01], [0.078, 0.052, 0.04]),
    leg([-0.29, 0.42, W + 0.01], [-0.21, 0.25, W + 0.015], [-0.34, 0.12, W + 0.01], [-0.32, 0.03, W + 0.01], [0.1, 0.055, 0.04]),
  ),
  tail: [[-0.42, 0.48, 0], [-0.53, 0.33, 0], [-0.56, 0.18, 0], [-0.54, 0.1, 0]],
  tailR: [0.06, 0.085, 0.07, 0.035],
});

export const DIREWOLVES: readonly DirewolfDesign[] = [
  {
    id: 'warden',
    width: 1.35,
    name: 'Warden',
    pitch: 'The classic direwolf. Four-square, deep-chested, a heavy ruff and a tail carried low.',
    ...warden,
    head: [0.5, 0.7, 0],
    fur: 0.012,
    coat: { base: '#7d7a74', saddle: '#2f2c29', under: '#d6cdbd', grizzle: 0.35, mark: '#efe6d4' },
  },
  {
    id: 'stalker',
    width: 1.12,
    name: 'Stalker',
    pitch: 'Crouched for the kill. Head low, hackles raised along the spine, tail straight back.',
    ...stalker,
    head: [0.55, 0.42, 0],
    fur: 0.011,
    coat: { base: '#55514c', saddle: '#141211', under: '#a39d92', grizzle: 0.25, mark: '#e9dcc4' },
  },
  {
    id: 'frostmane',
    width: 1.55,
    name: 'Frostmane',
    pitch: 'The pack leader. Chest out, head high, a great white mane and tail raised.',
    ...frostmane,
    head: [0.44, 0.84, 0],
    fur: 0.013,
    coat: { base: '#e3e0d8', saddle: '#a9a69f', under: '#f6f3ec', grizzle: 0.15, mark: '#3a3f52' },
  },
  {
    id: 'runner',
    width: 1.31,
    name: 'Timber Runner',
    pitch: 'Caught mid-lope. Long and lean, legs reaching and driving, tail streaming behind.',
    ...runner,
    head: [0.56, 0.6, 0],
    fur: 0.01,
    coat: { base: '#9a7148', saddle: '#4a3322', under: '#e2cfae', grizzle: 0.3, mark: '#2b1d12' },
  },
  {
    id: 'grizzle',
    width: 1.33,
    headWeight: 1.8,
    name: 'Old Grizzle',
    pitch: 'An old giant. Broad skull, thick legs, and a shaggy, grizzled coat.',
    ...grizzle,
    head: [0.5, 0.64, 0],
    fur: 0.018,
    coat: { base: '#6b665d', saddle: '#26231f', under: '#b9b2a4', grizzle: 0.6, mark: '#efe6d4' },
  },
];
