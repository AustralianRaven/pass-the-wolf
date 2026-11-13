import { describe, expect, it } from 'vitest';
import { WOLF } from '../../src/animals/wolf';
import { DiceWorld, loadRapier } from '../../src/physics/dice-world';
import { createRng } from '../../src/physics/rng';
import { GENERIC_POSES, type GenericPose } from '../../src/rules/poses';

/**
 * Guards the calibrated odds (docs/calibration.md). If a change to the wolf's shape
 * or the physics constants shifts the pose frequencies out of these bands, the point
 * values no longer match the rarity and must be recalibrated.
 */
const THROWS = 300;

const BANDS: Record<GenericPose | 'sides', [number, number]> = {
  sides: [62, 88],
  sideMarkUp: [28, 48],
  sideMarkDown: [28, 48],
  back: [6, 21],
  upright: [4, 16],
  noseDown: [0.3, 6],
  tailDown: [0, 2.5],
};

describe('Feature: wolf pose balance', () => {
  it(
    `Scenario: Given ${THROWS} seeded throws, Then every pose frequency stays inside its calibrated band`,
    async () => {
      const R = await loadRapier();
      const rng = createRng(777);
      const counts = new Map<GenericPose, number>(GENERIC_POSES.map((p) => [p, 0]));
      for (let i = 0; i < THROWS; i++) {
        const w = new DiceWorld(R, [WOLF, WOLF]);
        w.throwDice({ angle: (rng() - 0.5) * 0.8, power: 0.3 + rng() * 0.7, seed: Math.floor(rng() * 2 ** 32) });
        for (const p of w.settle().poses) counts.set(p, (counts.get(p) ?? 0) + 1);
        w.free();
      }
      const pct = (p: GenericPose) => ((counts.get(p) ?? 0) / (THROWS * 2)) * 100;
      const sides = pct('sideMarkUp') + pct('sideMarkDown');

      expect(sides, 'Then side landings stay the most common outcome').toBeGreaterThanOrEqual(BANDS.sides[0]);
      expect(sides, 'Then side landings do not swamp the game').toBeLessThanOrEqual(BANDS.sides[1]);
      for (const pose of GENERIC_POSES) {
        const [lo, hi] = BANDS[pose];
        expect(pct(pose), `Then ${pose} is at least ${lo}%`).toBeGreaterThanOrEqual(lo);
        expect(pct(pose), `Then ${pose} is at most ${hi}%`).toBeLessThanOrEqual(hi);
      }
      expect(pct('back'), 'Then Play Dead is commoner than Sniff').toBeGreaterThan(pct('noseDown'));
      expect(pct('upright'), 'Then Prowl is commoner than Sniff').toBeGreaterThan(pct('noseDown'));
      expect(pct('noseDown'), 'Then Sniff is commoner than Howl').toBeGreaterThan(pct('tailDown'));
    },
    60_000,
  );
});
