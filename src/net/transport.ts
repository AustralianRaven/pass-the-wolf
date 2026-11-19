/**
 * The network seam (#2). Game code talks to a Transport; it never imports a WebRTC library.
 * Two transports implement it:
 *
 * - Online (src/net/online.ts): a Trystero room. Public relays only introduce the players; game
 *   data then flows directly between them over WebRTC.
 * - Local network (src/net/local.ts): plain WebRTC with no relay and no internet. The host and each
 *   guest swap a short code once (copy and paste, or any chat), then the devices talk directly.
 *
 * Messages are small JSON objects. A guest only ever talks to the host; the host talks to everyone.
 */
export type NetMessage = { readonly t: string } & Record<string, unknown>;

export interface Transport {
  /** This device's peer id. */
  readonly selfId: string;
  /** Send to one peer, or to every peer when `to` is omitted. */
  send(msg: NetMessage, to?: string): void;
  onMessage: (msg: NetMessage, from: string) => void;
  onPeerJoin: (id: string) => void;
  onPeerLeave: (id: string) => void;
  leave(): void;
}

/**
 * Split a long JSON string into chunks a data channel can carry, and put them back together.
 * WebRTC data channels are only safe up to about 16 KB a message across browsers.
 */
export const CHUNK = 12_000;

export function chunk(text: string, id: string): string[] {
  const n = Math.max(1, Math.ceil(text.length / CHUNK));
  return Array.from({ length: n }, (_, i) => JSON.stringify({ c: id, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) }));
}

export class Reassembler {
  private readonly parts = new Map<string, string[]>();

  /** Feed one wire frame; returns the whole message once its last chunk arrives. */
  push(frame: string): string | null {
    const f = JSON.parse(frame) as { c: string; i: number; n: number; d: string };
    if (f.n === 1) return f.d;
    const got = this.parts.get(f.c) ?? new Array<string>(f.n);
    got[f.i] = f.d;
    this.parts.set(f.c, got);
    if (got.filter((x) => x !== undefined).length < f.n) return null;
    this.parts.delete(f.c);
    return got.join('');
  }
}

/** In-memory transports for tests: what one node sends, the addressed nodes receive. */
export class MemoryHub {
  private readonly nodes = new Map<string, Transport>();

  connect(id: string): Transport {
    const nodes = this.nodes;
    const node: Transport = {
      selfId: id,
      send(msg, to) {
        for (const [other, t] of nodes) if (other !== id && (!to || to === other)) queueMicrotask(() => t.onMessage(structuredClone(msg), id));
      },
      onMessage: () => {},
      onPeerJoin: () => {},
      onPeerLeave: () => {},
      leave() {
        nodes.delete(id);
        for (const t of nodes.values()) queueMicrotask(() => t.onPeerLeave(id));
      },
    };
    for (const t of nodes.values()) {
      queueMicrotask(() => {
        t.onPeerJoin(id);
        node.onPeerJoin(t.selfId);
      });
    }
    nodes.set(id, node);
    return node;
  }
}
