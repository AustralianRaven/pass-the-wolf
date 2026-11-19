import type { SculptPart, V3 } from '../sculpt/sdf';
import type { WolfDesign } from './wolf-design';

/**
 * More carved animals (#4). Each is display-only: it rolls on the shared pig hitbox like the
 * winter wolf, so the odds are the same whatever you pick.
 *
 * Same body frame and conventions as the wolf (src/animals/wolf-design.ts): nose +X, back +Y,
 * marked flank +Z, feet at y = 0. Part groups name the floppy bones (src/render/wobble.ts):
 * `tail0..n`, `earL`/`earR`, and `leg{i}u` / `leg{i}l` with front legs first.
 */

const mirror = (v: V3): V3 => [v[0], v[1], -v[2]];
const cone = (a: V3, b: V3, ra: number, rb: number, group: string, blend = 0.04, fur = 0.5): SculptPart => ({ kind: 'cone', a, b, ra, rb, blend, fur, group });
const blob = (c: V3, r: V3, group: string, blend = 0.05, fur = 0.5): SculptPart => ({ kind: 'ellipsoid', c, r, blend, fur, group });

/** A leg on the +Z side and its mirror: upper bone top→mid, lower bone mid→paw, plus a foot. */
function legPair(i: number, top: V3, mid: V3, paw: V3, r: readonly [number, number, number], foot: V3, footOffset: V3 = [0.02, 0, 0]): SculptPart[] {
  const one = (k: number, t: V3, m: V3, p: V3): SculptPart[] => [
    cone(t, m, r[0], r[1], `leg${k}u`, 0.05),
    cone(m, p, r[1], r[2], `leg${k}l`, 0.03),
    blob([p[0] + footOffset[0], p[1] + footOffset[1], p[2] + footOffset[2]], foot, `leg${k}l`, 0.025, 0.2),
  ];
  return [...one(i, top, mid, paw), ...one(i + 1, mirror(top), mirror(mid), mirror(paw))];
}

// ---------- Gorilla: a knuckle-walking silverback, huge shoulders, short bowed hind legs ----------

const gorillaParts: SculptPart[] = [
  cone([-0.24, 0.44, 0], [0.12, 0.6, 0], 0.17, 0.24, 'torso', 0.08, 0.8),
  blob([-0.04, 0.44, 0], [0.24, 0.17, 0.19], 'torso', 0.08, 0.8),
  blob([0.18, 0.62, 0], [0.16, 0.16, 0.25], 'torso', 0.08, 0.8),
  // Head: a crested skull, a heavy brow and a broad muzzle.
  blob([0.34, 0.74, 0], [0.12, 0.12, 0.11], 'head', 0.05, 0.6),
  blob([0.31, 0.85, 0], [0.08, 0.05, 0.05], 'head', 0.05, 0.6),
  blob([0.42, 0.78, 0], [0.04, 0.03, 0.1], 'face', 0.03, 0),
  blob([0.45, 0.68, 0], [0.07, 0.065, 0.085], 'face', 0.04, 0),
  blob([0.31, 0.76, 0.1], [0.025, 0.03, 0.02], 'face', 0.02, 0),
  blob(mirror([0.31, 0.76, 0.1]), [0.025, 0.03, 0.02], 'face', 0.02, 0),
  // Arms (front legs): long and thick, down to the knuckles.
  ...legPair(0, [0.2, 0.62, 0.19], [0.27, 0.32, 0.22], [0.29, 0.06, 0.2], [0.085, 0.07, 0.06], [0.05, 0.04, 0.055], [0.015, -0.01, 0]),
  // Hind legs: short and bowed.
  ...legPair(2, [-0.24, 0.4, 0.12], [-0.18, 0.2, 0.15], [-0.22, 0.04, 0.13], [0.09, 0.07, 0.055], [0.075, 0.03, 0.05], [0.03, -0.01, 0]),
];

