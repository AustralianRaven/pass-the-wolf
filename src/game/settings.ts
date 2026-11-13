import { DEFAULT_DIE, isPickable } from '../animals/registry';
import { DEFAULT_TARGET_SCORE, MAX_SEATS, MIN_SEATS } from '../rules/constants';
import type { Seat, SeatKind } from '../rules/game';

export type TableMode = 'solo' | 'table';

export type DicePair = [string, string];

export interface SeatSetup {
  name: string;
  kind: SeatKind;
  colour: string;
  /** The two wolves this seat throws, by id. */
  dice: DicePair;
}

export interface Setup {
  mode: TableMode;
  seats: SeatSetup[];
  targetScore: number;
}

/** Seat colours: pegs, collars and the handover band. Lilac first. */
export const SEAT_COLOURS = ['#a58bd6', '#e07a3a', '#5b9bd5', '#6fae6a', '#e3b341', '#efe7da'] as const;
export const CPU_NAMES = ['Ember', 'Birch', 'Sleet', 'Juniper', 'Flint'] as const;
/** Computer seats each bring a different pair, so the table shows off the pack. */
export const CPU_DICE: readonly DicePair[] = [
  ['stalker', 'grizzle'],
  ['frostmane', 'runner'],
  ['warden', 'frostmane'],
  ['runner', 'stalker'],
  ['grizzle', 'warden'],
];
export const TARGET_CHOICES = [50, 100, 150, 200] as const;

const STORAGE_KEY = 'pass-the-wolf:setup';
const HUMAN_DICE: DicePair = [DEFAULT_DIE, DEFAULT_DIE];

export function cpuDice(index: number): DicePair {
  return [...(CPU_DICE[index % CPU_DICE.length] ?? HUMAN_DICE)] as DicePair;
}

export function defaultSetup(mode: TableMode = 'solo'): Setup {
  return mode === 'solo'
    ? {
        mode,
        targetScore: DEFAULT_TARGET_SCORE,
        seats: [
          { name: 'You', kind: 'human', colour: SEAT_COLOURS[0], dice: [...HUMAN_DICE] },
          { name: CPU_NAMES[0], kind: 'cpu', colour: SEAT_COLOURS[1], dice: cpuDice(0) },
        ],
      }
    : {
        mode,
        targetScore: DEFAULT_TARGET_SCORE,
        seats: [
          { name: 'Player 1', kind: 'human', colour: SEAT_COLOURS[0], dice: [...HUMAN_DICE] },
          { name: 'Player 2', kind: 'human', colour: SEAT_COLOURS[1], dice: [...HUMAN_DICE] },
        ],
      };
}

function isSetup(value: unknown): value is Setup {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Setup>;
  return (
    (v.mode === 'solo' || v.mode === 'table') &&
    typeof v.targetScore === 'number' &&
    Array.isArray(v.seats) &&
    v.seats.length >= MIN_SEATS &&
    v.seats.length <= MAX_SEATS &&
    v.seats.every((s) => typeof s?.name === 'string' && (s.kind === 'human' || s.kind === 'cpu') && typeof s.colour === 'string')
  );
}

/** Saved settings from before dice choice (or naming a retired die) get a valid pair. */
function withValidDice(setup: Setup): Setup {
  let cpu = 0;
  return {
    ...setup,
    seats: setup.seats.map((s) => {
      const fallback = s.kind === 'cpu' ? cpuDice(cpu++) : [...HUMAN_DICE];
      const ok = Array.isArray(s.dice) && s.dice.length === 2 && s.dice.every((d) => typeof d === 'string' && isPickable(d));
      return { ...s, dice: ok ? ([s.dice[0], s.dice[1]] as DicePair) : (fallback as DicePair) };
    }),
  };
}

export function loadSetup(): Setup {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isSetup(parsed)) return withValidDice(parsed);
    }
  } catch {
    /* storage blocked or corrupt: fall back to defaults */
  }
  return defaultSetup();
}

export function saveSetup(setup: Setup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* storage blocked: settings just won't persist */
  }
}

export function cleanName(name: string, fallback: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, 18);
  return trimmed || fallback;
}

/** Turn the setup form into rules-engine seats. */
export function toSeats(setup: Setup): Seat[] {
  return withValidDice(setup).seats.map((s, i) => ({
    id: `seat-${i}`,
    name: cleanName(s.name, s.kind === 'cpu' ? (CPU_NAMES[i % CPU_NAMES.length] ?? 'Wolf') : `Player ${i + 1}`),
    kind: s.kind,
    dice: s.dice,
  }));
}
