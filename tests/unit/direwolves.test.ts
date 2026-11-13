import { beforeAll, describe, expect, it } from 'vitest';
import { DIREWOLF_ANIMALS } from '../../src/animals/direwolf-animals';
import { formatTrait, oddsFor, traitsFor } from '../../src/animals/traits';
import { DiceWorld, loadRapier } from '../../src/physics/dice-world';
import { createRng } from '../../src/physics/rng';
import type { GenericPose } from '../../src/rules/poses';

type Rapier = Awaited<ReturnType<typeof loadRapier>>;
const IDS = DIREWOLF_ANIMALS.map((a) => a.scoring.id);

describe('Feature: the direwolf pack', () => {
  it('Scenario: Given the pack, Then it has the five chosen wolves in picker order', () => {
    expect(IDS, 'Then the pack lists all five wolves').toEqual(['warden', 'stalker', 'frostmane', 'runner', 'grizzle']);
  });

  it.each(IDS)('Scenario: Given %s, Then it scores from the shared wolf table', (id) => {
    const wolf = DIREWOLF_ANIMALS.find((a) => a.scoring.id === id)!;
    expect(wolf.scoring.points, 'Then every wolf uses the same points').toEqual({ back: 5, upright: 5, noseDown: 10, tailDown: 20 });
    expect(wolf.scoring.poseNames.tailDown, 'Then the rare pose is still a Howl').toBe('Howl');
  });

  it.each(IDS)('Scenario: Given %s, Then it has calibrated odds and a strategy line', (id) => {
    const odds = oddsFor(id);
    expect(odds, 'Then calibration data exists').toBeDefined();
    expect(odds!.throws, 'Then the calibration used at least 1,000 throws').toBeGreaterThanOrEqual(1000);
    expect(traitsFor(id).length, 'Then at least one trait differs from the pack average').toBeGreaterThan(0);
  });

  it('Scenario: Given the calibrated pack, Then no wolf averages more than 20% above or below the others', () => {
    const avgs = IDS.map((id) => oddsFor(id)!.avgPointsPerRoll);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    for (const [i, avg] of avgs.entries()) {
      expect(Math.abs(avg - mean) / mean, `Then ${IDS[i]} stays near the pack average`).toBeLessThan(0.2);
    }
  });

  it.each([
    [{ pose: 'tailDown' as const, label: 'Howl', delta: 2.64 }, '+2.6% Howl'],
    [{ pose: 'back' as const, label: 'Play Dead', delta: -13.2 }, '−13.2% Play Dead'],
  ])('Scenario: Given a trait, Then it is formatted with a sign and one decimal', (trait, text) => {
    expect(formatTrait(trait), 'Then the trait reads as a signed percentage').toBe(text);
  });
});

describe('Feature: direwolf physics', () => {
  let R: Rapier;
  beforeAll(async () => {
    R = await loadRapier();
  });

  it.each(IDS)('Scenario: Given %s placed on its feet, When the world settles, Then it stays upright', (id) => {
    const wolf = DIREWOLF_ANIMALS.find((a) => a.scoring.id === id)!;
    const w = new DiceWorld(R, [wolf, wolf]);
    w.place(0, [-2, 0.03, 0], { x: 0, y: 0, z: 0, w: 1 });
    w.place(1, [2, 0.03, 0], { x: 0, y: 0, z: 0, w: 1 });
    const s = w.settle();
    expect(s.settled, 'Then both dice come to rest').toBe(true);
    expect(s.poses, 'Then both stand upright on their own collider').toEqual(['upright', 'upright']);
    w.free();
  });

  it.each(IDS)(
    'Scenario: Given 60 seeded throws of %s, Then its pose mix stays near its calibrated odds',
    (id) => {
      const wolf = DIREWOLF_ANIMALS.find((a) => a.scoring.id === id)!;
      const odds = oddsFor(id)!.posePct;
      const rng = createRng(4242);
      const counts: Record<string, number> = {};
      const throws = 60;
      for (let i = 0; i < throws; i++) {
        const w = new DiceWorld(R, [wolf, wolf]);
        w.throwDice({ angle: (rng() - 0.5) * 0.8, power: 0.3 + rng() * 0.7, seed: Math.floor(rng() * 2 ** 32) });
        for (const p of w.settle().poses) counts[p] = (counts[p] ?? 0) + 1;
        w.free();
      }
      const pct = (p: GenericPose) => ((counts[p] ?? 0) / (throws * 2)) * 100;
      const sides = pct('sideMarkUp') + pct('sideMarkDown');
      const calibratedSides = (odds.sideMarkUp ?? 0) + (odds.sideMarkDown ?? 0);
      // Wide bands: 120 dice is a small sample; this catches a broken collider, not drift.
      expect(Math.abs(sides - calibratedSides), 'Then side landings are near calibration').toBeLessThan(14);
      expect(Math.abs(pct('back') - (odds.back ?? 0)), 'Then Play Dead is near calibration').toBeLessThan(11);
      expect(Math.abs(pct('upright') - (odds.upright ?? 0)), 'Then Prowl is near calibration').toBeLessThan(10);
    },
    60_000,
  );
});
