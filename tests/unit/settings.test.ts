import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSetup, loadSetup, toSeats } from '../../src/game/settings';

/** Minimal in-memory localStorage for the node test environment. */
function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

describe('Feature: seat dice settings', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('Scenario: Given solo defaults, Then you throw Wardens and the computer brings a different pair', () => {
    const s = defaultSetup('solo');
    expect(s.seats[0]?.dice, 'Then the human seat throws two Wardens').toEqual(['warden', 'warden']);
    expect(s.seats[1]?.dice, 'Then the computer throws Stalker + Old Grizzle').toEqual(['stalker', 'grizzle']);
  });

  it('Scenario: Given a seat picks Frostmane and Stalker, Then the game seat throws that pair', () => {
    const s = defaultSetup('table');
    s.seats[0]!.dice = ['frostmane', 'stalker'];
    expect(toSeats(s)[0]?.dice, 'Then the mixed pair reaches the rules engine').toEqual(['frostmane', 'stalker']);
  });

  it.each([
    ['saved before dice existed', undefined],
    ['naming the retired capsule wolf', ['wolf', 'wolf']],
    ['naming an unknown die', ['badger', 'warden']],
  ])('Scenario: Given settings %s, When they load, Then each seat gets a valid pair', (_label, dice) => {
    const saved = {
      mode: 'table',
      targetScore: 100,
      seats: [
        { name: 'Kat', kind: 'human', colour: '#a58bd6', ...(dice ? { dice } : {}) },
        { name: 'Ash', kind: 'cpu', colour: '#e07a3a', ...(dice ? { dice } : {}) },
      ],
    };
    stubStorage({ 'pass-the-wolf:setup': JSON.stringify(saved) });
    const loaded = loadSetup();
    expect(loaded.seats[0]?.name, 'Then the names survive').toBe('Kat');
    expect(loaded.seats[0]?.dice, 'Then the human falls back to Wardens').toEqual(['warden', 'warden']);
    expect(loaded.seats[1]?.dice, 'Then the computer falls back to its own pair').toEqual(['stalker', 'grizzle']);
  });
});
