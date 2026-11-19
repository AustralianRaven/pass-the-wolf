import type { NetMessage, Transport } from './transport';

/**
 * Online play: a Trystero room. Free public Nostr relays carry only the (encrypted) connection
 * offers so the players can find each other; the game itself then flows peer to peer over WebRTC.
 * Loaded on demand, so solo and table play never download it.
 */
export async function joinOnlineRoom(code: string): Promise<Transport> {
  const { joinRoom, selfId } = await import('trystero');
  const room = joinRoom({ appId: 'pass-the-wolf-v1' }, code.toUpperCase());
  const action = room.makeAction<string>('game');
  const transport: Transport = {
    selfId,
    send(msg: NetMessage, to?: string) {
      // Trystero chunks large payloads itself.
      void action.send(JSON.stringify(msg), to ? { target: to } : undefined);
    },
    onMessage: () => {},
    onPeerJoin: () => {},
    onPeerLeave: () => {},
    leave() {
      void room.leave();
    },
  };
  action.onMessage = (data, ctx) => transport.onMessage(JSON.parse(data) as NetMessage, ctx.peerId);
  room.onPeerJoin = (id) => transport.onPeerJoin(id);
  room.onPeerLeave = (id) => transport.onPeerLeave(id);
  return transport;
}

/** A short, readable room code, with no 0/O or 1/I to misread. */
export function newRoomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => abc[Math.floor(Math.random() * abc.length)]!;
  return `WOLF-${Array.from({ length: 5 }, pick).join('')}`;
}
