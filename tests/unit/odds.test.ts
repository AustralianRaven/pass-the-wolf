import { describe, expect, it } from 'vitest';
import record from '../../src/animals/pig-odds.json';
import { PIG_TUNE } from '../../src/animals/pig-hitbox';
import { POSE_TARGETS, ROLL_TARGETS, TOLERANCE } from '../../src/animals/wolf-targets';
import { POSE_BOUNDARIES } from '../../src/physics/classify';
import { ALPHA_SUPPORT } from '../../src/physics/dice-world';

/**
 * The odds gate (issue #1). The heavy simulation runs offline (docs/calibration.md) and is
 * committed as src/animals/pig-odds.json; this test checks that record against the targets
 * and refuses it when the pig, the pose boundaries or the Alpha rule changed since.
 */
const within = (value: number, target: number) => Math.abs(value - target) <= target * TOLERANCE;

describe('Feature: Auto-roll odds match the target table', () => {
  it('Scenario: Given the odds record, Then it was measured on the current pig, boundaries and Alpha rule', () => {
    expect(record.tune, 'Then the record matches the current pig tuning (re-run calibration if not)').toEqual(PIG_TUNE);
    expect(record.boundaries, 'Then the record matches the current pose boundaries').toEqual(POSE_BOUNDARIES);
    expect(record.alphaSupport, 'Then the record matches the current Alpha rule').toBe(ALPHA_SUPPORT);
    expect(record.profile, 'Then the record measures Auto-roll throws').toBe('auto-roll');
  });

  it('Scenario: Given the odds record, Then it has enough throws to judge the common poses', () => {
    expect(record.throws, 'Then at least 10,000 throws were measured').toBeGreaterThanOrEqual(10_000);
  });

  it.each(Object.entries(POSE_TARGETS))('Scenario: Given pose %s, Then it lands within ±10%% of %s%%', (pose, target) => {
    const value = (record.posePct as Record<string, number>)[pose] ?? 0;
    expect(within(value, target), `Then ${pose} at ${value}% is within ±10% of ${target}%`).toBe(true);
  });

  it('Scenario: Given the odds record, Then Tangled lands within ±10% of its target', () => {
    const value = (record.resultPct as Record<string, number>).tangled ?? 0;
    expect(within(value, ROLL_TARGETS.tangled), `Then Tangled at ${value}% is within ±10% of ${ROLL_TARGETS.tangled}%`).toBe(true);
  });

  it('Scenario: Given an Alpha check of 800,000+ throws, Then Alpha lands within ±10% of its target', () => {
    // Alpha is ~1 roll in 2,000: only a very large run can judge it. Smaller records skip this check.
    const value = (record.resultPct as Record<string, number>).alpha ?? 0;
    if (record.throws < 800_000) return;
    expect(within(value, ROLL_TARGETS.alpha), `Then Alpha at ${value}% is within ±10% of ${ROLL_TARGETS.alpha}%`).toBe(true);
  });
});
