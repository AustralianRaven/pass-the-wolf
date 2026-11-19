import type { SettledDice } from '../physics/dice-world';
import type { Setup } from '../game/settings';
import type { NetMessage, Transport } from './transport';

/**
 * An online game (#2). The host sequences everything: guests send their actions to the host as
 * intents, the host checks each one (is it really that player's turn?) and broadcasts it as a
 * numbered event, and every device, the host included, applies the same events in the same order
 * to the same rules engine. So every table agrees on every score without a server.
 *
 * A throw event carries the thrower's settled result, its seed and a recording of the tumble, so
 * the other tables replay exactly what the thrower saw: Auto-roll and hand throws alike.
 */

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
  readonly animal: string;
  readonly connected: boolean;
}

export type GameEvent =
  | { readonly type: 'throw'; readonly seat: number; readonly settled: SettledDice; readonly track: string; readonly seed: number | null }
  | { readonly type: 'take'; readonly seat: number }
  | { readonly type: 'bank'; readonly seat: number }
  /** A player who dropped out loses their turn. */
  | { readonly type: 'skip'; readonly seat: number }
  | { readonly type: 'rematch' };

export interface StartInfo {
  readonly setup: Setup;
  /** Peer id that plays each seat. */
  readonly owners: readonly string[];
}

type Role = 'host' | 'guest';

export class NetSession {
  readonly role: Role;
  private players: Player[] = [];
  private hostId: string | null;
  private started: StartInfo | null = null;
  private readonly log: { ev: GameEvent; by: string }[] = [];

  onRoster: (players: readonly Player[]) => void = () => {};
  onStart: (info: StartInfo, replay: readonly { ev: GameEvent; by: string }[]) => void = () => {};
  onEvent: (ev: GameEvent, by: string) => void = () => {};
  onOwners: (owners: readonly string[]) => void = () => {};
  onClosed: (reason: string) => void = () => {};
  /** A seat's player dropped (host only): the controller decides whether to skip their turn. */
  onDropped: (seat: number) => void = () => {};
  /** Host only: may `by` do `ev` right now? Set by the game controller once play starts. */
  validate: (ev: GameEvent, by: string) => boolean = () => false;

  constructor(
    readonly transport: Transport,
    role: Role,
    private readonly me: Omit<Player, 'id' | 'connected'>,
  ) {
    this.role = role;
    this.hostId = role === 'host' ? transport.selfId : null;
    if (role === 'host') this.players = [{ ...me, id: transport.selfId, connected: true }];
    transport.onMessage = (msg, from) => this.receive(msg, from);
    transport.onPeerJoin = (id) => this.peerJoined(id);
    transport.onPeerLeave = (id) => this.peerLeft(id);
  }

  get selfId(): string {
    return this.transport.selfId;
  }

  get roster(): readonly Player[] {
    return this.players;
  }

  get isHost(): boolean {
    return this.role === 'host';
  }

  /** Guests: say hello (again) so the host lists us. Safe to call any time. */
  hello(to?: string): void {
    if (this.role === 'guest') this.transport.send({ t: 'hello', player: this.me }, to);
  }

  /** Host: deal the game to every player in the lobby. */
  start(buildSetup: (players: readonly Player[]) => StartInfo): void {
    if (!this.isHost || this.started) return;
    this.started = buildSetup(this.players);
    this.transport.send({ t: 'start', info: this.started, replay: [] });
    this.onStart(this.started, []);
  }

  /** Ask to do something. The host applies it if valid; a guest sends it to the host. */
  submit(ev: GameEvent): void {
    if (this.isHost) {
      if (this.validate(ev, this.selfId)) this.dispatch(ev, this.selfId);
    } else if (this.hostId) {
      this.transport.send({ t: 'intent', ev }, this.hostId);
    }
  }

  /** Host: apply an event on its own authority (for a dropped player's turn, say). */
  force(ev: GameEvent): void {
    if (this.isHost) this.dispatch(ev, this.selfId);
  }

  leave(): void {
    if (this.isHost) this.transport.send({ t: 'end', reason: 'The host ended the game.' });
    this.transport.leave();
  }

  private dispatch(ev: GameEvent, by: string): void {
    this.log.push({ ev, by });
    this.transport.send({ t: 'event', seq: this.log.length, ev, by });
    this.onEvent(ev, by);
  }

  private broadcastRoster(): void {
    this.transport.send({ t: 'roster', players: this.players, host: this.selfId });
    this.onRoster(this.players);
  }

  private peerJoined(id: string): void {
    if (this.isHost) this.transport.send({ t: 'roster', players: this.players, host: this.selfId }, id);
    else this.hello(id);
  }

  private peerLeft(id: string): void {
    if (this.isHost) {
      const seatOf = this.started?.owners.indexOf(id) ?? -1;
      this.players = this.players.map((p) => (p.id === id ? { ...p, connected: false } : p));
      this.broadcastRoster();
      if (seatOf >= 0) this.onDropped(seatOf);
    } else if (id === this.hostId) {
      this.onClosed('The host left, so the game has ended.');
    }
  }

  private receive(msg: NetMessage, from: string): void {
    if (this.isHost) return this.receiveAsHost(msg, from);
    // Guests trust only the host.
    if (msg.t === 'roster' && (this.hostId === null || this.hostId === msg.host)) {
      this.hostId = msg.host as string;
      this.players = msg.players as Player[];
      this.onRoster(this.players);
    } else if (from !== this.hostId) {
      return;
    } else if (msg.t === 'start') {
      this.started = msg.info as StartInfo;
      this.onStart(this.started, msg.replay as { ev: GameEvent; by: string }[]);
    } else if (msg.t === 'event') {
      this.onEvent(msg.ev as GameEvent, msg.by as string);
    } else if (msg.t === 'owners' && this.started) {
      this.started = { ...this.started, owners: msg.owners as string[] };
      this.onOwners(this.started.owners);
    } else if (msg.t === 'end') {
      this.onClosed(String(msg.reason));
    }
  }

  private receiveAsHost(msg: NetMessage, from: string): void {
    if (msg.t === 'hello') {
      const info = msg.player as Omit<Player, 'id' | 'connected'>;
      if (this.started) return this.rejoin(info, from);
      const others = this.players.filter((p) => p.id !== from);
      if (others.length >= 6) return void this.transport.send({ t: 'end', reason: 'The table is full (6 players).' }, from);
      this.players = [...others, { ...info, id: from, connected: true }];
      this.broadcastRoster();
    } else if (msg.t === 'intent' && this.started) {
      const ev = msg.ev as GameEvent;
      if (this.validate(ev, from)) this.dispatch(ev, from);
    }
  }

  /** Mid-game, a dropped player can come back under the same name and take their seat again. */
  private rejoin(info: Omit<Player, 'id' | 'connected'>, from: string): void {
    const started = this.started!;
    const old = this.players.find((p) => !p.connected && p.name === info.name);
    if (!old) return void this.transport.send({ t: 'end', reason: 'That game has already started.' }, from);
    this.players = this.players.map((p) => (p.id === old.id ? { ...p, id: from, connected: true } : p));
    this.started = { ...started, owners: started.owners.map((o) => (o === old.id ? from : o)) };
    this.broadcastRoster();
    this.transport.send({ t: 'owners', owners: this.started.owners });
    this.onOwners(this.started.owners);
    // Catch them up: the deal, then every event so far (replayed without the tumbles).
    this.transport.send({ t: 'start', info: this.started, replay: this.log }, from);
  }
}
