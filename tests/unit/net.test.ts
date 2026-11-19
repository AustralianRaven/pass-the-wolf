import { describe, expect, it } from 'vitest';
import { NetSession, type GameEvent, type Player, type StartInfo } from '../../src/net/session';
import { MemoryHub, Reassembler, chunk } from '../../src/net/transport';
import { decodeTrack, encodeTrack } from '../../src/net/track';

const settle = () => new Promise((r) => setTimeout(r, 0));

const deal = (players: readonly Player[]): StartInfo => ({
  setup: {
    mode: 'table',
    targetScore: 100,
    seats: players.map((p) => ({ name: p.name, kind: 'human', colour: p.colour, dice: [p.animal, p.animal] })),
  },
  owners: players.map((p) => p.id),
});

/** A host and two guests on an in-memory network, each logging the events it applies. */
async function table() {
  const hub = new MemoryHub();
  const host = new NetSession(hub.connect('host'), 'host', { name: 'Kat', colour: '#a58bd6', animal: 'winter' });
  const ash = new NetSession(hub.connect('ash'), 'guest', { name: 'Ash', colour: '#e07a3a', animal: 'pig' });
  const rue = new NetSession(hub.connect('rue'), 'guest', { name: 'Rue', colour: '#5b9bd5', animal: 'tortoise' });
  const applied = new Map<NetSession, GameEvent[]>([host, ash, rue].map((s) => [s, []]));
  for (const s of [host, ash, rue]) s.onEvent = (ev) => applied.get(s)!.push(ev);
  await settle();
  ash.hello();
  rue.hello();
  await settle();
  return { hub, host, ash, rue, applied };
}

describe('Feature: the online lobby', () => {
  it('Scenario: Given a host and two guests, When the guests say hello, Then every lobby lists all three', async () => {
    const { host, ash, rue } = await table();
    for (const s of [host, ash, rue]) expect(s.roster.map((p) => p.name).sort(), 'Then the pack is complete everywhere').toEqual(['Ash', 'Kat', 'Rue']);
  });

  it('Scenario: Given a full lobby, When the host deals, Then every guest starts the same game', async () => {
    const { host, ash, rue } = await table();
    const started: StartInfo[] = [];
    for (const s of [ash, rue]) s.onStart = (info) => started.push(info);
    host.start(deal);
    await settle();
    expect(started.length, 'Then both guests are dealt in').toBe(2);
    expect(started[0], 'Then they get the same seats and owners').toEqual(started[1]);
    expect(started[0]!.setup.seats.map((s) => s.dice[0]), 'Then each seat throws its own animal').toEqual(['winter', 'pig', 'tortoise']);
  });
});

describe('Feature: the host keeps every table in step', () => {
  it('Scenario: Given the host allows only the current seat, When a guest acts out of turn, Then nobody applies it', async () => {
    const { host, ash, rue, applied } = await table();
    host.start(deal);
    // Seat 1 (Ash) may take; Rue may not.
    host.validate = (ev, by) => ev.type === 'take' && ev.seat === 1 && by === 'ash';
    rue.submit({ type: 'take', seat: 2 });
    ash.submit({ type: 'take', seat: 1 });
    await settle();
    await settle();
    for (const s of [host, ash, rue]) expect(applied.get(s), 'Then only the valid move is applied, everywhere').toEqual([{ type: 'take', seat: 1 }]);
  });

  it('Scenario: Given several moves, Then every table applies them in the host order', async () => {
    const { host, ash, rue, applied } = await table();
    host.start(deal);
    host.validate = () => true;
    host.submit({ type: 'take', seat: 0 });
    ash.submit({ type: 'bank', seat: 1 });
    host.submit({ type: 'bank', seat: 0 });
    await settle();
    await settle();
    const order = applied.get(host)!;
    expect(applied.get(ash), 'Then Ash sees the host order').toEqual(order);
    expect(applied.get(rue), 'Then Rue sees the host order').toEqual(order);
  });

  it('Scenario: Given a guest drops mid-game, When they come back under the same name, Then they get their seat and every move so far', async () => {
    const { hub, host, ash } = await table();
    host.start(deal);
    host.validate = () => true;
    host.submit({ type: 'take', seat: 0 });
    await settle();
    ash.transport.leave();
    await settle();
    expect(host.roster.find((p) => p.name === 'Ash')?.connected, 'Then the host marks Ash away').toBe(false);
    const back = new NetSession(hub.connect('ash-2'), 'guest', { name: 'Ash', colour: '#e07a3a', animal: 'pig' });
    let caughtUp: { info: StartInfo; replay: readonly unknown[] } | null = null;
    back.onStart = (info, replay) => (caughtUp = { info, replay });
    await settle();
    back.hello();
    await settle();
    await settle();
    expect(caughtUp!.info.owners[1], 'Then seat 1 now belongs to the returning device').toBe('ash-2');
    expect(caughtUp!.replay.length, 'Then the move so far is replayed to them').toBe(1);
  });
});

describe('Feature: throws travel as a recording', () => {
  it('Scenario: Given a recorded tumble, When it is encoded and decoded, Then every frame comes back exactly', () => {
    const frames = [1234, -567, 890, 32767, -32768, 0, 12, 4, 5, 6, 7, 8, 9, 10];
    expect([...decodeTrack(encodeTrack(frames))], 'Then the recording round-trips').toEqual(frames);
  });

  it('Scenario: Given a message too big for one data-channel frame, When it is chunked, Then it reassembles whole', () => {
    const big = 'x'.repeat(40_000);
    const r = new Reassembler();
    const frames = chunk(big, 'm1');
    expect(frames.length, 'Then it is split').toBeGreaterThan(1);
    const results = frames.reverse().map((f) => r.push(f));
    expect(results.filter(Boolean), 'Then exactly one whole message comes out').toEqual([big]);
  });
});
