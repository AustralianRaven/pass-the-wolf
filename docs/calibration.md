# Calibration

## Status (2026-11-19): on target

Every animal is **display-only** and rolls on one shared, invisible **pig hitbox**
(`src/animals/pig-hitbox.ts`, tuning in `PIG_TUNE`). A new animal is a visible model plus a `fit`
(scale and offset); it inherits the pig's odds with no physics work. The visible model is lifted or
dropped each frame so its lowest point matches the hitbox's. Settings → Debug mode → Show hitboxes
draws the pig in gold.

The odds are measured on the **Auto-roll** throw only (`autoRollInput` in `dice-world.ts`): the
Auto-roll button, Space and the computer players throw exactly this way. Hand throws are not held to the table.

Targets: `src/animals/wolf-targets.ts` (Kern 2006 single-pig odds plus the sitting Howl), ±10% of each.

### Tangled and Alpha are judged on the visible animal

The pig hitbox is wider than the wolf you see, so "hitboxes touching" counted near-misses as Tangled.
Each animal now carries a **silhouette** (convex pieces built from its sculpt parts, fit applied), and:

- **Tangled:** the visible animals touch (within `VISIBLE_GAP`, under half a millimetre).
- **Alpha (the piggyback):** they touch and one is off the felt entirely, riding the other. Close to
  impossible on a real throw (none in 260,000+), so it is an **instant win** with no rate target. The
  demo page and the score sheet stage one (`stageAlpha`), and a test proves the staged drop holds.

Under the stricter Tangled rule the Auto-roll pair is released closer together
(`THROW_SPACING` 0.9, was 1.1): 1.1 gave 0.96% Tangled, 0.8 gave 1.87%.

### Final record: 100,000 fresh throws (`src/animals/pig-odds.json`)

| Result | Measured | Target | Band |
|---|---|---|---|
| Plain side | 33.59% | 34.8% | in |
| Moon side | 32.18% | 30.0% | in |
| Play Dead | 21.75% | 22.4% | in |
| Prowl | 8.42% | 8.8% | in |
| Sniff | 3.08% | 3.0% | in |
| Pounce | 0.61% | 0.6% | in |
| Howl | 0.40% | 0.4% | in |
| Tangled (per roll) | 1.48% | 1.6% | in |
| Alpha (per roll) | 0 | possible | staged (instant win) |

Scattered 21.1% of rolls; 4.8 points per roll on average. The poses were also confirmed on 800,000
throws before the contact rules changed (the rules do not touch the poses).

`tests/unit/odds.test.ts` checks this record against the targets, and fails if the pig tuning, the pose
boundaries, the contact rules or the throw spacing changed since it was measured.

### Pose boundaries (`src/physics/classify.ts`), fitted on saved rests

- **Howl (sit):** snout within ~32° of straight up (`SIT_AXIS` 0.85). Shallower snout-up tilts are a
  wolf lying tipped back.
- **Pounce (lean):** snout down past `LEAN_NOSE` 0.61 and tipped onto a shoulder past `LEAN_TILT` 0.5.
- **Sniff:** snout down past `NOSE_AXIS` 0.6, square.
- **Tangled / Alpha:** see above (visible silhouettes; Alpha needs one animal off the felt).

### How the pig was tuned

1. Sweeps at 800 throws (`sh tools/odds.sh winter 800 '<tune json>'`) to find the levers:
   - body width trades the sides against Play Dead;
   - the hind legs and the body's fore-aft position control sitting (Howl);
   - the front legs control the snout tripod (Sniff);
   - thinner, lighter feet lower Prowl.
2. Full checks at 10,000 throws (`sh tools/calibrate-full.sh <name> '<tune json>'`, four seeded
   batches in parallel, the same seeds for every candidate so differences are the shape, not luck).
3. Boundaries fitted offline on saved rests: `npx tsx tools/fit-poses.ts calibration/*.json`.
4. A clean 20,000-throw record on fresh seeds: `npx tsx tools/record-odds.ts <reports>`.

`tools/tune-pig.mjs` is an automatic hill-climber over the same knobs, for future retuning.

### Re-run after any change to the pig, the throw profile or the classifier

```bash
sh tools/alpha-run.sh record 1 2 8000          # 100,000 throws on two cores, resumable
npx tsx tools/record-odds.ts calibration/record-*.report.json
echo {} > src/demo/demo-seeds.json && npx tsx tools/find-demo-seeds.ts   # every throw changed
npm test
```

