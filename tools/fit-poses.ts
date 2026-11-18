/**
 * Re-classify saved rests (from `calibrate --dump`) with different Sniff / Pounce / Howl
 * boundaries, instantly, without throwing again. Prints each pose against its target band.
 *
 *   npx tsx tools/fit-poses.ts calibration/a.json [calibration/b.json ...] [--sit=0.6] [--nose=0.6] [--leanNose=0.55] [--leanTilt=0.5]
 */
import { readFileSync } from 'node:fs';
import { POSE_TARGETS, TOLERANCE } from '../src/animals/wolf-targets';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const num = (name: string, fallback: number) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split('=')[1]) : fallback;
};
const NOSE = num('nose', 0.6);
const SIT = num('sit', 0.6);
const LEAN_NOSE = num('leanNose', 0.55);
const LEAN_TILT = num('leanTilt', 0.5);

function classify([ux, uy, uz]: number[]): string {
  if (ux! > SIT) return 'tailDown';
  if (ux! < -LEAN_NOSE && Math.abs(uz!) >= LEAN_TILT) return 'lean';
  if (ux! < -NOSE) return 'noseDown';
  if (Math.abs(uy!) >= Math.abs(uz!)) return uy! > 0 ? 'upright' : 'back';
  return uz! > 0 ? 'sideMarkUp' : 'sideMarkDown';
}

const counts = new Map<string, number>();
let dice = 0;
for (const f of files) {
  const { dump } = JSON.parse(readFileSync(f, 'utf8')) as { dump: { up: number[][] }[] };
  for (const t of dump) {
    for (const up of t.up) {
      const p = classify(up);
      counts.set(p, (counts.get(p) ?? 0) + 1);
      dice++;
    }
  }
}
console.log(`${dice} rests, boundaries sit ${SIT}, nose ${NOSE}, lean nose ${LEAN_NOSE}, lean tilt ${LEAN_TILT}`);
for (const [pose, target] of Object.entries(POSE_TARGETS)) {
  const v = ((counts.get(pose) ?? 0) / dice) * 100;
  const ok = Math.abs(v - target) <= target * TOLERANCE;
  console.log(`  ${pose.padEnd(13)} ${v.toFixed(2).padStart(6)}%  target ${target}%  ${ok ? 'in band' : 'OUT'}`);
}
