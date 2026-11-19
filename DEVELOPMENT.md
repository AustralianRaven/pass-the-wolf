# Developing Pass the Wolf

How to run, test and change the game. For what the game is, see the [README](README.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

The extra pages run from the same server: `/demo.html` and `/wins-screens.html`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build (`dist/`) |
| `npm run preview` | Serve the production build |
| `npm run check` | Typecheck, lint and unit tests |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Playwright end-to-end tests; see below |
| `npm run calibrate` | Headless throw simulation; prints pose frequencies |

## Tests

- **Unit tests** (`tests/unit/`) cover the rules, the scoring and the physics:
  - The odds gate (`odds.test.ts`) checks the committed odds record against the targets.
  - The demo seeds replay their throws.
  - The online session runs on an in-memory transport.
  - The floppy rig is checked against bad frames.
- **End-to-end tests** (`tests/e2e/`) drive the built game in Chromium. They include a two-browser game over the local network and every winner cutscene.
  - Run them locally before committing; CI does not run them.
  - Run them on one worker: `npx playwright test --workers=1`. Several software-rendered WebGL browsers at once can freeze the machine.

Test titles and assertion messages are written Gherkin style ("Scenario: Given…, Then…").

## Layout

| Path | What lives there |
|---|---|
| `src/rules/` | The game rules: scoring, turns, banking, winning. No browser code. |
| `src/physics/` | The Rapier dice world, pose classification, Tangled and Alpha checks, the Auto-roll throw. |
| `src/animals/` | The shared pig hitbox, the animal sculpts (`wolf-design.ts`, `menagerie.ts`), odds targets and the committed odds record. |
| `src/sculpt/` | Signed-distance sculpting, surface nets and the painters that carve each animal. |
| `src/render/` | Three.js: the tray scene, animal meshes, the floppy rig (`wobble.ts`), portraits and the winner cutscenes (`winner-scene.ts`). |
| `src/game/` | The controller that ties rules, physics, scene and UI together; settings and debug flags. |
| `src/net/` | Online play: the transport seam, Trystero (online) and plain WebRTC (local network), the host-sequenced session and throw recordings. |
| `src/ui/` | The DOM: setup, picker, HUD, score sheet, cutscene overlays, lobby, and the linocut stylesheet. |
| `tools/` | Calibration, seed finders and asset builders (below). |
| `docs/calibration.md` | How the odds were measured and tuned, with the current record. |
| `DESIGN.md` | The Midwinter Linocut visual system. |

## Adding an animal

Every animal is display-only and rolls on one shared, invisible pig hitbox (`src/animals/pig-hitbox.ts`), so a new animal never changes the odds.

1. Add a design to `src/animals/menagerie.ts`. It needs sculpt parts in the shared body frame (nose +X, back +Y, marked flank +Z, feet at y = 0), group colours, eyes, a neck for the collar and pose names.
2. Name the floppy parts with the rig's groups: `tail0…`, `earL` / `earR`, `leg{i}u` / `leg{i}l`.
3. Add it to `MENAGERIE`. The picker, score sheet, silhouette (for Tangled and Alpha) and tests pick it up.
4. Check the fit with Settings → Debug mode → Show hitboxes.

## The odds

The pose odds are measured on the Auto-roll throw and committed as `src/animals/pig-odds.json`. The unit tests refuse that record if the pig, the pose boundaries, the contact rules or the throw spacing have changed since it was measured. To re-measure, see [docs/calibration.md](docs/calibration.md):

```bash
sh tools/alpha-run.sh record 1 2 8000                        # 100,000 throws on two cores, resumable
npx tsx tools/record-odds.ts calibration/record-*.report.json
echo {} > src/demo/demo-seeds.json && npx tsx tools/find-demo-seeds.ts
npm test
```

Any physics change moves every throw, so the demo seeds must be found again too. `npx tsx tools/replay-demo.ts` checks them.

## Debugging

- Settings → Debug mode → Show hitboxes draws the real physics shapes.
- URL flags: `?seed=123` makes throws repeatable, `?fast=1` settles throws instantly, `?force=tailDown/tailDown,tangled,alpha` fixes the next landings in order, and `?winner=1` plays the winner cutscene even in fast mode.

## Brand and README art

- `node tools/build-brand.mjs` rebuilds `brand/logo-mark.svg` from `public/favicon.svg`. It also rebuilds the README banner, with its fonts embedded, and `brand/social-preview.png`. Upload that PNG under Settings → General → Social preview.
- `node tools/render-readme-art.mjs [base-url]` renders the README pictures (`brand/readme-*.png`) from a running build:

  ```bash
  npm run build && npx vite preview --port 4173   # in one terminal
  node tools/render-readme-art.mjs                # in another
  ```

## Deploying

Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`), served from `/pass-the-wolf/`.
