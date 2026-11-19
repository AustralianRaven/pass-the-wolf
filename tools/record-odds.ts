/**
 * Writes src/animals/pig-odds.json from calibrate --json reports: the measured odds plus the
 * exact pig tuning, pose boundaries and Alpha rule they were measured with. The unit test
 * (tests/unit/odds.test.ts) checks the odds against the targets and refuses a stale record.
 *
 *   npx tsx tools/record-odds.ts calibration/run-*.report.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PIG_TUNE } from '../src/animals/pig-hitbox';
import { POSE_BOUNDARIES } from '../src/physics/classify';
import { CONTACT_RULE, THROW_SPACING } from '../src/physics/dice-world';

interface Report {
  throws: number;
  posePct: Record<string, number>;
  resultPct: Record<string, number>;
  avgPointsPerRoll: number;
}
const reports = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')) as Report);
const throws = reports.reduce((s, r) => s + r.throws, 0);
const avg = (group: 'posePct' | 'resultPct') => {
  const keys = new Set(reports.flatMap((r) => Object.keys(r[group])));
  return Object.fromEntries([...keys].map((k) => [k, Number((reports.reduce((s, r) => s + (r[group][k] ?? 0) * r.throws, 0) / throws).toFixed(3))]));
};
const record = {
  measured: new Date().toISOString().slice(0, 10),
  profile: 'auto-roll',
  throws,
  tune: PIG_TUNE,
  boundaries: POSE_BOUNDARIES,
  contactRule: CONTACT_RULE,
  throwSpacing: THROW_SPACING,
  posePct: avg('posePct'),
  resultPct: avg('resultPct'),
  avgPointsPerRoll: Number((reports.reduce((s, r) => s + r.avgPointsPerRoll * r.throws, 0) / throws).toFixed(2)),
};
writeFileSync('src/animals/pig-odds.json', `${JSON.stringify(record, null, 2)}\n`);
console.log(`Recorded ${throws} throws to src/animals/pig-odds.json`);
