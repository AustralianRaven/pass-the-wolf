---
name: Pass the Wolf
description: A push-your-luck wolf dice game cut as one midwinter linocut, pale ink pulled on night-violet paper.
colors:
  night: "#120c22"
  paper: "#1e1533"
  paper-2: "#2f2152"
  block: "#7a5cc4"
  block-deep: "#4e3a86"
  ink: "#e9e4f7"
  ink-dim: "#bdb2db"
  ink-faint: "#8d80b3"
  frost: "#a9c4e8"
  collar-lilac: "#a58bd6"
  collar-ember: "#e07a3a"
  collar-glacier: "#5b9bd5"
  collar-pine: "#6fae6a"
  collar-gold: "#e3b341"
  collar-snow: "#efe7da"
typography:
  wordmark:
    fontFamily: "'Grenze Gotisch Variable', Georgia, serif"
    fontSize: "5.6rem"
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: "0.01em"
  display:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "clamp(3rem, 7vw, 5.6rem)"
    fontWeight: 900
    lineHeight: 0.95
  headline:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "2.4rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 900
    lineHeight: 1
  button:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "1.35rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "'Figtree Variable', system-ui, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "'Figtree Variable', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Figtree Variable', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  none: "0"
  disc: "50%"
spacing:
  cut: "3px"
  xs: "0.4rem"
  sm: "0.6rem"
  md: "0.8rem"
  lg: "1.25rem"
  xl: "1.6rem"
components:
  tab-roll:
    backgroundColor: "{colors.block}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0.7rem 1.8rem 0.75rem"
  tab:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0.7rem 1.4rem 0.75rem"
  tab-hover:
    backgroundColor: "{colors.block-deep}"
  tab-disabled:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-faint}"
  tab-quiet:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.45rem 0.9rem 0.5rem"
  field:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.45rem 0.6rem"
  mode-choice:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.7rem 0.9rem"
  mode-choice-selected:
    backgroundColor: "{colors.block-deep}"
  block:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  digit:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.none}"
    width: "1.45rem"
    height: "2.2rem"
  digit-pot:
    backgroundColor: "{colors.block-deep}"
  tile:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.7rem 0.8rem 0.75rem"
  tile-alpha:
    backgroundColor: "{colors.block-deep}"
  tile-bust:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-dim}"
---

# Design System: Pass the Wolf

## Overview

**Creative North Star: "Midwinter Linocut"**

The whole game is one hand-carved linocut of a winter night, pulled in pale ink on night-violet paper. The tray, the trail, the cave and every panel are cut from the same block: fields carry faint horizontal gouge strokes, edges are hand-cut frames with slightly uneven corners, and every rule is a cut line rather than a drawn hairline. Nothing is glossy, nothing is rounded, nothing floats on a gradient.

Density is low and the 3D tray owns the screen. UI sits at the edges as carved blocks (the active seat top-left, two quiet tabs top-right, one result line and its actions centre-bottom, a full-width trail frieze at the foot) so the throw is never covered. State is told in line form, not hue: a doubled rule, a dashed rule, a solid cut. Saturated colour exists only to tell players apart.

The world refuses the casual-game default of glossy gradient panels and floating rounded HUD cards.

**Key Characteristics:**
- Two-colour print: pale lilac-white ink on night-violet paper, with one mid-violet second block for registration fills.
- Every panel is a carved block: gouge texture over paper, a hand-cut frame, square corners.
- State in cut line form: solid, doubled, dashed.
- Heavy carved display face for every call; a plain workhorse sans for everything read or counted.
- Player collar colours are the only saturated hue on screen.

## Colors

A restrained two-block print in violet and lilac-white, with six saturated collar colours held in reserve for the players.

### Primary
- **Second Block Violet** (block): the registration fill of the one call-to-action tab per view (Roll, Reroll, Deal the wolves, Choose), and the selection colour. Its rarity is what makes the next action findable.
- **Deep Block Violet** (block-deep): the inked-in state. Selected mode choice, tab hover, turn-pot digit blocks, the winning total, the Alpha tile, and the hills of the trail frieze.

### Neutral
- **Night** (night): the page and the 3D scene background; the cut-away field behind digits, text fields and the cave mouth.
- **Night-Violet Paper** (paper): the ground of every carved block, the trail strip and the handover band.
- **Second Pull Paper** (paper-2): inset fields inside a block (seat rows, mode choices, tiles, wolf cards) and the default tab.
- **Pale Ink** (ink): all primary text, carved rules, frame edges, snow lines and the moon disc.
- **Dim Ink** (ink-dim): secondary text, captions, round and stat labels, bust state rules.
- **Faint Ink** (ink-faint): disabled text, unfocused field underlines, pines and paw prints in the frieze, locked wolf outlines.
- **Frost** (frost): moonlight only. The moon's stars and the glow behind it. Never on UI.

