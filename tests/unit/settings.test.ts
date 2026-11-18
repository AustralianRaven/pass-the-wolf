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

  it('Scenario: Given solo defaults, Then every seat throws a pair of winter wolves', () => {
    const s = defaultSetup('solo');
    expect(s.seats[0]?.dice, 'Then the human seat throws two winter wolves').toEqual(['winter', 'winter']);
    expect(s.seats[1]?.dice, 'Then the computer throws two winter wolves').toEqual(['winter', 'winter']);
  });

  it('Scenario: Given a table seat, Then the game seat throws its winter wolf pair', () => {
    const s = defaultSetup('table');
    expect(toSeats(s)[0]?.dice, 'Then the pair reaches the rules engine').toEqual(['winter', 'winter']);
  });

  it.each([
    ['saved before dice existed', undefined],
    ['naming the retired capsule wolf', ['wolf', 'wolf']],
    ['naming a retired direwolf', ['warden', 'frostmane']],
    ['naming an unknown die', ['badger', 'winter']],
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
    expect(loaded.seats[0]?.dice, 'Then the human falls back to winter wolves').toEqual(['winter', 'winter']);
    expect(loaded.seats[1]?.dice, 'Then the computer falls back to winter wolves').toEqual(['winter', 'winter']);
  });
});
