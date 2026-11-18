/**
 * Searches seeds until every demo result has a real Auto-roll throw that lands on it, and
 * merges what it finds into src/demo/demo-seeds.json. Run several in parallel with different
 * starts; each one only fills keys that are still missing.
 *
 *   npx tsx tools/find-demo-seeds.ts [start=1] [stride=1] [maxThrows=200000]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { constants, setPriority } from 'node:os';
import { getAnimal } from '../src/animals/registry';
import { DEMO_KEYS, demoThrow, resultKey } from '../src/demo/results';
import { DiceWorld, loadRapier } from '../src/physics/dice-world';

try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  /* not permitted: run at normal priority */
}

const FILE = 'src/demo/demo-seeds.json';
const [start = 1, stride = 1, max = 200000] = process.argv.slice(2).map(Number);
const read = (): Record<string, number> => (existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, number>) : {});

const R = await loadRapier();
const wolf = getAnimal('winter');
const found: Record<string, number> = {};
let tried = 0;
for (let seed = start; tried < max; seed += stride, tried++) {
  if (tried % 500 === 0) {
    const all = { ...read(), ...found };
    if (DEMO_KEYS.every((k) => all[k] !== undefined)) break;
  }
  const world = new DiceWorld(R, [wolf, wolf]);
  world.throwDice(demoThrow(seed));
  const key = resultKey(world.settle());
  world.free();
  if (DEMO_KEYS.includes(key) && found[key] === undefined && read()[key] === undefined) {
    found[key] = seed;
    writeFileSync(FILE, JSON.stringify({ ...read(), [key]: seed }, null, 2) + '\n');
    console.log(`${key}: seed ${seed} (after ${tried + 1} throws)`);
  }
}
const all = read();
console.log(`missing: ${DEMO_KEYS.filter((k) => all[k] === undefined).join(', ') || 'none'}`);
