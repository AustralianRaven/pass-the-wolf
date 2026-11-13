# Calibration

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
