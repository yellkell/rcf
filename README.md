# ROBOT CUTTLEFISH 🐙🤖

WebXR hide-and-seek with a little paintable robot — FIRE FIGHT 2's blank
body, given arms and legs. You are a head and two hands; the little guy
walks in front of you. Paint it to match the world, pose
it from a wheel, carry it, stick it to a wall, leave it somewhere clever.
Built on Meta's [Immersive Web SDK](https://iwsdk.dev/) (Three.js + ECS)
from the technology of FIRE FIGHT 2 — the blank body and its paint, the
club's point-at-the-floor step, the procedural environment kit.

Read [FOUNDATION.md](FOUNDATION.md) for the pillars (the places first,
the paint second, the seeking third) and how it is meant to feel.

## Controls (Quest controllers)

| Input | Does |
| --- | --- |
| Thumbstick **forward** (either hand) | Aim the step: an arc lands a ring on any floor; roll the stick to set your facing; release to go |
| Thumbstick **sideways** | Snap turn |
| Thumbstick **back** | Shuffle half a metre back |
| **A** (right) / **X** (left), held | The pose wheel above the robot — point at a wedge, let go: FOLLOW · STAND · SIT · LIE · CROUCH · FLATTEN · CLING · PERISCOPE |
| **Grip** with the controller on the robot | Pick it up; release over a floor to set it down, against a wall or ceiling to stick it there |
| **B** (right) / **Y** (left) | Open THE TRAY beside the robot (kinds + colours, this place's own tones first); tap a swatch to take a unit into your hand. With a unit held: drop it. The tray's NEXT PLACE button walks the places |
| **Trigger** on the robot, unit held | Place the unit (the ghost under the ray is where it lands) |
| **Trigger** on placed paint, empty hand | Lift it back into your hand |
| Thumbstick while a unit hovers the robot | x twists, y sizes, grip + y sets a stripe's width |

## Run it

```
npm install
npm run dev        # Vite + the IWSDK emulator (WASD + mouse on desktop)
npm run build      # typecheck + production build → dist/
npm run shots      # headless screenshots of every place → tools/shots/
npm run smoke      # boots the real page headless and drives every verb
```

Deploys to GitHub Pages from `main` (`.github/workflows/deploy.yml`). The
Firebase project `yellkell-tournaments` (src/net/firebase.ts) holds the
player doc behind anonymous auth; nothing loads it until something asks.

## Layout

```
src/
  main.ts                    boot: World.create, the four systems, the __rcf dev window
  config.ts                  every knob: TELEPORT, COMPANION, PAINT (the palette)
  systems/
    EnvironmentSystem.ts     builds a place, sky/fog/shadow bake, plants the player
    TeleportSystem.ts        the step (ff2's ClubTeleportSystem over raycast floors)
    CompanionSystem.ts       station-keeping, the gait, the wheel, carry, stick, eyes
    PaintSystem.ts           the bay: tray panel + ray→uv place/lift/ghost on the robot
  companion/
    body.ts                  ff2's blank (egg head + one body loft) with arms and legs, eye turrets
    poses.ts                 the seven poses as joint records
    rig.ts                   pose → groups, the walk
    paint.ts                 Look model, 8-byte wire, THE HAND, the canvas bake
  env/
    place.ts                 the Place contract every environment meets
    garden.ts                THE WALLED GARDEN — brick walls, beds, a greenhouse, a pond
    workshop.ts              THE WORKSHOP — a lock-up garage: bench, racking, drums, a car under a sheet
    cove.ts                  THE COVE — a rocky beach: heightfield sand, tide pools, a groyne, a boat
    kit/                     merge, rng+noise, skins, canvas painters, sky, plants, scatter, terrain
  ui/panel.ts                canvas panels with buttons you point at
  input/rays.ts              controller rays + the pointer visual
env-preview.html             dev harness: ?place=&pose=&x=&z=&yaw= (tools/env-shots.mjs)
```
