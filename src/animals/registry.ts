import type { AnimalDefinition } from './body';
import { WINTER_WOLF, WOLF_DICE } from './wolf-dice';
import { WOLF } from './wolf';

/** Dice a player can pick, in picker order. Only the winter wolf is carved so far. */
export const PICKABLE: readonly AnimalDefinition[] = WOLF_DICE;
export const DEFAULT_DIE = WINTER_WOLF.scoring.id;

/**
 * Every die the engine knows. `wolf` is the original capsule wolf: never offered,
 * kept as a fast physics fixture for tests.
 */
export const ANIMALS: Readonly<Record<string, AnimalDefinition>> = Object.fromEntries([
  ['wolf', WOLF],
  ...PICKABLE.map((a) => [a.scoring.id, a] as const),
]);

export function getAnimal(id: string): AnimalDefinition {
  const animal = ANIMALS[id];
  if (!animal) throw new Error(`Unknown animal "${id}".`);
  return animal;
}

export function isPickable(id: string): boolean {
  return PICKABLE.some((a) => a.scoring.id === id);
}
