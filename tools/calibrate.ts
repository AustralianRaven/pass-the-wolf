/**
 * Headless calibration: throws a pair of animal dice many times with real physics
 * and prints how often each pose and pair result comes up.
 *
 *   npm run calibrate -- [throws=20000] [animalA=winter] [animalB=animalA] [--json]
 */
import { writeFileSync } from 'node:fs';
import { constants, setPriority } from 'node:os';
import { getAnimal } from '../src/animals/registry';
import { WOLF_DESIGNS } from '../src/animals/wolf-design';
import { wolfDie } from '../src/animals/wolf-dice';
import { localUp } from '../src/physics/classify';
import { DiceWorld, loadRapier } from '../src/physics/dice-world';
import { createRng } from '../src/physics/rng';
import { GENERIC_POSES, type GenericPose } from '../src/rules/poses';
import { scoreRoll, type RollKind } from '../src/rules/scoring';

// Long runs stay out of the way of whatever else the machine is doing.
try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  /* not permitted: run at normal priority */
}

const tuneArg = process.argv.find((a) => a.startsWith('--tune='));
/** --dump=file writes every throw's resting up-vectors and contacts, for re-classifying offline. */
const dumpArg = process.argv.find((a) => a.startsWith('--dump='));
const dump: { up: number[][]; touching: boolean; stacked: boolean }[] = [];
const tune = tuneArg ? (JSON.parse(tuneArg.slice('--tune='.length)) as Record<string, number>) : null;
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
const throws = Number(args[0] ?? 20000);
/** --tune='{"rump":0.06}' rebuilds a wolf design with that tuning, without editing the source. */
const die = (id: string) => {
  const design = WOLF_DESIGNS.find((d) => d.id === id);
  return tune && design ? wolfDie(design, tune) : getAnimal(id);
};
const animalA = die(args[1] ?? 'winter');
const animalB = die(args[2] ?? args[1] ?? 'winter');

const R = await loadRapier();
const rng = createRng(20261113);
const poseCounts = new Map<GenericPose, number>(GENERIC_POSES.map((p) => [p, 0]));
const kindCounts = new Map<RollKind, number>();
let unsettled = 0;
let totalSteps = 0;
let totalPoints = 0;

const started = Date.now();
for (let i = 0; i < throws; i++) {
  // A fresh world per throw keeps each throw independent and deterministic.
  const world = new DiceWorld(R, [animalA, animalB]);
  world.throwDice({ angle: (rng() - 0.5) * 0.8, power: 0.3 + rng() * 0.7, seed: Math.floor(rng() * 2 ** 32) });
  const settled = world.settle();
  if (dumpArg) {
    dump.push({
      up: world.dice.map((d) => localUp(d.body.rotation()).map((v) => Number(v.toFixed(4)))),
      touching: settled.touching,
      stacked: settled.stacked,
    });
  }
  world.free();
  if (!settled.settled) unsettled++;
  totalSteps += settled.steps;
  for (const p of settled.poses) poseCounts.set(p, (poseCounts.get(p) ?? 0) + 1);
  const result = scoreRoll({
    dice: [
      { animal: animalA.scoring, pose: settled.poses[0] },
      { animal: animalB.scoring, pose: settled.poses[1] },
    ],
    touching: settled.touching,
    stacked: settled.stacked,
  });
  kindCounts.set(result.kind, (kindCounts.get(result.kind) ?? 0) + 1);
  totalPoints += result.bust ? 0 : result.points;
}

const dice = throws * 2;
const pct = (n: number, of: number) => Number(((n / of) * 100).toFixed(2));
const report = {
  animals: [animalA.scoring.id, animalB.scoring.id],
  throws,
  seconds: (Date.now() - started) / 1000,
  avgSimSeconds: Number(((totalSteps / throws) / 240).toFixed(2)),
  unsettledPct: pct(unsettled, throws),
  posePct: Object.fromEntries([...poseCounts].map(([p, n]) => [p, pct(n, dice)])),
  resultPct: Object.fromEntries([...kindCounts].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, pct(n, throws)])),
  avgPointsPerRoll: Number((totalPoints / throws).toFixed(2)),
};

if (dumpArg) writeFileSync(dumpArg.slice('--dump='.length), JSON.stringify({ tune, throws, dump }));

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n${report.animals.join(' + ')}: ${throws} throws in ${report.seconds}s (avg ${report.avgSimSeconds}s simulated, ${report.unsettledPct}% timed out)\n`);
  console.log('Pose frequency (per die):');
  for (const [p, v] of Object.entries(report.posePct)) console.log(`  ${p.padEnd(14)} ${String(v).padStart(6)}%`);
  console.log('\nRoll results (per throw):');
  for (const [k, v] of Object.entries(report.resultPct)) console.log(`  ${k.padEnd(14)} ${String(v).padStart(6)}%`);
  console.log(`\nAverage points per non-bust-weighted roll: ${report.avgPointsPerRoll}`);
}
