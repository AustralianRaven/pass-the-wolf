import type { DiceWorld } from '../physics/dice-world';

/**
 * A recorded tumble, so the other tables see exactly the throw the thrower saw (#2). Physics is
 * not bit-identical across CPUs and browsers, so a seed alone could land differently elsewhere;
 * a recording cannot. Every 4th physics step (60 frames a second) both dice are stored as a
 * position in millimetres and a rotation quaternion, packed into 16-bit integers: 28 bytes a
 * frame, a few kilobytes a throw.
 */
export const TRACK_EVERY = 4;

/** Append one frame (both dice) to `out`. */
export function trackFrame(world: DiceWorld, out: number[]): void {
  for (const die of world.dice) {
    const p = die.body.translation();
    const q = die.body.rotation();
    out.push(Math.round(p.x * 1000), Math.round(p.y * 1000), Math.round(p.z * 1000), Math.round(q.x * 32767), Math.round(q.y * 32767), Math.round(q.z * 32767), Math.round(q.w * 32767));
  }
}

export function encodeTrack(values: readonly number[]): string {
  const ints = Int16Array.from(values, (v) => Math.max(-32768, Math.min(32767, v)));
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeTrack(text: string): Int16Array {
  const bin = atob(text);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}
