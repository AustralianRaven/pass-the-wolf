import { createRng } from '../physics/rng';
import { autoRollInput, type DiceWorld, type SettledDice, type ThrowInput } from '../physics/dice-world';
import { isSidePose } from '../rules/poses';

/**
 * Every result the demo page can show, as a stable key. The key is derived from a real
 * physics landing, so the seed finder and the page agree on what a throw produced.
 */
export function resultKey(s: SettledDice): string {
  if (s.stacked) return 'alpha';
  if (s.touching) return 'tangled';
  const [a, b] = s.poses;
  const aSide = isSidePose(a);
  const bSide = isSidePose(b);
  if (aSide && bSide) return a === b ? 'den' : 'scattered';
  if (aSide || bSide) return `single:${aSide ? b : a}`;
  if (a === b) return `double:${a}`;
  return `mixed:${[a, b].sort().join('+')}`;
}

/** The demo menu, in display order: key, button label and group. */
export const DEMO_RESULTS: readonly { key: string; label: string; group: 'Singles' | 'Doubles' | 'Specials' }[] = [
  { key: 'single:back', label: 'Play Dead', group: 'Singles' },
  { key: 'single:upright', label: 'Prowl', group: 'Singles' },
  { key: 'single:noseDown', label: 'Sniff', group: 'Singles' },
  { key: 'single:lean', label: 'Pounce', group: 'Singles' },
  { key: 'single:tailDown', label: 'Howl', group: 'Singles' },
  { key: 'double:back', label: 'Double Play Dead', group: 'Doubles' },
  { key: 'double:upright', label: 'Double Prowl', group: 'Doubles' },
  { key: 'double:noseDown', label: 'Double Sniff', group: 'Doubles' },
  { key: 'double:lean', label: 'Double Pounce', group: 'Doubles' },
  { key: 'double:tailDown', label: 'Double Howl', group: 'Doubles' },
  { key: 'mixed:back+upright', label: 'Play Dead + Prowl', group: 'Doubles' },
  { key: 'den', label: 'Den', group: 'Specials' },
  { key: 'scattered', label: 'Scattered', group: 'Specials' },
  { key: 'tangled', label: 'Tangled', group: 'Specials' },
  { key: 'alpha', label: 'Alpha', group: 'Specials' },
];

/** The keys the seed finder searches for (the Alpha is staged, not searched). */
export const DEMO_KEYS: readonly string[] = DEMO_RESULTS.map((r) => r.key).filter((k) => k !== 'alpha');

/**
 * The Alpha is close to impossible on a real throw, so the demo stages it: one wolf is dropped
 * onto its packmate's back and the physics settles it. Every other demo is a real throw.
 */
export function stageAlpha(world: DiceWorld): void {
  world.place(0, [0, 0.02, 0.4], { x: 0, y: 0, z: 0, w: 1 });
  world.place(1, [-0.05, 0.62, 0.4], { x: 0, y: 0, z: 0, w: 1 });
}

/**
 * Lay the wolves at the thrower's edge and let them settle, exactly as the demo page does before
 * every throw. The finder, the page and the tests all start here, so a recorded seed lands the
 * same way everywhere.
 */
export function restAtEdge(world: DiceWorld): void {
  world.place(0, [-0.9, 0.02, 2.6], { x: 0, y: 0.38, z: 0, w: 0.925 });
  world.place(1, [0.9, 0.02, 2.6], { x: 0, y: -0.38, z: 0, w: 0.925 });
  world.settle(240);
}

/** A demo throw is an ordinary Auto-roll throw, fully determined by its seed. */
export function demoThrow(seed: number): ThrowInput {
  return { ...autoRollInput(createRng(seed ^ 0x5eed)), seed };
}

