# Pass the Wolf — Build Plan

Status: awaiting Kat's go-ahead. Product truth lives in `PRODUCT.md`.

## Decisions locked

| Topic | Decision |
|---|---|
| Platform | Desktop browser only (mouse + keyboard) |
| Stack | Vite + TypeScript (strict), Three.js, Rapier (`@dimforge/rapier3d-compat`), Vitest, Playwright, npm |
| Hosting | GitHub Pages via GitHub Actions on push to `main` |
| Visual world | **Cabin Game Night**: buffalo-check wool throw blanket, knotty pine table, pine pegboard race track with brass pegs, enamelware details |
| Players | Solo (1 human vs 1–5 CPU) or table mode (2–6 seats, any human/CPU mix); editable names |
| Animals | Wolf first; architecture supports swapping animals and mixed pairs (e.g. wolf + sheep). Sheep and pig come later with original pose names |
| Score | First to 100 (configurable); score card with per-round history; unmistakable turn handover |
| Tangled | Wolves touching at rest = lose the whole banked score |
| Git | One commit per phase, straight to `main`. **Local only — no push** unless Kat says otherwise (a push to `main` triggers the Pages deploy) |

## Rules (wolf, provisional values)

Generic poses are shared by every animal; each animal names them its own way.

| Generic pose | Wolf name | Points (single) | Double (×4) |
|---|---|---|---|
| Side, mark up / Side, mark down | Den (both same side) | 1 for the pair | — |
| Sides opposite | Scattered | Turn pot lost, turn ends | — |
| Back | Play Dead | 5 | 20 |
| Upright | Prowl | 5 | 20 |
| Nose-down | Sniff | 10 | 40 |
| Tail-down (snout up) | Howl | 15 | 60 |
| Touching at rest | Tangled | Lose whole banked score | — |
| One on top of the other | Alpha | +50 (provisional) | — |

- One die on its side + one scoring pose = that pose's points.
- Two different scoring poses = sum. Same generic pose on both = Double.
- Final point values are set by the calibration run (rarer = more points).

## Architecture

```
src/rules/      Pure TS. Generic poses, AnimalDefinition scoring tables, turn state machine. No Three/Rapier imports.
src/animals/    AnimalDefinition per animal: mesh + collider parts (one source), mass, pose names, flank mark. wolf.ts first.
src/physics/    Rapier world, arena walls, throw impulse, rest detection, pose classifier, Tangled/Alpha contact checks.
src/game/       Game session: seats, rounds, phases ready → aiming → tumbling → settled → banked | busted → handover → game over.
src/ai/         CPU risk personalities (Cautious / Steady / Reckless) with endgame logic. (Next session.)
src/render/     Three.js scene, camera, lighting, wool/pine materials.
src/ui/         DOM HUD: setup screen, Roll/Bank, score card, pegboard, handover banner, aria-live result text.
src/audio/      WebAudio thuds, clacks, howl. (Next session.)
tools/calibrate.ts   Headless Rapier, ~100k throws per animal pair → pose frequency table.
```

Key principles:
- Physics is deterministic per seed. A `?seed=` URL flag forces repeatable throws for tests and debugging.
- Rules engine never touches 3D. Physics hands it a pair of generic poses plus contact flags.
- Mesh and collider for each animal come from the same part list, so they can never drift apart.

## This hour: the playable slice (Phases 1–5)

Each phase ends with green checks and one commit to `main`.

### Phase 1 — Scaffold
1. Vite + TS strict project, ESLint, Prettier defaults.
2. Vitest and Playwright configured, with one smoke test each.
3. GitHub Actions workflow: lint, test, build, deploy to Pages (runs on push to `main`).
4. `.gitignore`, README with run instructions.
- Commit: `chore: scaffold Vite + TypeScript game shell`

