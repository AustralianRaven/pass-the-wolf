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

## Guard

`tests/unit/balance.test.ts` replays 300 seeded throws and fails if any pose drifts out of
its band. When it fails, re-run calibration and revisit the points table in
`src/animals/wolf-scoring.ts`.
