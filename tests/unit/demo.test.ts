import { describe, expect, it } from 'vitest';
import { DEMO_RESULTS, demoThrow, resultKey } from '../../src/demo/results';
import seeds from '../../src/demo/demo-seeds.json';
import { PIG_HITBOX } from '../../src/animals/pig-hitbox';
import { WOLF_DICE } from '../../src/animals/wolf-dice';
import type { SettledDice } from '../../src/physics/dice-world';
import type { GenericPose } from '../../src/rules/poses';

const settled = (a: GenericPose, b: GenericPose, touching = false, stacked = false): SettledDice => ({
  poses: [a, b],
  touching,
  stacked,
  support: stacked ? 1 : 0,
  settled: true,
  steps: 0,
});

describe('Feature: demo result keys', () => {
  it.each([
    [settled('sideMarkUp', 'sideMarkUp'), 'den'],
    [settled('sideMarkUp', 'sideMarkDown'), 'scattered'],
    [settled('sideMarkDown', 'tailDown'), 'single:tailDown'],
    [settled('lean', 'lean'), 'double:lean'],
    [settled('upright', 'back'), 'mixed:back+upright'],
    [settled('back', 'back', true), 'tangled'],
    [settled('upright', 'back', true, true), 'alpha'],
  ] as const)('Scenario: Given a landing, Then its demo key is %s', (landing, key) => {
    expect(resultKey(landing), `Then the key is ${key}`).toBe(key);
  });

  it('Scenario: Given the same seed twice, Then the demo throw is identical', () => {
    expect(demoThrow(42), 'Then the throw input repeats exactly').toEqual(demoThrow(42));
  });

  it('Scenario: Given the recorded demo seeds, Then every menu result has a real throw', () => {
    const recorded = seeds as Record<string, number>;
    for (const r of DEMO_RESULTS) expect(recorded[r.key], `Then ${r.label} has a recorded seed`).toBeTypeOf('number');
  });
});

describe('Feature: the shared pig hitbox', () => {
  it('Scenario: Given every wolf die, Then it rolls on the shared pig hitbox', () => {
    for (const die of WOLF_DICE) expect(die.parts, `Then ${die.scoring.name} uses the pig hitbox`).toBe(PIG_HITBOX);
  });

  it('Scenario: Given the pig hitbox, Then every part is invisible', () => {
    for (const part of PIG_HITBOX) expect(part.kind === 'hull' && part.invisible, 'Then the part is hidden from players').toBe(true);
  });
});
