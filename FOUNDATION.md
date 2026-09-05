# ROBOT CUTTLEFISH 🐙🤖

Hide-and-seek in WebXR. You are not the hider — the hider is a little robot
that walks in front of you. You **paint** it (stripes, splotches, dots and
squares, placed by hand, exactly where you want them) until it matches the
world, you **pose** it from a wheel (lie down, crouch, flatten, cling), you
**carry** it where it needs to go, and you leave it there. Then somebody
looks for it.

It is MECHA CHAMELEON, rebuilt on Meta's [Immersive Web SDK](https://iwsdk.dev/)
(Three.js + ECS) with the technology of FIRE FIGHT 2: the paintable blank
body (`ff2/src/avatar/mannequin.ts`, `paint.ts`, `docs/paint.md`), the club's
point-at-the-floor teleport (`ff2/src/rave/systems/ClubTeleportSystem.ts`) and
the club's procedural-environment kit. New here: legs, a pose wheel, a
companion that stays in front of you, walls it can stick to — and, above
everything, the places.

## The three pillars, in order

1. **THE PLACES.** Varied, beautiful, detailed environments — the thing you
   hide *in*. Every environment is a real place with a mood, a palette, a
   floor you can point at, and a hundred nooks: under a bench, behind a
   flowerpot, flat against a mural, on top of a wardrobe. The paint only
   matters because the world is rich enough to match; the seeking is only
   fun because there is somewhere to look. Detail is the budget. Everything
   else is cheap on purpose so the places can be expensive.
2. **THE PAINT.** The blank body takes colour from placed units — stripe,
   splotch, dot, square — with FF2's whole discipline: colour is an index in
   a sold palette, a look is an ordered list of quantized placements, it
   bakes once into a canvas per part and costs nothing per frame. The
   palette here is the world's: each environment publishes the colours it
   is painted in, so a matching look is always buildable.
3. **HIDE AND SEEK.** One hides the robot; one (or the same player, later)
   looks. The score is time-to-find. That is the whole game loop; do not
   let it grow.

## How it plays

- **Full VR** (immersive-vr). The environments are opaque; there is no
  passthrough. Roomscale reference space: y = 0 is your real floor.
- **You are a pair of hands and a head.** No body, no avatar. The robot is
  the character.
- **Locomotion is the club's**: hold the thumbstick forward (or the primary
  button), a straight ray from the controller lands a marker on any
  walkable floor, release to step there with a quick fade. Snap turn on
  thumbstick x. Nothing smooth, nothing that makes anyone ill.
- **THE COMPANION** stands ~0.9 m in front of you, on the floor, facing you,
  and walks to keep station as you teleport — it arrives a beat
  after you do. Point at it and hold the wheel button: the **pose wheel**
  fans out around it (STAND · SIT · LIE · CROUCH · FLATTEN · CLING · PERISCOPE).
  Pick a pose, it does it, on the spot, where it stands.
- **Carry**: grip it and it rides your hand (its legs tuck). Release over
  a floor, it lands and stands; release against a wall or ceiling, it
  **sticks** — spread-eagle, face to the surface, the CLING pose on
  whatever normal you gave it.
- **Paint bay**: FF2's bay, verbatim in spirit — take a unit from the tray,
  sweep the ray over the little guy, twist and size with the stick, trigger to
  place, squeeze to lift, B to return. The bay is a mode on the companion
  itself: you paint it where it stands, in the light it will hide in.

## The character

THE LITTLE GUY: FIRE FIGHT 2's blank, with legs. The egg head and the one
body loft are ff2's mannequin verbatim — the same rings, the same
seam-safe cylindrical UVs the paint needs — and this one gains two arms
(shoulder, elbow, hand) and two legs (hip, knee, foot), each segment a
small loft and a paint surface, with dark steel joints that never paint.
Authored at human size and scaled to about 0.6 m, so it is a person you
can pick up. The cuttlefish in the name is the paint (cuttlefish match
their backdrop); the chameleon is the eyes, two turret domes on the head
that track you. Poses are procedural: a record of joint angles per pose,
tweened, no skeletons, no GLBs.

## The look

The robot is matte and plain (the blank), and the world is where the colour
is. Environments are handmade procedural three.js — canvas-painted textures,
lofted and merged geometry, one directional light with shadows plus an
environment map, fog for depth — so they cost what a Quest can pay and look
like places rather than asset packs.

## Toolchain

- `npm run dev` — Vite + the IWSDK dev plugin (IWER emulator: WASD + mouse on
  desktop, native WebXR on a headset).
- `npm run build` — typecheck + Vite build. Deploys to GitHub Pages from
  `main`, and the Firebase project `yellkell-tournaments` holds the player
  doc (name, look, times) behind anonymous auth.
- `npm run shots` — headless screenshots of every environment for review.