### Tertiary: Collar Colours
- **Lilac** (collar-lilac), **Ember** (collar-ember), **Glacier** (collar-glacier), **Pine** (collar-pine), **Gold** (collar-gold), **Snow** (collar-snow): one per seat, picked in setup. They appear only as the seat's mark: the swatch, the top rule of a seat row and wolf card, the wolf button underline, the collar on the wolfmark and trail wolf, the active-seat doubled rule on the plate, the score sheet column key, and the handover band.

### Named Rules
**The Collar Reserve Rule.** Saturated colour belongs to the players. If a hue is not one of the six collar colours, it is violet paper or lilac ink. Results, warnings and celebrations never borrow a collar colour.

**The Seat Is A Variable Rule.** Collar colour is never hard-coded on a component; it arrives as the seat's colour at runtime and is applied to a rule, a stroke or a swatch, never to a text fill or a panel field.

## Typography

**Display Font:** Grenze 900 (with Georgia, serif)
**Wordmark Font:** Grenze Gotisch Variable 900 (with Georgia, serif)
**Body Font:** Figtree Variable (with system-ui, sans-serif)

**Character:** A heavy, cut-edged serif carved for calls and names, against a plain geometric sans that does the reading and counting. The blackletter Gotisch cut is the title only.

### Hierarchy
- **Wordmark** (Gotisch 900, 5.6rem, 0.85): "Wolf" in the setup block; the "Pass the" lead sits beside it at 2.4rem in dim ink. Drops to 3.4rem / 1.4rem under 640px.
- **Display** (Grenze 900, clamp 3rem to 5.6rem, 0.95): the next player's name on the handover band.
- **Headline** (Grenze 900, 2.4rem to 2.6rem, 1): the active seat's name on the plate and the pinned result call.
- **Title** (Grenze 900, 1.5rem to 2rem, 1): dialog heads, section heads, mode labels, wolf card names, tile names.
- **Button** (Grenze 900, 1.35rem, 0.02em): carved tabs. The primary roll tab steps up to 1.6rem; quiet tabs drop to Figtree 800 at 0.95rem.
- **Numeral** (Figtree 800, 1.7rem, tabular): scores in digit blocks, trail scores, sheet totals.
- **Body** (Figtree 400, 16px, 1.45): ledes and blurbs, capped near 50ch.
- **Label** (Figtree 600, 0.8rem to 0.92rem): stat labels, captions, hints, seat controls. Sentence case.

### Named Rules
**The Two Cuts Rule.** Grenze is for what is called out (names, calls, headings, tabs); Figtree is for what is read or counted. Numbers are always Figtree with tabular figures, except points written inside a call or tile.

**The One Title Rule.** Grenze Gotisch sets the wordmark and nothing else.

## Layout

Full-bleed fixed stage: the 3D tray fills the viewport and the UI is absolutely placed around it, inset 1.25rem from the edges. The active-seat plate pins top-left, the score sheet and new game tabs top-right, the console (one result line over its action tabs) centres at the bottom just above the trail, and the trail strip spans the full width at the foot, one lane per seat ending at the cave. Setup is a single centred block up to 44rem wide over the idling tray; dialogs cap at 56rem to 58rem.

Spacing runs on small steps: 3px between digit blocks, 0.4rem to 0.8rem inside and between controls, 1.25rem edge inset, 1.4rem to 1.6rem between sections of a block. The single breakpoint at 640px stacks mode choices, re-flows seat rows into a column and makes the start tab full width.

## Elevation & Depth

Depth is printed, not lit. Blocks sit on the night with long, soft, violet-black shadows, the way a pulled print lifts off a dark table; inside a block, depth is tonal (paper, then second-pull paper, then night for cut-away fields). Tabs carry a shorter shadow that collapses when pressed. The 3D tray continues the material: a carved rim and a gouge-textured felt under a cool moonlit key light and a violet fill.

### Shadow Vocabulary
- **Block lift** (`box-shadow: 0 18px 40px -12px rgb(6 3 16 / 0.7)`): every carved block panel.
- **Tab lift** (`box-shadow: 0 8px 18px -8px rgb(6 3 16 / 0.8)`): carved tabs at rest; pressed: `0 3px 8px -4px rgb(6 3 16 / 0.8)`.
- **Trail lift** (`box-shadow: 0 -16px 30px -18px rgb(6 3 16 / 0.9)`): the trail strip, cast upward.
- **Band lift** (`box-shadow: 0 24px 50px -16px rgb(6 3 16 / 0.9)`): the handover band.
- **Cut inset** (`box-shadow: inset 0 0 0 1.5px rgb(233 228 247 / 0.25)`): the edge of a digit block or the wolf art disc.

