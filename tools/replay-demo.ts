/** Replays every recorded demo seed and prints what it lands on now. */
import { getAnimal } from '../src/animals/registry';
import { DEMO_RESULTS, demoThrow, restAtEdge, resultKey } from '../src/demo/results';
import seeds from '../src/demo/demo-seeds.json';
import { DiceWorld, loadRapier } from '../src/physics/dice-world';

const R = await loadRapier();
const wolf = getAnimal('winter');
for (const r of DEMO_RESULTS) {
  const seed = (seeds as Record<string, number>)[r.key];
  if (seed === undefined) continue;
  const world = new DiceWorld(R, [wolf, wolf]);
  restAtEdge(world);
  world.throwDice(demoThrow(seed));
  const key = resultKey(world.settle());
  console.log(`${key === r.key ? 'ok  ' : 'MOVED'} ${r.label.padEnd(18)} -> ${key}`);
  world.free();
}