### Phase 2 — Rules engine (test-first)
1. Generic pose enum and `AnimalDefinition` scoring types.
2. Wolf scoring table; pair scoring incl. Den, Scattered, Doubles, mixed, Tangled, Alpha.
3. Turn and game state machine: roll, bank, bust, handover, win at target.
4. Per-round score history model for the score card.
5. Parameterised Vitest cases for every pose combination.
- Commit: `feat: rules engine with generic poses and wolf scoring`

### Phase 3 — Physics wolf
1. Procedural wolf: carved-wood low-poly mesh and a compound convex-hull collider from one part list.
2. Rapier arena: table, walls, wool-like friction and restitution.
3. Throw: drag-to-sling with mouse; Space charge + arrow aim on keyboard; seeded jitter.
4. Rest detection and pose classifier (local up-vector + contacts), with a debug overlay toggle.
5. Tests: classifier unit tests on fixed orientations; deterministic seeded throw test.
- Commit: `feat: physics wolf dice with throw and pose detection`

### Phase 4 — Calibration
1. `npm run calibrate` runs headless throws and prints pose frequencies per animal pair.
2. Tune wolf geometry/mass until Howl is the rarest single pose and Prowl/Play Dead are common.
3. Set wolf point values from measured rarity; record the frequency table in `docs/calibration.md`.
4. Vitest balance test: frequencies stay within tolerance bands.
- Commit: `feat: calibration tool and balanced wolf scoring`

### Phase 5 — Playable game
1. Setup screen: mode (solo / table), 1–6 seats, editable names, human/CPU toggle per seat, target score. Settings remembered in localStorage.
2. Cabin Game Night scene: wool blanket arena, pine table, warm lighting (first pass, not final polish).
3. HUD: turn pot, Roll and Bank buttons, last result in words.
4. Score card: rounds × players table, bust marks, running totals, target line; opens any time, auto-shows between rounds.
5. Pegboard race strip along the bottom, one peg lane per seat, active seat in colour.
6. Handover banner with the next player's name in their seat colour; waits for click/Space for humans.
7. CPU seats use a simple placeholder rule (bank at 20) until Phase 6.
8. Playwright specs (Gherkin titles, per-step checks): set names, play seeded turns, bank, bust, handover, win.
- Commit: `feat: playable hot-seat game with score card and handover`

If time runs short, I stop at a clean phase boundary and note where I got to. I won't leave a half-finished phase committed.

## Next sessions (not this hour)

6. CPU personalities (Cautious / Steady / Reckless) with endgame logic.
7. Full Cabin Game Night visual build (direction contract, finish review, `DESIGN.md`), plus audio.
8. Accessibility and reduced-motion pass.
8b. **Big-moment replay cutscene.** Triggers on a Double Prowl, Double Sniff, Double Howl, or Alpha (and Tangled, for the groan). Records the throw as a tape of per-step transforms, then replays it in slow motion. Letterbox bars, a short run of camera cuts (low table-edge cam, overhead cam, a cam that chases one wolf), then a slow push-in on the final pose with the call burned into a pine plaque over the freeze frame. A captioned announcer line plays, and the camera returns to the table. Click, Space or Escape skips. Under reduced motion the replay is a single still shot with the plaque. Built in the Cabin Game Night vocabulary, not copied from the reference page.
9. Sheep, then pig, as separate commits with their own calibration.
10. **Game modes.** A mode picker on the setup sheet. The current game becomes the "Classic" mode.
11. **Pack Hunt mode** (five-dice category game, our own name and categories): throw five wolves, re-throw any of them up to twice, then score the landing into one empty category on a per-player sheet (e.g. Full Pack, Five Howls, Den Run). Needs: N-dice physics (DiceWorld is two dice today), click-to-hold dice between throws, a category scoring engine, and a calibration run with five dice so category values match real odds.
12. More modes later, each a separate rules module on the shared physics and animals.

## Risks

- **Physics feel** (floaty vs real) needs tuning; Phase 3 timeboxes it.
- **Pose odds** depend on geometry; calibration may need several geometry tweaks.
- **WebGL in Playwright** — headless Chromium uses software GL; e2e relies on `?seed=` and DOM state, not pixels.
