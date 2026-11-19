import type { AnimalScoring } from '../rules/animal';

/**
 * Wolf pose names and points. Points follow the real pig game's table (Kern 2006 odds),
 * with the sitting Howl added as the rarest pose. Targets live in src/animals/wolf-targets.ts.
 */
export const WOLF_SCORING: AnimalScoring = {
  id: 'wolf',
  name: 'Wolf',
  plural: 'wolves',
  poseNames: {
    sideMarkUp: 'Moon side',
    sideMarkDown: 'Plain side',
    back: 'Play Dead',
    upright: 'Prowl',
    noseDown: 'Sniff',
    lean: 'Pounce',
    tailDown: 'Howl',
  },
  points: { back: 5, upright: 5, noseDown: 10, lean: 15, tailDown: 25 },
};