export const GORILLA_DESIGN: WolfDesign = {
  id: 'gorilla',
  name: 'Gorilla',
  plural: 'Gorillas',
  poseNames: { back: 'Siesta', upright: 'Knuckle Walk', noseDown: 'Face Plant', lean: 'Swing', tailDown: 'Chest Beat' },
  pitch: 'A silverback. Broad, heavy and not amused.',
  blurb: 'A silverback. Broad, heavy and not amused.',
  parts: gorillaParts,
  fur: 0.012,
  coat: { base: '#34323a', saddle: '#a7a6ad', under: '#4a4650', grizzle: 0.2, mark: '#c9b6ff' },
  paint: { groups: { face: '#4b4049', torso: '#34323a', head: '#34323a', leg: '#2c2a31' }, back: 0.85, belly: 0.3, shadeGroups: ['torso'] },
  eyes: [
    [0.44, 0.745, 0.05],
    [0.44, 0.745, -0.05],
  ],
  nose: [0.515, 0.7, 0],
  head: [0.34, 0.74, 0],
  neck: [
    [0.3, 0.7, 0],
    [0.4, 0.76, 0],
  ],
  markAt: [-0.04, 0.46, 0.2],
  width: 1,
  marker: { kind: 'collar', radius: 0.15 },
  eyeColour: '#5a3a1e',
};

// ---------- Beaver: round and low, flat paddle tail, proud front teeth ----------

function beaverParts(): SculptPart[] {
  return [
    blob([-0.05, 0.3, 0], [0.32, 0.24, 0.22], 'torso', 0.08, 0.6),
    blob([0.17, 0.3, 0], [0.16, 0.18, 0.17], 'torso', 0.08, 0.6),
    // Head, cheeks, muzzle, nose and the teeth.
    blob([0.36, 0.36, 0], [0.15, 0.13, 0.13], 'head', 0.06, 0.5),
    blob([0.5, 0.32, 0], [0.08, 0.07, 0.09], 'muzzle', 0.04, 0.2),
    blob([0.565, 0.355, 0], [0.025, 0.02, 0.03], 'nose', 0.015, 0),
    blob([0.548, 0.245, 0], [0.012, 0.035, 0.028], 'teeth', 0.008, 0),
    // Small round ears.
    cone([0.3, 0.47, 0.09], [0.29, 0.52, 0.11], 0.032, 0.022, 'earL', 0.02, 0.3),
    cone(mirror([0.3, 0.47, 0.09]), mirror([0.29, 0.52, 0.11]), 0.032, 0.022, 'earR', 0.02, 0.3),
    // Short legs, big hind feet.
    ...legPair(0, [0.2, 0.2, 0.13], [0.24, 0.1, 0.15], [0.27, 0.035, 0.15], [0.05, 0.04, 0.035], [0.04, 0.022, 0.04]),
    ...legPair(2, [-0.24, 0.22, 0.14], [-0.21, 0.1, 0.16], [-0.2, 0.035, 0.16], [0.07, 0.05, 0.04], [0.085, 0.025, 0.055], [0.04, -0.008, 0]),
    // The paddle tail: a stub, then a broad flat paddle.
    cone([-0.32, 0.18, 0], [-0.46, 0.12, 0], 0.06, 0.045, 'tail0', 0.05, 0.3),
    cone([-0.46, 0.12, 0], [-0.7, 0.09, 0], 0.03, 0.025, 'tail1', 0.03, 0),
    blob([-0.6, 0.095, 0], [0.15, 0.022, 0.1], 'tail1', 0.03, 0),
  ];
}

const beaverBase = {
  eyes: [
    [0.45, 0.42, 0.075],
    [0.45, 0.42, -0.075],
  ] as V3[],
  nose: [0.585, 0.36, 0] as V3,
  head: [0.36, 0.36, 0] as V3,
  neck: [
    [0.18, 0.32, 0],
    [0.36, 0.36, 0],
  ] as [V3, V3],
  markAt: [-0.08, 0.34, 0.22] as V3,
  width: 1,
  fur: 0.01,
  eyeColour: '#140d08',
};

export const BEAVER_DESIGN: WolfDesign = {
  ...beaverBase,
  id: 'beaver',
  name: 'Beaver',
  plural: 'Beavers',
  poseNames: { back: 'Floater', upright: 'Waddle', noseDown: 'Gnaw', lean: 'Dive', tailDown: 'Lookout' },
  pitch: 'Flat tail, big teeth, rolls like a log.',
  blurb: 'Flat tail, big teeth, rolls like a log.',
  parts: beaverParts(),
  coat: { base: '#8a5a36', saddle: '#62401f', under: '#b58e68', grizzle: 0.12, mark: '#efe8ff' },
  paint: {
    groups: { torso: '#8a5a36', head: '#8a5a36', muzzle: '#a9805a', nose: '#1a1310', teeth: '#f1e3b8', ear: '#62401f', leg: '#6b4527', tail0: '#6b4527', tail1: '#3b2d27' },
    belly: 0.55,
    back: 0.35,
    shadeGroups: ['torso', 'head'],
  },
  marker: { kind: 'collar', radius: 0.135 },
};

