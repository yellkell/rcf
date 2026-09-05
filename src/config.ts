/**
 * ROBOT CUTTLEFISH — the tunables, in one place.
 *
 * The three pillars in order (FOUNDATION.md): the places, the paint, the
 * seeking. Numbers here are the knobs each system reads; nothing here is
 * clever, and anything that IS clever lives next to the code that needs it.
 */

/** The house palette (UI, markers, the wheel). Teal is the signal colour. */
export const PALETTE = {
  signal: 0x2ee2c2,
  warm: 0xffb02e,
  danger: 0xff3b2e,
  ink: 0x0b1116,
  paper: 0xe7f4f1,
} as const;

/** Fixed foveation for the XR layer — the same middle setting FF2 ships. */
export const FOVEATION = 0.5;

/**
 * THE STEP — point-at-the-floor teleport, carried over from FIRE FIGHT 2's
 * club (ff2/src/rave/systems/ClubTeleportSystem.ts) whole: push a stick
 * forward to aim, let it spring back to go, flick sideways to snap-turn,
 * flick back to shuffle back. Nothing smooth, nothing that makes anyone
 * ill.
 */
export const TELEPORT = {
  engage: 0.5, // thumbstick magnitude that starts aiming
  release: 0.35, // …and below this on the way back, you go
  launchSpeed: 7.5, // m/s along the controller ray
  gravity: 9.8,
  arcPoints: 48,
  arcStep: 0.035, // seconds of simulated flight per arc sample
  snapAngle: (35 * Math.PI) / 180,
  snapEngage: 0.7,
  snapReset: 0.3,
  /** BACK on the stick is a short shuffle away from what you're facing,
   *  probed at decreasing lengths so a wall behind you stops you short. */
  stepBack: [0.5, 0.34, 0.2],
  /** The landing marker's radius (m). */
  markerRadius: 0.32,
  /** The blink: the world goes to black for this long around a step. */
  fadeSeconds: 0.14,
} as const;

/**
 * THE COMPANION — the little robot that walks in front of you.
 */
export const COMPANION = {
  /** Its build scale: the figure is authored at the FF2 blank's human
   *  size (hips at 0.95 m), and this brings it down to half a person —
   *  about 0.85 m — a little guy you could pick up. */
  scale: 0.5,
  /** Where it keeps station: this far ahead of your head, on the floor. */
  stationDistance: 1.1,
  /** It stays put until you're this far from its station (m) — a slow head
   *  turn does not make it shuffle. */
  stationSlack: 0.55,
  /** Walking speed (m/s) while it catches up, and its turn rate (rad/s). */
  walkSpeed: 1.35,
  turnRate: 5.0,
  /** Seconds to tween between poses. */
  poseSeconds: 0.45,
  /** How far a controller ray may be from its body to count as "pointing
   *  at it" (m, measured at the closest approach to its centre). */
  pointRadius: 0.22,
  /** Grip within this distance of its body (m) picks it up. */
  grabRadius: 0.38,
  /** Released this close to a wall or ceiling and it sticks (m). */
  stickReach: 0.35,
} as const;

/**
 * THE GUN — the seeker's tag. Five shots a round: a hit finds a robot, a
 * miss is loud and gone. Camouflage is only worth painting if a seeker
 * cannot shoot every bush, so the magazine IS the rule.
 */
export const GUN = {
  shots: 5,
  /** Seconds between shots. */
  cooldown: 0.35,
  /** How far a shot reaches (m). */
  range: 40,
  /** Seconds the tracer and the flash stay up. */
  tracerSeconds: 0.14,
} as const;

/**
 * THE PAINT (ff2/docs/paint.md) — the blank takes colour from placed
 * stripes, splotches, dots and squares. Same discipline as FIRE FIGHT 2:
 * colour is an index into a sold palette, every field is quantized to a
 * byte, the look bakes ONCE into a canvas per part.
 */
export const PAINT = {
  /** Placed units per look — the cap IS the wire/moderation bound. */
  maxUnits: 64,
  /** Paint canvas size per part (px, square). The legs share one sheet. */
  canvas: { head: 256, body: 512, legs: 256, arms: 256 } as Record<string, number>,
  /** The biggest a unit can be sized (fraction of its part's canvas). */
  maxSize: 0.55,
  /** The most metal a PAINTED surface stays — a mirror has no diffuse. */
  metalness: 0.45,
  /**
   * The sold colours. The first 24 are FIRE FIGHT 2's racks, kept in the
   * same order so an FF2 look packs and unpacks here unchanged (the wire is
   * shared). Everything after is the world's: the tones the environments
   * are painted in, so a matching look is always buildable. APPEND ONLY.
   */
  colours: [
    // the base rack
    0xf4f2ee, 0x17171a, 0x8c1d18, 0xb35b1e, 0xc2a24b, 0x4f5d33, 0x24354f, 0x4a3524,
    // the neon rack
    0xffb02e, 0xff5a1f, 0xff2ad5, 0x4fb7ff, 0xb06bff, 0x8fff3d, 0x2be2c2, 0xff4f8e,
    0x9fdcff, 0xffe94a, 0x6fffb0, 0xe8352a,
    // the top shelf
    0xd8b24a, 0xe9e2f2, 0x050507, 0xc9d2dd,
    // THE WORLD'S RACK — the environments' own tones (env/*.ts publish which)
    0x7a8c5a, 0x3f5a3a, 0x9c8f6e, 0x6b5a48, 0xb8b0a0, 0x515a63, 0x2f3a44, 0xd6c7a8,
    0x8d6b4b, 0xc95d3c, 0x4a7f8c, 0xe0d8c8, 0x33422e, 0xa0522d, 0x708090, 0xf0e6d2,
  ],
  /** Colour NAMES, index-parallel to `colours`. */
  colourNames: [
    'BONE WHITE', 'JET BLACK', 'OXBLOOD', 'RUST', 'BRASS', 'OLIVE DRAB', 'NAVY', 'UMBER',
    'AMBER', 'EMBER', 'HOT MAGENTA', 'CYAN', 'VIOLET', 'LIME', 'TEAL', 'PINK',
    'ICE BLUE', 'VOLT YELLOW', 'MINT', 'SIGNAL RED',
    'GOLD LEAF', 'PEARL', 'VOID BLACK', 'CHROME',
    'MOSS', 'FERN', 'SANDSTONE', 'BARK', 'LIMESTONE', 'SLATE', 'WET SLATE', 'PLASTER',
    'TERRACOTTA', 'CLAY', 'VERDIGRIS', 'CHALK', 'HEDGE', 'BRICK', 'PEWTER', 'LINEN',
  ],
};
