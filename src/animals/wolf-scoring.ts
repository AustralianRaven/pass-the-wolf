import type { AnimalScoring } from '../rules/animal';

/** Wolf pose names and points, set from measured pose rarity (see docs/calibration.md). */
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
    tailDown: 'Howl',
  },
  points: { back: 5, upright: 5, noseDown: 10, tailDown: 20 },
};
