// Hill-climbs the shared pig hitbox toward the target odds.
//
// Each candidate tuning is thrown 10,000 times as four parallel batches on the same four seeds
// (common random numbers: every candidate sees identical throws, so differences are the shape,
// not luck). A change is kept only when the total distance from the targets shrinks.
//
//   node tools/tune-pig.mjs [iterations=24] [start.json]
// Progress: calibration/tune-log.txt. Best so far: calibration/tune-best.json.
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ITER = Number(process.argv[2] ?? 24);
const SEEDS = [11, 22, 33, 44];
const PER = 2500;
const LOG = 'calibration/tune-log.txt';
const BEST = 'calibration/tune-best.json';

const POSE = { sideMarkDown: 34.8, sideMarkUp: 30.0, back: 22.4, upright: 8.8, noseDown: 3.0, lean: 0.6, tailDown: 0.4 };
const ROLL = { tangled: 1.6, alpha: 0.05 };
// Alpha is ~5 events per 10,000 throws: too noisy to steer on, so it barely counts here.
const WEIGHT = { alpha: 0.1 };

/** Parameters the climber may move, with step sizes and hard limits. */
const KNOBS = [
  { path: ['body', 2], step: 0.006, min: 0.25, max: 0.34 },
  { path: ['bodyX'], step: 0.01, min: 0, max: 0.14 },
  { path: ['legAt', 0], step: 0.006, min: 0.18, max: 0.32 },
  { path: ['legAt', 1], step: 0.006, min: 0.12, max: 0.22 },
  { path: ['hindX'], step: 0.01, min: 0.22, max: 0.4 },
  { path: ['legWeight'], step: 0.1, min: 0.5, max: 3 },
  { path: ['headWeight'], step: 0.2, min: 0.5, max: 4 },
  { path: ['bodyShift'], step: 0.008, min: -0.06, max: 0.06 },
];

const START = {
  body: [0.5, 0.26, 0.29], bodyX: 0.07, legAt: [0.255, 0.17], hindX: 0.33,
  legWeight: 1.15, headWeight: 1.5, bodyShift: 0,
};

const get = (t, p) => (p.length === 1 ? t[p[0]] : t[p[0]][p[1]]);
const set = (t, p, v) => {
  const c = structuredClone(t);
  if (p.length === 1) c[p[0]] = v;
  else c[p[0]][p[1]] = v;
  return c;
};

async function measure(tune) {
  const reports = await Promise.all(
    SEEDS.map(async (seed) => {
      // No shell: the tuning JSON reaches calibrate.ts intact on every platform.
      const { stdout } = await run(process.execPath, ['--import', 'tsx', 'tools/calibrate.ts', String(PER), 'winter', 'winter', '--json', `--seed=${seed}`, `--tune=${JSON.stringify(tune)}`], { maxBuffer: 1 << 24 });
      return JSON.parse(stdout.slice(stdout.indexOf('{')));
    }),
  );
  const n = reports.reduce((s, r) => s + r.throws, 0);
  const avg = (key, group) => reports.reduce((s, r) => s + (r[group][key] ?? 0) * r.throws, 0) / n;
  const m = {};
  for (const k of Object.keys(POSE)) m[k] = avg(k, 'posePct');
  for (const k of Object.keys(ROLL)) m[k] = avg(k, 'resultPct');
  let loss = 0;
  for (const [k, t] of Object.entries({ ...POSE, ...ROLL })) loss += (WEIGHT[k] ?? 1) * ((m[k] - t) / (0.1 * t)) ** 2;
  return { m, loss };
}

const fmt = (m) => Object.entries(m).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
const log = (s) => {
  console.log(s);
  appendFileSync(LOG, s + '\n');
};

let best = existsSync(process.argv[3] ?? '') ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : START;
let bestScore = await measure(best);
log(`start loss ${bestScore.loss.toFixed(2)} | ${fmt(bestScore.m)} | ${JSON.stringify(best)}`);
writeFileSync(BEST, JSON.stringify({ tune: best, ...bestScore }, null, 2));

let shrink = 1;
for (let i = 1; i <= ITER; i++) {
  // Move one or two knobs a step up or down.
  let cand = best;
  const picks = Math.random() < 0.5 ? 1 : 2;
  for (let k = 0; k < picks; k++) {
    const knob = KNOBS[Math.floor(Math.random() * KNOBS.length)];
    const v = get(cand, knob.path) + (Math.random() < 0.5 ? -1 : 1) * knob.step * shrink;
    cand = set(cand, knob.path, Number(Math.min(knob.max, Math.max(knob.min, v)).toFixed(4)));
  }
  const score = await measure(cand);
  const kept = score.loss < bestScore.loss;
  log(`#${i} loss ${score.loss.toFixed(2)} ${kept ? 'KEPT' : 'no'} | ${fmt(score.m)} | ${JSON.stringify(cand)}`);
  if (kept) {
    best = cand;
    bestScore = score;
    writeFileSync(BEST, JSON.stringify({ tune: best, ...bestScore }, null, 2));
  } else if (i % 6 === 0) {
    shrink = Math.max(0.4, shrink * 0.8);
  }
}
log(`done: best loss ${bestScore.loss.toFixed(2)} | ${fmt(bestScore.m)} | ${JSON.stringify(best)}`);
