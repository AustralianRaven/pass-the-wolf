import type { AnimalDefinition } from './body';
import { WOLF } from './wolf';

export const ANIMALS: Readonly<Record<string, AnimalDefinition>> = {
  wolf: WOLF,
};

export function getAnimal(id: string): AnimalDefinition {
  const animal = ANIMALS[id];
  if (!animal) throw new Error(`Unknown animal "${id}".`);
  return animal;
}