// ---------- Beaver in a tuxedo: the same beaver, dressed for the opera ----------

export const TUXEDO_BEAVER_DESIGN: WolfDesign = {
  ...beaverBase,
  id: 'tuxedo-beaver',
  name: 'Beaver in a Tuxedo',
  plural: 'Beavers in Tuxedos',
  poseNames: { back: 'After Party', upright: 'Red Carpet', noseDown: 'Take a Bow', lean: 'Tango Dip', tailDown: 'Raise a Toast' },
  pitch: 'Black tie, white shirt, bow tie in your colour.',
  blurb: 'Black tie, white shirt, bow tie in your colour.',
  parts: [
    ...beaverParts(),
    // A crisp shirt front and the tails of the coat hanging over the rump.
    blob([0.25, 0.27, 0], [0.11, 0.15, 0.12], 'shirt', 0.03, 0),
    blob([-0.3, 0.24, 0.07], [0.13, 0.11, 0.035], 'coattail', 0.03, 0),
    blob(mirror([-0.3, 0.24, 0.07]), [0.13, 0.11, 0.035], 'coattail', 0.03, 0),
  ],
  coat: { base: '#8a5a36', saddle: '#0d0c10', under: '#26232c', grizzle: 0.04, mark: '#c9b6ff' },
  paint: {
    groups: {
      torso: '#17151c',
      coattail: '#17151c',
      shirt: '#f4f1ea',
      head: '#8a5a36',
      muzzle: '#a9805a',
      nose: '#1a1310',
      teeth: '#f1e3b8',
      ear: '#62401f',
      leg: '#17151c',
      tail0: '#6b4527',
      tail1: '#3b2d27',
    },
    back: 0.4,
    shadeGroups: ['torso'],
  },
  marker: { kind: 'bowtie', at: [0.43, 0.215, 0], size: 0.08 },
};

// ---------- Tortoise: a high domed shell, stubby legs, a head that peeks out ----------

const tortoiseParts: SculptPart[] = [
  blob([-0.02, 0.34, 0], [0.38, 0.24, 0.28], 'shell', 0.04, 0),
  blob([-0.02, 0.22, 0], [0.41, 0.05, 0.31], 'rim', 0.03, 0),
  blob([-0.02, 0.17, 0], [0.34, 0.07, 0.25], 'belly', 0.03, 0),
  cone([0.3, 0.24, 0], [0.52, 0.33, 0], 0.07, 0.062, 'neck', 0.04, 0),
  blob([0.56, 0.35, 0], [0.09, 0.075, 0.075], 'head', 0.04, 0),
  ...legPair(0, [0.22, 0.2, 0.19], [0.27, 0.1, 0.23], [0.28, 0.035, 0.23], [0.075, 0.07, 0.065], [0.07, 0.03, 0.065], [0.01, 0, 0]),
  ...legPair(2, [-0.24, 0.2, 0.18], [-0.29, 0.1, 0.22], [-0.3, 0.035, 0.22], [0.08, 0.075, 0.068], [0.07, 0.03, 0.068], [-0.01, 0, 0]),
  cone([-0.38, 0.2, 0], [-0.48, 0.15, 0], 0.035, 0.012, 'tail0', 0.03, 0),
];

export const TORTOISE_DESIGN: WolfDesign = {
  id: 'tortoise',
  name: 'Tortoise',
  plural: 'Tortoises',
  poseNames: { back: 'Stuck', upright: 'Plod', noseDown: 'Burrow', lean: 'Lurch', tailDown: 'Sunbathe' },
  pitch: 'Slow, steady, very hard to tip.',
  blurb: 'Slow, steady, very hard to tip.',
  parts: tortoiseParts,
  fur: 0.004,
  coat: { base: '#8c8a6a', saddle: '#3e4a26', under: '#c9b77a', grizzle: 0.45, mark: '#efe8ff' },
  paint: {
    groups: { shell: '#5d6b3a', rim: '#8a7a45', belly: '#c9b77a', neck: '#8c8a6a', head: '#8c8a6a', leg: '#7d7b5c', tail: '#7d7b5c' },
    back: 0.3,
    shadeGroups: ['shell'],
  },
  eyes: [
    [0.6, 0.38, 0.058],
    [0.6, 0.38, -0.058],
  ],
  nose: [0.645, 0.355, 0],
  head: [0.56, 0.35, 0],
  neck: [
    [0.3, 0.24, 0],
    [0.56, 0.35, 0],
  ],
  markAt: [-0.04, 0.36, 0.28],
  width: 1,
  marker: { kind: 'collar', radius: 0.095 },
  eyeColour: '#2a1d0e',
};

