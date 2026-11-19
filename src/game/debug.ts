import { GENERIC_POSES, type GenericPose } from '../rules/poses';
import type { SettledDice } from '../physics/dice-world';

/**
 * URL flags for testing and debugging:
 * - `?seed=123`   makes every throw repeatable (throw n uses seed + n).
 * - `?fast=1`     settles throws instantly instead of animating them.
 * - `?force=a,b`  overrides the next landings in order. Each entry is
 *                 `pose/pose` (e.g. `tailDown/sideMarkUp`), `tangled` or `alpha`.
 */
export interface DebugFlags {
  readonly seed: number | null;
  readonly fast: boolean;
  readonly forced: SettledDice[];
  /** `?winner=1`: play the winner cutscene even in fast mode (for its e2e test). */
  readonly winnerScene: boolean;
}

function parseForced(entry: string): SettledDice | null {
  const base = { settled: true, steps: 0, support: 0 };
  if (entry === 'tangled') return { ...base, poses: ['sideMarkUp', 'sideMarkUp'], touching: true, stacked: false };
  if (entry === 'alpha') return { ...base, poses: ['upright', 'back'], touching: true, stacked: true, support: 1 };
  const [a, b] = entry.split('/');
  const isPose = (p: string | undefined): p is GenericPose => GENERIC_POSES.includes(p as GenericPose);
  if (!isPose(a) || !isPose(b)) return null;
  return { ...base, poses: [a, b], touching: false, stacked: false };
}

export function readDebugFlags(search = window.location.search): DebugFlags {
  const params = new URLSearchParams(search);
  const seedParam = params.get('seed');
  const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : null;
  const forced = (params.get('force') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseForced)
    .filter((x): x is SettledDice => x !== null);
  return { seed, fast: params.get('fast') === '1', forced, winnerScene: params.get('winner') === '1' };
}

/** Settings-menu debug options, remembered per browser. */
export interface DebugSettings {
  readonly enabled: boolean;
  readonly showHitboxes: boolean;
  /** An on-screen readout of each animal's state, for reporting rendering bugs. */
  readonly diagnostics: boolean;
}

const DEBUG_KEY = 'pass-the-wolf:debug';

export function loadDebugSettings(): DebugSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(DEBUG_KEY) ?? '{}') as Partial<DebugSettings>;
    return { enabled: raw.enabled === true, showHitboxes: raw.showHitboxes === true, diagnostics: raw.diagnostics === true };
  } catch {
    return { enabled: false, showHitboxes: false, diagnostics: false };
  }
}

export function saveDebugSettings(s: DebugSettings): void {
  try {
    localStorage.setItem(DEBUG_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the setting lasts for this visit only */
  }
}
