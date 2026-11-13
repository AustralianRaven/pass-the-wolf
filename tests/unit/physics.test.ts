import { beforeAll, describe, expect, it } from 'vitest';
import { WOLF } from '../../src/animals/wolf';
import { classifyPose } from '../../src/physics/classify';
import { DiceWorld, MAX_STEPS, capsuleRotation, loadRapier } from '../../src/physics/dice-world';
import type { GenericPose } from '../../src/rules/poses';

type Rapier = Awaited<ReturnType<typeof loadRapier>>;

const aboutX = (deg: number) => {
  const h = (deg * Math.PI) / 360;
  return { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) };
};
const aboutZ = (deg: number) => {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) };
};
const aboutY = (deg: number) => {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
};

describe('Feature: classifying a resting die', () => {
  it.each<[string, { x: number; y: number; z: number; w: number }, GenericPose]>([
    ['no rotation', { x: 0, y: 0, z: 0, w: 1 }, 'upright'],
    ['a half-turn yaw (still on its feet)', aboutY(180), 'upright'],
    ['a half-turn about X (on its back)', aboutX(180), 'back'],
    ['-90° about X (marked flank up)', aboutX(-90), 'sideMarkUp'],
    ['+90° about X (marked flank down)', aboutX(90), 'sideMarkDown'],
    ['+90° about Z (nose up, sitting back)', aboutZ(90), 'tailDown'],
    ['-90° about Z (nose down)', aboutZ(-90), 'noseDown'],
    ['+30° about X (leaning but still on its feet)', aboutX(30), 'upright'],
    ['-60° about Z (tipped well forward)', aboutZ(-60), 'noseDown'],
  ])('Scenario: Given %s, Then the pose is %s', (_label, q, pose) => {
    expect(classifyPose(q), 'Then the nearest body axis decides the pose').toBe(pose);
  });
});

describe('Feature: capsule orientation', () => {
  it('Scenario: Given a capsule along +X, Then its rotation maps +Y onto +X', () => {
    const q = capsuleRotation([0, 0, 0], [1, 0, 0]);
    expect(q.z, 'Then the rotation is about the Z axis').toBeCloseTo(-Math.SQRT1_2, 5);
    expect(q.w, 'Then the rotation is a quarter turn').toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe('Feature: the physics dice world', () => {
  let R: Rapier;
  beforeAll(async () => {
    R = await loadRapier();
  });

  it('Scenario: Given a wolf placed on its feet, When the world settles, Then it reads upright and not touching', () => {
    const w = new DiceWorld(R, [WOLF, WOLF]);
    w.place(0, [-2, 0.02, 0], { x: 0, y: 0, z: 0, w: 1 });
    w.place(1, [2, 0.02, 0], { x: 0, y: 0, z: 0, w: 1 });
    const s = w.settle();
    expect(s.settled, 'Then both dice come to rest').toBe(true);
    expect(s.poses, 'Then both wolves stand upright').toEqual(['upright', 'upright']);
    expect(s.touching, 'Then the wolves are not touching').toBe(false);
    expect(s.stacked, 'Then neither wolf is stacked').toBe(false);
    w.free();
  });

  it('Scenario: Given two wolves placed side by side in contact, When the world settles, Then they read as touching', () => {
    const w = new DiceWorld(R, [WOLF, WOLF]);
    w.place(0, [0, 0.02, 0], { x: 0, y: 0, z: 0, w: 1 });
    w.place(1, [0, 0.02, 0.46], { x: 0, y: 0, z: 0, w: 1 });
    const s = w.settle();
    expect(s.touching, 'Then the contact is detected').toBe(true);
    w.free();
  });

  it('Scenario: Given the same seed and input twice, Then the throw lands identically', () => {
    const run = () => {
      const w = new DiceWorld(R, [WOLF, WOLF]);
      w.throwDice({ angle: 0.1, power: 0.7, seed: 4242 });
      const s = w.settle();
      const pos = w.dice.map((d) => d.body.translation());
      w.free();
      return { s, pos };
    };
    const a = run();
    const b = run();
    expect(b.s, 'Then the settled result matches').toEqual(a.s);
    expect(b.pos, 'Then the resting positions match').toEqual(a.pos);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('Scenario: Given throw seed %i, Then the dice settle inside the arena within the step budget', (seed) => {
    const w = new DiceWorld(R, [WOLF, WOLF]);
    w.throwDice({ angle: (seed - 4) * 0.2, power: seed / 8, seed });
    const s = w.settle();
    expect(s.settled, 'Then the dice stop before the timeout').toBe(true);
    expect(s.steps, 'Then they stop inside the step budget').toBeLessThan(MAX_STEPS);
    for (const d of w.dice) {
      const p = d.body.translation();
      expect(Math.abs(p.x), 'Then each die is inside the arena on X').toBeLessThan(5.5);
      expect(Math.abs(p.z), 'Then each die is inside the arena on Z').toBeLessThan(3.6);
      expect(p.y, 'Then each die is on the table, not through it').toBeGreaterThan(-0.1);
    }
    w.free();
  });
});
