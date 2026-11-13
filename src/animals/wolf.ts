import type { AnimalDefinition } from './body';
import { WOLF_SCORING } from './wolf-scoring';

/**
 * The wolf die. Roughly one unit nose to tail, standing on four legs.
 * Shape decides the odds: the flat back and wide stance keep Play Dead and Prowl
 * common, the long tail and snout make the tipped Howl and Sniff poses rare.
 * Tuned against `npm run calibrate`.
 */
export const WOLF: AnimalDefinition = {
  scoring: WOLF_SCORING,
  palette: { body: '#c9965b', accent: '#3a2a1c' },
  markAt: [-0.05, 0.4, 0.21],
  parts: [
    // torso, chest ruff and a flat carved back
    { kind: 'capsule', from: [-0.26, 0.328, 0], to: [0.22, 0.344, 0], radius: 0.23 },
    { kind: 'ball', at: [0.24, 0.369, 0], radius: 0.21 },
    { kind: 'box', at: [-0.02, 0.476, 0], half: [0.32, 0.033, 0.2] },
    // carved flank bosses (the moon mark sits on the +Z one); they make a side landing rock
    { kind: 'ball', at: [-0.02, 0.33, 0.2], radius: 0.1 },
    { kind: 'ball', at: [-0.02, 0.33, -0.2], radius: 0.1 },
    // neck, head, snout, ears
    { kind: 'capsule', from: [0.3, 0.41, 0], to: [0.42, 0.525, 0], radius: 0.11 },
    { kind: 'ball', at: [0.47, 0.558, 0], radius: 0.135 },
    { kind: 'box', at: [0.61, 0.529, 0], half: [0.1, 0.041, 0.06] },
    { kind: 'box', at: [0.44, 0.681, 0.065], half: [0.03, 0.049, 0.03] },
    { kind: 'box', at: [0.44, 0.681, -0.065], half: [0.03, 0.049, 0.03] },
    // legs, set wide
    { kind: 'capsule', from: [0.26, 0.053, 0.14], to: [0.24, 0.23, 0.12], radius: 0.065 },
    { kind: 'capsule', from: [0.26, 0.053, -0.14], to: [0.24, 0.23, -0.12], radius: 0.065 },
    { kind: 'capsule', from: [-0.28, 0.053, 0.14], to: [-0.25, 0.23, 0.12], radius: 0.07 },
    { kind: 'capsule', from: [-0.28, 0.053, -0.14], to: [-0.25, 0.23, -0.12], radius: 0.07 },
    // flat carved paws
    { kind: 'box', at: [0.27, 0.025, 0.14], half: [0.08, 0.025, 0.065], density: 2 },
    { kind: 'box', at: [0.27, 0.025, -0.14], half: [0.08, 0.025, 0.065], density: 2 },
    { kind: 'box', at: [-0.27, 0.025, 0.14], half: [0.08, 0.025, 0.07], density: 2 },
    { kind: 'box', at: [-0.27, 0.025, -0.14], half: [0.08, 0.025, 0.07], density: 2 },
    // tail, sweeping down and back
    { kind: 'capsule', from: [-0.4, 0.361, 0], to: [-0.5, 0.164, 0], radius: 0.08 },
    // haunches: a flat rump the wolf can sit back on to Howl
    { kind: 'box', at: [-0.52, 0.33, 0], half: [0.04, 0.17, 0.17] },
  ],
};
