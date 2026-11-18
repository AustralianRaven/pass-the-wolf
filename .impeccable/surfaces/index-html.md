---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["demo.html"]
---

# Surface: the game table (index.html)

Mode: Experience. Desktop first. Players are inside the game; the live hex tray leads from the first viewport, including behind the home screen.

Audience and job: friends at one desktop (or one player vs CPU) at night, taking turns to throw two winter wolves, then choosing roll or bank. Success: the throw feels physical; result and whose turn it is read in under a second.

Related surfaces: demo.html (pick-a-result demo) and the score sheet share this world.

## Direction contract

THESIS: The whole game is one hand-carved linocut of a winter night, pulled in pale ink on night-violet paper: tray, trail, cave and panels are cut from the same block. It refuses the casual-game default of glossy gradient panels and floating rounded HUD cards.

OWN-WORLD: Night-violet paper (#1e1533, #2f2152) owns every field; pale lilac-white ink (#e9e4f7) carries type and carved rules; one mid-violet second block (#7a5cc4) for registration fills; frost blue (#a9c4e8) for snow and moonlight only. Saturated colour is reserved for player collar colours. Panels are carved blocks with gouged edges; rules are cut lines. Display type is a heavy carved face; UI text a plain workhorse sans.

STORY: Players set names and pick collar colours over the idling tray, pick their wolf from a left-to-right carousel (Winter Wolf, then locked Coming soon cards), then throw by hand, by button, or auto-roll. The latest call is printed under the tray. The trail strip shows each player's wolf walking home to the cave; banked points stack as carved courses. Big rolls (15+) cut to a zoomed replay with the call carved over the freeze frame.

FIRST VIEWPORT: Full-bleed 3D hex tray under a carved moon. Home: a carved setup block centred over the tray (title, seats with colour swatches, Start). In play: top-left active seat block (name, banked, turn pot in fixed digit blocks); centre-bottom a single result line; under it Roll, Auto-roll and Bank as carved tabs; full-width trail strip at the foot, one lane per seat, ending at a cave.

FORM: Midwinter Linocut, position 6 of 7 on the grounded list. seed:8b73b1bd29a7ad07

SIGNATURE INTERACTION: Grab the wolves in the tray, carry, and fling; release throws. A 15+ roll cuts to a slow zoom on the landed wolves with the call carved over it.

Raises: state in carved line form (doubled rule = active seat, broken gouge = pending), from emission-line rail; scores in fixed carved digit blocks that swap, never fade, from nixie counter; one pinned result line re-inked each throw, from signal degradation; banked points as stacked courses on the trail, from coiled tower.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions
- Sound design.
- Winter wolf mesh: sculpted SDF vs carved parts (rework issue #1).