// ---------- Pig: the shape every animal secretly rolls on, finally on show ----------

const pigParts: SculptPart[] = [
  blob([0.06, 0.38, 0], [0.46, 0.25, 0.26], 'torso', 0.08, 0.15),
  blob([0.4, 0.42, 0], [0.17, 0.17, 0.17], 'head', 0.07, 0.15),
  cone([0.52, 0.4, 0], [0.66, 0.39, 0], 0.095, 0.09, 'snout', 0.03, 0),
  blob([0.668, 0.39, 0], [0.012, 0.075, 0.08], 'nose', 0.01, 0),
  // Floppy ears, folded forward over the eyes.
  cone([0.42, 0.56, 0.1], [0.53, 0.55, 0.18], 0.05, 0.018, 'earL', 0.03, 0),
  cone(mirror([0.42, 0.56, 0.1]), mirror([0.53, 0.55, 0.18]), 0.05, 0.018, 'earR', 0.03, 0),
  // Short legs on little hooves.
  ...legPair(0, [0.27, 0.22, 0.13], [0.28, 0.11, 0.14], [0.28, 0.035, 0.14], [0.06, 0.05, 0.045], [0.045, 0.03, 0.042], [0.005, 0, 0]),
  ...legPair(2, [-0.26, 0.22, 0.13], [-0.27, 0.11, 0.14], [-0.27, 0.035, 0.14], [0.065, 0.052, 0.045], [0.045, 0.03, 0.042], [0.005, 0, 0]),
  // A curly tail.
  cone([-0.4, 0.44, 0], [-0.47, 0.49, 0.03], 0.024, 0.02, 'tail0', 0.02, 0),
  cone([-0.47, 0.49, 0.03], [-0.45, 0.55, 0.06], 0.02, 0.018, 'tail1', 0.015, 0),
  cone([-0.45, 0.55, 0.06], [-0.5, 0.57, 0.02], 0.018, 0.012, 'tail2', 0.015, 0),
];

export const PIG_DESIGN: WolfDesign = {
  id: 'pig',
  name: 'Pig',
  plural: 'Pigs',
  poseNames: { back: 'Mud Bath', upright: 'Strut', noseDown: 'Truffle Hunt', lean: 'Sty Slump', tailDown: 'Sit Pretty' },
  pitch: 'Where it all began. Pink, round and suspiciously good at this.',
  blurb: 'Where it all began. Pink, round and suspiciously good at this.',
  parts: pigParts,
  fur: 0.002,
  coat: { base: '#f0a7b4', saddle: '#d98797', under: '#f7c9d1', grizzle: 0.05, mark: '#4e3a86' },
  paint: { groups: { torso: '#f0a7b4', head: '#f0a7b4', snout: '#e88b9c', nose: '#d16a7f', ear: '#e391a1', leg: '#ec9fad', tail: '#e88b9c' }, belly: 0.4, back: 0.15, shadeGroups: ['torso'] },
  eyes: [
    [0.5, 0.48, 0.1],
    [0.5, 0.48, -0.1],
  ],
  nose: [0.69, 0.39, 0],
  head: [0.4, 0.42, 0],
  neck: [
    [0.26, 0.4, 0],
    [0.4, 0.42, 0],
  ],
  markAt: [0.0, 0.4, 0.26],
  width: 1,
  marker: { kind: 'collar', radius: 0.17 },
  eyeColour: '#1a0f12',
};

/** The new animals, in picker order after the winter wolf. */
export const MENAGERIE: readonly WolfDesign[] = [PIG_DESIGN, GORILLA_DESIGN, BEAVER_DESIGN, TUXEDO_BEAVER_DESIGN, TORTOISE_DESIGN];
