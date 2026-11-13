import { WOLF_SCORING } from '../../src/animals/wolf-scoring';
import type { AnimalScoring } from '../../src/rules/animal';
import type { GenericPose } from '../../src/rules/poses';
import type { RollOutcome, RollResult } from '../../src/rules/scoring';
import type { Seat } from '../../src/rules/game';

/** Test-only second animal, to prove mixed pairs work before a real sheep exists. */
export const TEST_SHEEP: AnimalScoring = {
  id: 'sheep',
  name: 'Sheep',
  plural: 'sheep',
  poseNames: {
    sideMarkUp: 'Tag side',
    sideMarkDown: 'Fleece side',
    back: 'Legs Up',
    upright: 'Graze',
    noseDown: 'Nibble',
    tailDown: 'Woolpack',
  },
  points: { back: 4, upright: 6, noseDown: 12, tailDown: 20 },
};

export const wolf = WOLF_SCORING;

export function outcome(
  a: GenericPose,
  b: GenericPose,
  opts: { touching?: boolean; stacked?: boolean; animals?: [AnimalScoring, AnimalScoring] } = {},
): RollOutcome {
  const [animalA, animalB] = opts.animals ?? [wolf, wolf];
  return {
    dice: [
      { animal: animalA, pose: a },
      { animal: animalB, pose: b },
    ],
    touching: opts.touching ?? opts.stacked ?? false,
    stacked: opts.stacked ?? false,
  };
}

export const seats = (n: number): Seat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `Player ${i + 1}`,
    kind: 'human' as const,
    dice: ['wolf', 'wolf'] as const,
  }));

export const points = (p: number, label = `+${p}`): RollResult => ({
  kind: 'score',
  points: p,
  label,
  bust: false,
  wipesBank: false,
});
export const scattered: RollResult = { kind: 'scattered', points: 0, label: 'Scattered', bust: true, wipesBank: false };
export const tangled: RollResult = { kind: 'tangled', points: 0, label: 'Tangled', bust: true, wipesBank: true };
