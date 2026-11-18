// Sum calibrate --json reports from parallel batches and check each result against its target.
// Usage: node tools/summarize.mjs calibration/run-*.report.json
import { readFileSync } from 'node:fs';
const T = { sideMarkDown: 34.8, sideMarkUp: 30.0, back: 22.4, upright: 8.8, noseDown: 3.0, lean: 0.6, tailDown: 0.4 };
const R = { tangled: 1.6, alpha: 0.05 };
let n = 0; let pts = 0; const pose = {}; const res = {};
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  n += j.throws; pts += j.avgPointsPerRoll * j.throws;
  for (const [k, v] of Object.entries(j.posePct)) pose[k] = (pose[k] ?? 0) + v * j.throws;
  for (const [k, v] of Object.entries(j.resultPct)) res[k] = (res[k] ?? 0) + v * j.throws;
}
const line = (k, v, t) => console.log(`${k.padEnd(13)} ${v.toFixed(3).padStart(7)}%  target ${t}%  ${Math.abs(v - t) <= t * 0.1 ? 'in band' : 'OUT'}`);
console.log(`${n} throws`);
for (const [k, t] of Object.entries(T)) line(k, pose[k] / n, t);
for (const [k, t] of Object.entries(R)) line(k, (res[k] ?? 0) / n, t);
console.log(`scattered ${(res.scattered / n).toFixed(2)}%, avg points per roll ${(pts / n).toFixed(2)}`);
