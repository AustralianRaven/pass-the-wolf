/**
 * Rest-state probe: throws a pair of dice and clusters every resting orientation by which
 * way world-up points in the die's body frame. Shows the stable poses a shape really has,
 * so new poses (and the classifier) can be designed against them.
 *
 *   npx tsx tools/rests.ts [throws=400] [animal=winter] [--nose]   (--nose: only snout-down rests)
 */
import { setPriority, constants } from 'node:os';
import { getAnimal } from '../src/animals/registry';
import { PIG_TUNE, pigHitbox, type PigTune } from '../src/animals/pig-hitbox';
import { classifyPose, localUp } from '../src/physics/classify';
import { DiceWorld, loadRapier } from '../src/physics/dice-world';
import { createRng } from '../src/physics/rng';

try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  /* not permitted: run at normal priority */
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const throws = Number(args[0] ?? 400);
const tuneArg = process.argv.find((a) => a.startsWith('--tune='));
const base = getAnimal(args[1] ?? 'winter');
const animal = tuneArg ? { ...base, parts: pigHitbox({ ...PIG_TUNE, ...(JSON.parse(tuneArg.slice(7)) as Partial<PigTune>) }) } : base;
const R = await loadRapier();
const rng = createRng(777);

const clusters = new Map<string, { n: number; pose: string; sum: [number, number, number] }>();
for (let i = 0; i < throws; i++) {
  const world = new DiceWorld(R, [animal, animal]);
  world.throwDice({ angle: (rng() - 0.5) * 0.8, power: 0.3 + rng() * 0.7, seed: Math.floor(rng() * 2 ** 32) });
  world.settle();
  for (const die of world.dice) {
    const q = die.body.rotation();
    const up = localUp(q);
    // Bucket by direction: 0.25 steps keep distinct rests apart without splitting one rest.
    const key = up.map((v) => (Math.round(v * 4) / 4).toFixed(2)).join(',');
    const c = clusters.get(key) ?? { n: 0, pose: classifyPose(q), sum: [0, 0, 0] };
    c.n++;
    c.sum = [c.sum[0] + up[0], c.sum[1] + up[1], c.sum[2] + up[2]];
    clusters.set(key, c);
  }
  world.free();
}
const total = throws * 2;
const noseOnly = process.argv.includes('--nose');
console.log(`${animal.scoring.id}: ${total} rests\n  share   pose          mean up (x nose, y back, z mark)`);
for (const [, c] of [...clusters].sort((a, b) => b[1].n - a[1].n)) {
  if (noseOnly && c.sum[0] / c.n > -0.3) continue;
  const m = c.sum.map((v) => (v / c.n).toFixed(2)).join(', ');
  console.log(`  ${((c.n / total) * 100).toFixed(2).padStart(5)}%  ${c.pose.padEnd(13)} (${m})`);
}
