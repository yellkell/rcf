/**
 * THE POSES — what the wheel offers, as data.
 *
 * A pose is a flat record of joint values (radians and metres); the
 * companion tweens between them with an exponential chase (the head/torso
 * half of ff2's poseMotion) and applies the result to the robot's groups
 * every frame. No skeleton, no clips: seven records and one function.
 *
 * Legs are insect-jointed. For each: SPLAY swings the leg out to the side
 * in the body's cross-section (0 = straight down, π/2 = straight out),
 * SWING yaws it fore/aft, KNEE folds the lower segment back in the splay
 * plane. The four are ordered front-left, front-right, rear-left,
 * rear-right; a pose gives a pair (front, rear) and the sides mirror.
 */

export interface LegPose {
  splay: number;
  swing: number;
  knee: number;
}

export interface Pose {
  /** Height of the mantle's pivot above the floor (m). */
  bodyY: number;
  /** Mantle pitch: positive tips the prow UP. */
  pitch: number;
  roll: number;
  /** The head's tilt (positive looks up) and how far it tucks back under
   *  the prow (0 = out, 1 = fully tucked). */
  headPitch: number;
  headTuck: number;
  front: LegPose;
  rear: LegPose;
  /** Skirt fins: 0 = flared as built, 1 = folded flat against the flank. */
  skirt: number;
  /** Tail plate pitch. */
  tail: number;
}

export type PoseId = 'stand' | 'sit' | 'lie' | 'crouch' | 'flatten' | 'cling' | 'periscope';

export const POSE_IDS: readonly PoseId[] = ['stand', 'sit', 'lie', 'crouch', 'flatten', 'cling', 'periscope'];

export const POSE_LABEL: Record<PoseId, string> = {
  stand: 'STAND',
  sit: 'SIT',
  lie: 'LIE DOWN',
  crouch: 'CROUCH',
  flatten: 'FLATTEN',
  cling: 'CLING',
  periscope: 'PERISCOPE',
};

const d = (deg: number): number => (deg * Math.PI) / 180;

export const POSES: Record<PoseId, Pose> = {
  // On its feet, alert, a little splay so the stance reads as planted.
  stand: {
    bodyY: 0.215,
    pitch: 0,
    roll: 0,
    headPitch: 0,
    headTuck: 0,
    front: { splay: d(22), swing: d(12), knee: d(30) },
    rear: { splay: d(22), swing: d(-10), knee: d(30) },
    skirt: 0,
    tail: 0,
  },
  // Haunches down, front legs straight — a dog's sit.
  sit: {
    bodyY: 0.15,
    pitch: d(22),
    roll: 0,
    headPitch: d(-8),
    headTuck: 0,
    front: { splay: d(14), swing: d(18), knee: d(8) },
    rear: { splay: d(60), swing: d(-30), knee: d(120) },
    skirt: 0.2,
    tail: d(-20),
  },
  // Belly on the floor, legs out flat to the sides.
  lie: {
    bodyY: 0.088,
    pitch: 0,
    roll: 0,
    headPitch: d(-6),
    headTuck: 0.2,
    front: { splay: d(82), swing: d(20), knee: d(60) },
    rear: { splay: d(82), swing: d(-20), knee: d(60) },
    skirt: 0.3,
    tail: d(-8),
  },
  // Knees deep, low, ready — the pounce.
  crouch: {
    bodyY: 0.13,
    pitch: d(-6),
    roll: 0,
    headPitch: d(6),
    headTuck: 0,
    front: { splay: d(48), swing: d(22), knee: d(105) },
    rear: { splay: d(48), swing: d(-22), knee: d(105) },
    skirt: 0,
    tail: d(6),
  },
  // The pancake: everything flat, head tucked, fins folded.
  flatten: {
    bodyY: 0.086,
    pitch: 0,
    roll: 0,
    headPitch: d(-14),
    headTuck: 0.85,
    front: { splay: d(88), swing: d(35), knee: d(12) },
    rear: { splay: d(88), swing: d(-35), knee: d(12) },
    skirt: 0.95,
    tail: d(-14),
  },
  // Gripping a surface: legs wide and bent, body pulled in close. The
  // companion system rolls the whole robot onto the surface normal.
  cling: {
    bodyY: 0.105,
    pitch: 0,
    roll: 0,
    headPitch: d(4),
    headTuck: 0.3,
    front: { splay: d(66), swing: d(40), knee: d(118) },
    rear: { splay: d(66), swing: d(-40), knee: d(118) },
    skirt: 0.6,
    tail: 0,
  },
  // Up on straight legs, prow raised, looking over the parapet.
  periscope: {
    bodyY: 0.25,
    pitch: d(32),
    roll: 0,
    headPitch: d(18),
    headTuck: 0,
    front: { splay: d(10), swing: d(8), knee: d(4) },
    rear: { splay: d(12), swing: d(-6), knee: d(6) },
    skirt: 0,
    tail: d(12),
  },
};

export function clonePose(p: Pose): Pose {
  return { ...p, front: { ...p.front }, rear: { ...p.rear } };
}

/** Chase `to` from `cur` in place; `k` is the per-frame blend (0..1). */
export function chasePose(cur: Pose, to: Pose, k: number): void {
  const mix = (a: number, b: number): number => a + (b - a) * k;
  cur.bodyY = mix(cur.bodyY, to.bodyY);
  cur.pitch = mix(cur.pitch, to.pitch);
  cur.roll = mix(cur.roll, to.roll);
  cur.headPitch = mix(cur.headPitch, to.headPitch);
  cur.headTuck = mix(cur.headTuck, to.headTuck);
  cur.skirt = mix(cur.skirt, to.skirt);
  cur.tail = mix(cur.tail, to.tail);
  for (const key of ['front', 'rear'] as const) {
    cur[key].splay = mix(cur[key].splay, to[key].splay);
    cur[key].swing = mix(cur[key].swing, to[key].swing);
    cur[key].knee = mix(cur[key].knee, to[key].knee);
  }
}