---

## History (the retired direwolves and capsule wolf)


Point values come from how often each pose actually happens, measured by throwing the real
wolf geometry with real physics. Re-run after any change to the wolf's shape or the physics constants.

```bash
npm run calibrate -- 5000            # wolf + wolf
npm run calibrate -- 5000 wolf sheep # a mixed pair, once the sheep exists
```

## Wolf + wolf — 2026-11-13, 5,000 throws

| Generic pose | Wolf name | Frequency (per die) | Points |
|---|---|---|---|
| Side, mark up | Moon side | 37.2% | — |
| Side, mark down | Plain side | 37.6% | — |
| Back | Play Dead | 12.8% | 5 |
| Upright | Prowl | 9.3% | 5 |
| Nose-down | Sniff | 2.6% | 10 |
| Tail-down | Howl | 0.53% | 20 |

| Roll result | Frequency (per throw) |
|---|---|
| Score (one or two scoring poses) | 41.6% |
| Scattered (bust) | 28.1% |
| Den (1 point) | 27.7% |
| Double | 2.5% |
| Tangled (wipes the bank) | 0.06% |
| Alpha | not seen in 5,000 throws |

- Average simulated settle time: 1.06 s. No throws timed out.
- Average points per roll: 3.4. Roughly 1 roll in 3.5 busts, so banking at 15 to 25 is the sensible zone.
- Howl was raised from the provisional 15 to 20 because it came out rarer (0.5%) than planned.
- Alpha and Tangled are rare enough that their values are a design choice, not a measurement.

## Re-check after shrinking the tray — 2026-11-13, 2,000 throws

Arena reduced to 10.8 × 7 units and throws softened. Sides 74.5%, back 13.4%, upright 9.5%, nose-down 2.2%, Howl 0.55%. Results: score 40.8%, Den 28.4%, Scattered 27.6%, Double 3.0%, Tangled 0.25%. Point values unchanged.

## The direwolf pack — 2026-11-13, 1,500 throws each

The playable dice are five sculpted direwolves. They share one points table (Play Dead 5, Prowl 5, Sniff 10, Howl 20); their shapes give each its own odds, which is where the strategy lives.

| Wolf | Sides | Play Dead | Prowl | Sniff | Howl | Scattered (per throw) | Avg points per roll |
|---|---|---|---|---|---|---|---|
| Warden | 71.6% | 15.93% | 9.53% | 2.77% | 0.17% | 24.93% | 3.83 |
| Stalker | 69.7% | 17.73% | 12.33% | 0.1% | 0.13% | 24.2% | 3.77 |
| Frostmane | 80.8% | 0.93% | 9.87% | 5% | 3.43% | 30.8% | 3.99 |
| Timber Runner | 71.9% | 16.27% | 11.13% | 0.33% | 0.4% | 26.33% | 3.67 |
| Old Grizzle | 68.3% | 19.67% | 8.63% | 3.13% | 0.23% | 23.33% | 4.33 |

How the odds were tuned, without changing the points:

- **Width.** A realistic wolf is twice as tall as it is wide and lands on its side ~90% of the time. Each wolf's mesh and collider are stretched in Z by its own `width` (1.12 to 1.55) until sides sit near 70%.
- **Weight.** Lower legs are 7× denser than the body, and head, ears and tail are light (0.4×), like a figure die with a weighted base. Old Grizzle's skull is heavy (1.8×), so he tips nose-first more often.
- **Spine pad.** A flat hull just inside the fur along the back lets a wolf rest on its back.

Target: every wolf's average points per roll within about 10% of the pack. Re-run with
`npx tsx tools/calibrate.ts 1500 <id> <id> --json` and update `src/animals/direwolf-odds.json`;
`sh tools/odds.sh <id>` is a quick 150-throw probe. The picker's trait lines are computed from that JSON.

## Guard

`tests/unit/balance.test.ts` (original capsule wolf, kept as a fast fixture) and `tests/unit/direwolves.test.ts` (60 throws per direwolf, wide bands) replay seeded throws and fail if any pose drifts out of its band. When one fails, re-run
calibration and update `src/animals/direwolf-odds.json` (direwolves) or the points table in
`src/animals/wolf-scoring.ts` (capsule wolf).