### Named Rules
**The Ink Shadow Rule.** Shadows are soft and violet-black, never coloured and never hard-edged offsets. Disabled tabs drop their shadow entirely.

## Shapes

Square corners everywhere; a carved block has no radius. Edges come from the hand-cut frame (a 60-unit SVG border image with corners nudged off true, stroked in pale ink) rather than from CSS borders. Rules are cut lines: solid 3px for the default, a 7px double rule for an elevated state, dashed for a broken or unavailable one. The only curve is the wolf portrait disc in the den.

### Named Rules
**The Line Not Hue Rule.** State is drawn in line form. Solid rule = present or selected; doubled rule = active seat, big roll, Alpha, winner; dashed rule = bust, remove, disabled, locked, focus. A state that needs explaining gets a different line, not a different colour.

## Components

### Buttons (carved tabs)
Tactile, cut and pressed, like a block meeting paper.
- **Shape:** square, framed by the hand-cut frame at 10px border width (8px for quiet tabs).
- **Primary (roll):** second block violet field with gouge texture, Grenze 900 at 1.6rem, one per view.
- **Default:** second-pull paper field, Grenze 900 at 1.35rem.
- **Quiet:** Figtree 800 at 0.95rem for utility actions (Score sheet, New game, Close, Add a computer wolf).
- **Hover / Active:** lifts 2px and inks to deep block violet; pressing sinks 1px and the shadow shortens. 160ms on the shared ease-out.
- **Disabled:** faint ink text, the frame redrawn dashed in faint ink, no shadow.

### Chips (mode choice)
- **Style:** second-pull paper field, Grenze label over a Figtree detail line, transparent 3px top and bottom rules.
- **State:** selected inks the field deep violet and cuts both rules in pale ink; focus is the dashed outline.

### Cards / Containers (carved block)
- **Corner Style:** square, hand-cut frame at 14px.
- **Background:** gouge texture over night-violet paper.
- **Shadow Strategy:** block lift (see Elevation & Depth).
- **Internal Padding:** about 1rem to 2rem; inner fields use second-pull paper.

### Inputs / Fields
- **Style:** night field, no box, a 2px faint-ink underline; bold Figtree text.
- **Focus:** underline brightens to pale ink plus the dashed focus outline.
- **Seat controls:** small night buttons with a 2px dim-ink underline; Remove's underline is dashed.

### Navigation
None beyond the two quiet tabs top-right and dialog Close tabs.

### Digit Blocks
Fixed digit places, each numeral its own small cut block on night (deep violet for the turn pot). Blank places stay as empty blocks. On change the digits swap with a 260ms print (drop 5px from a brightened pull), never a fade.

### Result Line
One pinned line under the tray, re-inked each throw: Grenze call at 2.6rem with points in dim ink at 1.5rem, between 3px solid rules on translucent night. Big roll doubles the rules (7px double) on deep violet; bust dashes them in dim ink. Enters with a 420ms ink-in (blur and slight scale settling).

### Score Tiles
Second-pull paper tiles with a 3px pale ink top rule. Alpha doubles the rule and inks the field deep violet; bust tiles dash the rule in dim ink and drop to paper.

### Trail Frieze (signature)
A full-width SVG strip: faint-ink pines, a snow line in pale ink, paw prints, deep violet hills with snowcaps, and the cave cut open to night. Each seat's wolf walks its lane (500ms ease-out) with a collar stroke in the seat colour and a dashed ghost of its banked position; banked points stack as carved courses.

### Handover Band
A full-width paper band with 10px rules in the next seat's collar colour, swept in left to right with a 520ms clip, carrying the next name in display type.

## Do's and Don'ts

### Do:
- **Do** cut every panel as a carved block: gouge texture over paper, the hand-cut frame, square corners.
- **Do** tell state with line form: solid, doubled (7px double) or dashed rules.
- **Do** keep one second-block violet tab per view for the next action.
- **Do** set scores in Figtree 800 with tabular figures, in fixed digit places that swap rather than fade.
- **Do** carry a seat's identity with its collar colour on a rule, stroke or swatch only.
- **Do** use the dashed 2px pale ink outline, offset 4px, for keyboard focus.

### Don't:
- **Don't** use glossy gradient panels or floating rounded HUD cards.
- **Don't** put saturated colour on anything that is not a player's collar; results, busts and wins stay in violet and ink.
- **Don't** round corners; the wolf portrait disc is the only curve.
- **Don't** use frost blue outside the moon and its light.
- **Don't** set anything but the wordmark in Grenze Gotisch.
- **Don't** fade scores in or out.
