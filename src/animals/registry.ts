import type { AnimalDefinition } from './body';
import { DIREWOLF_ANIMALS } from './direwolf-animals';
import { WOLF } from './wolf';

/** Dice a player can pick, in picker order. */
export const PICKABLE: readonly AnimalDefinition[] = DIREWOLF_ANIMALS;
export const DEFAULT_DIE = 'warden';

/**
 * Every die the engine knows. `wolf` is the original capsule wolf: no longer offered,
 * kept as a fast physics fixture and so old saved settings still resolve.
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
