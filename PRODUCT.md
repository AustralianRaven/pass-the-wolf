# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: TypeScript is required; the rest was left to Claude. Chosen: Vite + TypeScript, Three.js for rendering, Rapier (`@dimforge/rapier3d-compat`, WASM) for rigid-body physics, Vitest for unit tests, Playwright for end-to-end. Static build deployed to GitHub Pages by a GitHub Actions workflow on push to `main`.

## Users

Friends and family around one desktop or laptop, playing a quick party game in turns (hot-seat), optionally against computer players. Also a single player killing ten minutes against computer opponents.

## Product Purpose

Pass the Wolf is a browser push-your-luck dice game. Each turn a player throws two wolf-shaped dice, scores by how the wolves land, and decides to roll again or bank the turn's points. A bad landing wipes the turn's points. First player to the target score wins.

Success: a throw feels physical and fair, the landing pose is instantly readable, and the "one more roll?" decision creates tension and laughter.

## Positioning

The dice are not cubes. Two asymmetric wolf figures tumble under real rigid-body physics, so pose odds come from the shape itself, not a random-number table. The scoring table is calibrated from simulated throws of the actual wolf geometry.

The mechanic is inspired by classic animal-figure push-your-luck games. Names, poses, scoring, art, and identity are original to Pass the Wolf; do not borrow another game's pose names, artwork, or branding.

## Operating Context

- Desktop only: mouse and keyboard. No touch gestures, no device motion.
- Seats: 1 human vs 1 or more computer players, or 2 to 6 seats of any human/computer mix (hot-seat). Players set their own names.
- Session length: roughly 5 to 20 minutes to the default target of 100.
- Runs offline once loaded; no accounts, no server.

## Capabilities and Constraints

- Real-time 3D physics throw with the player able to aim and set power.
- Pose detection after both dice come to rest.
- Turn flow: roll, see result, roll again or bank.
- Computer players with distinct risk personalities.
- Swappable animals: the wolf ships first; sheep, pig and others follow. Each throw uses two dice, which may be different animals (for example one wolf and one sheep). Every animal has its own shape, its own calibrated odds, and its own original pose names; no animal reuses another game's pose names.
- Game modes (future): the classic two-dice race first; later a five-dice category mode ("Pack Hunt": throw, hold, re-throw, fill a category sheet) and more. Mode names and categories are original, not borrowed from other dice games.
- Score card: target score (default 100) plus a per-round history for every player, and an unmistakable "next player's turn" handover.
- Undecided: final pose names and point values (set after a calibration run on the real geometry); sound design; whether to add house-rule toggles.

## Brand Commitments

- Name: Pass the Wolf.
- Wolf naming convention: Kat's personal projects follow a "<Domain>Wolf" family; this one keeps its full game title.

## Evidence on Hand

None. No models, art, audio, or copy exist yet. The wolf dice geometry, textures, and all copy are to be authored.

## Product Principles

1. The throw is the product. Physics, sound, and camera must sell the tumble.
2. Odds are earned by shape. Scores follow from measured pose frequencies, never fudged randomness.
3. Readable at a glance. Everyone at the table knows the result and whose turn it is within a second.
4. Tension over bookkeeping. The game keeps score; players only decide "roll or bank".

## Accessibility & Inclusion

- Full keyboard play: throw, bank, and menus without a mouse.
- Pose results announced as text (screen reader live region), never by 3D view alone.
- Respect `prefers-reduced-motion` for camera moves and UI flourishes; the physics throw itself stays.
