import type { AnimalDefinition } from './body';
import { PIG_HITBOX } from './pig-hitbox';
import { WOLF_DESIGNS, type WolfDesign } from './wolf-design';
import { WOLF_SCORING } from './wolf-scoring';
import type { AnimalScoring } from '../rules/animal';

/** A wolf design's scoring: the shared wolf table under the design's own id and name. */
function scoringFor(design: WolfDesign): AnimalScoring {
  return { ...WOLF_SCORING, id: design.id, name: design.name, plural: `${design.name}s` };
}

/**
 * A wolf die: display-only wolf, physics on the shared pig hitbox. The fit shrinks the wolf
 * a little and centres it on the pig's body so it sits inside the hitbox.
 */
function toAnimal(design: WolfDesign): AnimalDefinition {
  return {
    scoring: scoringFor(design),
    parts: PIG_HITBOX,
    fit: { scale: 0.88, offset: [0.02, 0, 0] },
    palette: { body: design.coat.base, accent: design.coat.saddle },
    markAt: design.markAt,
    pitch: design.pitch,
  };
}

export const WOLF_DICE: readonly AnimalDefinition[] = WOLF_DESIGNS.map(toAnimal);
export const WINTER_WOLF: AnimalDefinition = WOLF_DICE[0]!;
