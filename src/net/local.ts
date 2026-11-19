import { Reassembler, chunk, type NetMessage, type Transport } from './transport';

/**
 * Local network play: plain WebRTC with no relay, no STUN and no internet. The connection offer
 * and answer travel as short codes the players pass by hand (copy and paste, a chat, reading it
 * out). With no ICE servers the browsers only offer their local addresses, so this works between
 * devices on the same network.
 *
 * The host keeps one connection per guest (a star); a guest has one connection, to the host.
 */

const CONFIG: RTCConfiguration = { iceServers: [] };
const LABEL = 'pass-the-wolf';

/** Compress a session description into a short, copyable code. */
async function encode(desc: RTCSessionDescriptionInit, from: string): Promise<string> {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp, f: from });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decode(code: string): Promise<{ desc: RTCSessionDescriptionInit; from: string }> {
  const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const o = JSON.parse(await new Response(stream).text()) as { t: RTCSdpType; s: string; f: string };
  return { desc: { type: o.t, sdp: o.s }, from: o.f };
}

/** Wait until the browser has gathered every local address, so one code carries them all. */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    // Some browsers never report "complete" without a network; take what we have after 3 s.
    setTimeout(resolve, 3000);
  });
}

const newId = () => Math.random().toString(36).slice(2, 10);

class Link {
  readonly assembler = new Reassembler();
  channel: RTCDataChannel | null = null;
  constructor(
    readonly pc: RTCPeerConnection,
    readonly peerId: string,
  ) {}

  send(msg: NetMessage): void {
    if (this.channel?.readyState !== 'open') return;
    for (const frame of chunk(JSON.stringify(msg), newId())) this.channel.send(frame);
  }
}

function wire(link: Link, channel: RTCDataChannel, transport: Transport, joined: () => void): void {
  link.channel = channel;
  channel.onopen = () => {
    joined();
    transport.onPeerJoin(link.peerId);
  };
  channel.onmessage = (e) => {
    const whole = link.assembler.push(String(e.data));
    if (whole) transport.onMessage(JSON.parse(whole) as NetMessage, link.peerId);
  };
  channel.onclose = () => transport.onPeerLeave(link.peerId);
}

/** The host side: invite guests one at a time, each with its own code exchange. */
export class LocalHost implements Transport {
  readonly selfId = `host-${newId()}`;
  private readonly links = new Map<string, Link>();
  onMessage: Transport['onMessage'] = () => {};
  onPeerJoin: Transport['onPeerJoin'] = () => {};
  onPeerLeave: Transport['onPeerLeave'] = () => {};

  /**
   * Make an invite code for one guest. Give the code to the guest, then pass their reply code to
   * `accept`. Resolves when that guest is connected.
   */
  async invite(): Promise<{ code: string; accept: (reply: string) => Promise<void> }> {
    const pc = new RTCPeerConnection(CONFIG);
    const channel = pc.createDataChannel(LABEL, { ordered: true });
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = await encode(pc.localDescription!, this.selfId);
    return {
      code,
      accept: async (reply: string) => {
        const { desc, from } = await decode(reply);
        const link = new Link(pc, from);
        this.links.set(from, link);
        const open = new Promise<void>((resolve) => wire(link, channel, this, resolve));
        await pc.setRemoteDescription(desc);
        await open;
      },
    };
  }

  send(msg: NetMessage, to?: string): void {
    for (const [id, link] of this.links) if (!to || to === id) link.send(msg);
  }

  leave(): void {
    for (const link of this.links.values()) link.pc.close();
    this.links.clear();
  }
}

/** The guest side: take the host's invite code, hand back a reply code, then wait to connect. */
export class LocalGuest implements Transport {
  readonly selfId = `guest-${newId()}`;
  private link: Link | null = null;
  onMessage: Transport['onMessage'] = () => {};
  onPeerJoin: Transport['onPeerJoin'] = () => {};
  onPeerLeave: Transport['onPeerLeave'] = () => {};

  /** Returns the reply code for the host, and a promise that resolves once connected. */
  async answer(invite: string): Promise<{ code: string; connected: Promise<void> }> {
    const { desc, from } = await decode(invite);
    const pc = new RTCPeerConnection(CONFIG);
    const link = new Link(pc, from);
    this.link = link;
    const connected = new Promise<void>((resolve) => {
      pc.ondatachannel = (e) => wire(link, e.channel, this, resolve);
    });
    await pc.setRemoteDescription(desc);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return { code: await encode(pc.localDescription!, this.selfId), connected };
  }

  send(msg: NetMessage): void {
    this.link?.send(msg);
  }

  leave(): void {
    this.link?.pc.close();
    this.link = null;
  }
}
