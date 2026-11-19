import { MENAGERIE } from './menagerie';
import { WOLF_DESIGNS, type WolfDesign } from './wolf-design';

/** Every carved animal, in picker order: the winter wolf first, then the menagerie (#4). */
export const DESIGNS: readonly WolfDesign[] = [...WOLF_DESIGNS, ...MENAGERIE];

export function designFor(id: string): WolfDesign | undefined {
  return DESIGNS.find((d) => d.id === id);
}
