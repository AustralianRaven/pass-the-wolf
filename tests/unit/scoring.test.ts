import { describe, expect, it } from 'vitest';
import { scoreRoll, type RollKind } from '../../src/rules/scoring';
import type { GenericPose } from '../../src/rules/poses';
import { outcome, TEST_SHEEP, wolf } from './fixtures';

describe('Feature: scoring a wolf + wolf roll', () => {
  const cases: Array<[GenericPose, GenericPose, RollKind, number, string]> = [
    ['sideMarkUp', 'sideMarkUp', 'den', 1, 'Den'],
    ['sideMarkDown', 'sideMarkDown', 'den', 1, 'Den'],
    ['sideMarkUp', 'sideMarkDown', 'scattered', 0, 'Scattered'],
    ['sideMarkDown', 'sideMarkUp', 'scattered', 0, 'Scattered'],
    ['sideMarkUp', 'back', 'score', 5, 'Play Dead'],
    ['upright', 'sideMarkDown', 'score', 5, 'Prowl'],
    ['sideMarkUp', 'noseDown', 'score', 10, 'Sniff'],
    ['tailDown', 'sideMarkDown', 'score', 20, 'Howl'],
    ['back', 'back', 'double', 20, 'Double Play Dead'],
    ['upright', 'upright', 'double', 20, 'Double Prowl'],
    ['noseDown', 'noseDown', 'double', 40, 'Double Sniff'],
    ['tailDown', 'tailDown', 'double', 80, 'Double Howl'],
    ['tailDown', 'noseDown', 'score', 30, 'Howl + Sniff'],
    ['back', 'upright', 'score', 10, 'Play Dead + Prowl'],
  ];

  it.each(cases)('Scenario: Given poses %s and %s, Then the roll is %s for %i points (%s)', (a, b, kind, pts, label) => {
    const r = scoreRoll(outcome(a, b));
    expect(r.kind, 'Then the roll kind matches').toBe(kind);
    expect(r.points, 'Then the points match').toBe(pts);
    expect(r.label, 'Then the label names the poses').toBe(label);
  });

  it('Scenario: Given the wolves rest touching, Then the roll is Tangled and wipes the bank', () => {
    const r = scoreRoll(outcome('tailDown', 'tailDown', { touching: true }));
    expect(r.kind, 'Then the kind is tangled').toBe('tangled');
    expect(r.bust, 'Then the turn busts').toBe(true);
    expect(r.wipesBank, 'Then the banked score is wiped').toBe(true);
  });

  it('Scenario: Given one wolf rests on the other, Then the roll is Alpha and does not bust', () => {
    const r = scoreRoll(outcome('back', 'upright', { stacked: true }));
    expect(r.kind, 'Then the kind is alpha').toBe('alpha');
    expect(r.points, 'Then Alpha scores its bonus').toBe(50);
    expect(r.bust, 'Then Alpha is not a bust').toBe(false);
  });

  it('Scenario: Given a Scattered roll, Then it busts without wiping the bank', () => {
    const r = scoreRoll(outcome('sideMarkUp', 'sideMarkDown'));
    expect(r.bust, 'Then the turn busts').toBe(true);
    expect(r.wipesBank, 'Then the bank survives').toBe(false);
  });
});

describe('Feature: scoring a mixed wolf + sheep roll', () => {
  const mixed = { animals: [wolf, TEST_SHEEP] as [typeof wolf, typeof TEST_SHEEP] };

  it.each([
    ['tailDown', 'tailDown', 'double', (20 + 20) * 2, 'Double: Howl + Woolpack'],
    ['noseDown', 'upright', 'score', 10 + 6, 'Sniff + Graze'],
    ['sideMarkUp', 'tailDown', 'score', 20, 'Woolpack'],
    ['back', 'sideMarkDown', 'score', 5, 'Play Dead'],
    ['sideMarkDown', 'sideMarkDown', 'den', 1, 'Den'],
  ] as const)('Scenario: Given wolf %s and sheep %s, Then the roll is %s for %i points (%s)', (a, b, kind, pts, label) => {
    const r = scoreRoll(outcome(a, b, mixed));
    expect(r.kind, 'Then the roll kind matches').toBe(kind);
    expect(r.points, 'Then each die scores from its own animal table').toBe(pts);
    expect(r.label, 'Then the label uses each animal pose name').toBe(label);
  });
});
