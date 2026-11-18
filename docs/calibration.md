# Calibration

## Status (2026-11-18): shared pig hitbox, 5 of 7 poses on target

Every animal is **display-only** and rolls on one shared, invisible **pig hitbox**
(`src/animals/pig-hitbox.ts`, tuning in `PIG_TUNE`). A new animal is just a visible model plus a
`fit` (scale and offset); it inherits the pig's odds with no physics work. The visible model is
lifted or dropped each frame so its lowest point matches the hitbox's. Settings → Debug mode → Show
hitboxes draws the pig in gold.

Targets live in `src/animals/wolf-targets.ts` (Kern 2006 single-pig odds plus the sitting Howl),
tolerance ±10% of each target, auto-roll only.

Latest run: 10,000 throws (4 seeds × 2,500), `PIG_TUNE` as committed:

| Pose | Measured | Target | Band |
|---|---|---|---|
| Plain side | 31.37% | 34.8% | in |
| Moon side | 31.36% | 30.0% | in |
| Play Dead | 23.23% | 22.4% | in |
| Prowl | 9.39% | 8.8% | in |
| Sniff | 3.54% | 3.0% | **out** (max 3.3) |
| Pounce | 0.63% | 0.6% | in |
| Howl | 0.49% | 0.4% | **out** (max 0.44) |
| Tangled (per roll) | 2.51% | 1.6% | **out** |
| Alpha (per roll) | 0 in 10,000 | 0.05% | **out** |

Next steps:

- **Sniff:** front legs further forward (`legAt[0]` 0.26 gave 2.69%, 0.25 gave 3.44%).
- **Howl:** hind legs a touch further back (`hindX`), or the body a touch further forward (`bodyX`).
- **Alpha and Tangled together:** two round pigs almost never stack fully. Proposal: count a die left
  propped on the other, its centre clearly above the other's, as Alpha. Tune that height so Alpha
  reaches 0.05% and Tangled falls toward 1.6%.
- **Side asymmetry:** sides measure 31.4 / 31.4; the target is 34.8 / 30.0. Try `bodyShift`.
- Confirm with 20,000 throws, then run Alpha overnight (~800,000).

Workflow:

- `sh tools/odds.sh winter 800 '{"legAt":[0.26,0.17]}'` tries a pig tuning without editing code.
  Up to four at once is fine (one core each, below-normal priority).
- `npx tsx tools/calibrate.ts 2500 winter --seed=N --dump=calibration/x-N.json` in parallel for big runs.
- `npx tsx tools/fit-poses.ts calibration/*.json --leanNose=0.55` re-classifies saved rests instantly,
  for setting the Sniff / Pounce / Howl boundaries in `src/physics/classify.ts`.

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
