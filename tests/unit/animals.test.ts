import { describe, expect, it } from 'vitest';
import { DESIGNS } from '../../src/animals/designs';
import { PICKABLE } from '../../src/animals/registry';
import { PIG_HITBOX } from '../../src/animals/pig-hitbox';
import { sculptWolfArrays } from '../../src/sculpt/paint-wolf';

describe('Feature: the menagerie (#4)', () => {
  it('Scenario: Given the picker, Then the winter wolf, gorilla, beaver, tuxedo beaver and tortoise are all pickable', () => {
    expect(PICKABLE.map((a) => a.scoring.name), 'Then every carved animal is offered, wolf first').toEqual(['Winter Wolf', 'Pig', 'Gorilla', 'Beaver', 'Beaver in a Tuxedo', 'Tortoise']);
  });

  it.each(PICKABLE.map((a) => [a.scoring.name, a] as const))('Scenario: Given the %s, Then it rolls on the shared pig hitbox and has a visible silhouette', (_name, animal) => {
    expect(animal.parts, 'Then the odds are the shared pig odds').toBe(PIG_HITBOX);
    expect(animal.silhouette?.length, 'Then Tangled and Alpha can see its shape').toBeGreaterThan(5);
  });

  it.each(DESIGNS.map((d) => [d.name, d] as const))('Scenario: Given the %s design, When it is carved coarsely, Then it makes a painted mesh', (_name, design) => {
    const a = sculptWolfArrays(design, 0.035);
    expect(a.positions.length, 'Then the carving has vertices').toBeGreaterThan(300);
    expect([...a.colours].every((c) => Number.isFinite(c) && c >= 0 && c <= 1), 'Then every vertex has a real colour').toBe(true);
  });

  it('Scenario: Given every animal, Then each has its own names for the five scoring poses', () => {
    const sets = PICKABLE.map((a) => [a.scoring.poseNames.back, a.scoring.poseNames.upright, a.scoring.poseNames.noseDown, a.scoring.poseNames.lean, a.scoring.poseNames.tailDown].join('|'));
    expect(new Set(sets).size, 'Then no two animals share a pose name set').toBe(PICKABLE.length);
  });

  it('Scenario: Given the tuxedo beaver, Then its player colour is a bow tie, not a collar', () => {
    expect(DESIGNS.find((d) => d.id === 'tuxedo-beaver')?.marker?.kind, 'Then it wears a bow tie').toBe('bowtie');
  });
});
