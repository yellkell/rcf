/**
 * THE POSES — what the wheel offers, as data.
 *
 * A pose is a flat record of joint values (radians, and metres at FF2's
 * human size — the root is scaled down afterwards); the companion tweens
 * between them with an exponential chase and applies the result to the
 * figure's groups every frame. No skeleton, no clips: seven records and
 * one function.
 *
 * Limbs hang off the pelvis. A LEG: `swing` about x (positive = forward),
 * `splay` about z (positive = out to the side, mirrored), `knee` folds
 * the shin back. An ARM: `swing` about x (positive = forward), `raise`
 * about z (positive = out and up, mirrored), `elbow` folds the forearm
 * forward. `pitch` tips the whole figure about the hips (positive = face
 * down), which is how it lies, flattens and clings.
 */

import { STAND_HIP_Y } from './body.js';

export interface LegPose {
  swing: number;
  splay: number;
  knee: number;
}

export interface ArmPose {
  swing: number;
  raise: number;
  elbow: number;
}

export interface Pose {
  /** Height of the pelvis above the soles' floor (human units). */
  bodyY: number;
  /** Whole-figure pitch about the hips: positive = face down. */
  pitch: number;
  /** Lean of the torso only (positive = forward). */
  lean: number;
  headPitch: number;
  leg: LegPose;
  arm: ArmPose;
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
  // On its feet, easy: a little knee, arms hanging a touch out.
  stand: {
    bodyY: STAND_HIP_Y - 0.01,
    pitch: 0,
    lean: 0,
    headPitch: 0,
    leg: { swing: d(2), splay: d(4), knee: d(4) },
    arm: { swing: d(4), raise: d(10), elbow: d(12) },
  },
  // On the floor, legs out in front, hands in its lap.
  sit: {
    bodyY: 0.2,
    pitch: d(-4),
    lean: d(8),
    headPitch: d(-6),
    leg: { swing: d(84), splay: d(10), knee: d(12) },
    arm: { swing: d(40), raise: d(6), elbow: d(70) },
  },
  // Flat on its back, hands at its sides, looking up.
  lie: {
    bodyY: 0.12,
    pitch: d(-90),
    lean: 0,
    headPitch: d(-10),
    leg: { swing: d(2), splay: d(8), knee: d(4) },
    arm: { swing: d(-4), raise: d(20), elbow: d(6) },
  },
  // Balled up small: knees to chest, arms wrapped, head down.
  crouch: {
    bodyY: 0.34,
    pitch: 0,
    lean: d(28),
    headPitch: d(20),
    leg: { swing: d(112), splay: d(8), knee: d(128) },
    arm: { swing: d(58), raise: d(2), elbow: d(112) },
  },
  // Face down and spread out: the pancake.
  flatten: {
    bodyY: 0.12,
    pitch: d(90),
    lean: 0,
    headPitch: d(-16),
    leg: { swing: d(-2), splay: d(30), knee: d(2) },
    arm: { swing: d(-8), raise: d(150), elbow: d(10) },
  },
  // Spread-eagle against a surface, face to it, gripping wide. The
  // companion system rolls the whole figure onto the surface's normal.
  cling: {
    bodyY: 0.13,
    pitch: d(90),
    lean: 0,
    headPitch: d(-30),
    leg: { swing: d(24), splay: d(38), knee: d(30) },
    arm: { swing: d(-6), raise: d(135), elbow: d(20) },
  },
  // Up on tiptoe, arms straight up, chin up: the lookout.
  periscope: {
    bodyY: STAND_HIP_Y + 0.05,
    pitch: 0,
    lean: d(-6),
    headPitch: d(-22),
    leg: { swing: 0, splay: d(2), knee: 0 },
    arm: { swing: d(8), raise: d(170), elbow: d(4) },
  },
};

/** FOUND: a seeker's shot landed. A crumple, face down, limbs loose — not
 *  on the wheel; the game puts it here and takes it away. */
export const KO_POSE: Pose = {
  bodyY: 0.12,
  pitch: d(84),
  lean: d(10),
  headPitch: d(-20),
  leg: { swing: d(18), splay: d(14), knee: d(40) },
  arm: { swing: d(30), raise: d(50), elbow: d(60) },
};

export function clonePose(p: Pose): Pose {
  return { ...p, leg: { ...p.leg }, arm: { ...p.arm } };
}

/** Chase `to` from `cur` in place; `k` is the per-frame blend (0..1). */
export function chasePose(cur: Pose, to: Pose, k: number): void {
  const mix = (a: number, b: number): number => a + (b - a) * k;
  cur.bodyY = mix(cur.bodyY, to.bodyY);
  cur.pitch = mix(cur.pitch, to.pitch);
  cur.lean = mix(cur.lean, to.lean);
  cur.headPitch = mix(cur.headPitch, to.headPitch);
  cur.leg.swing = mix(cur.leg.swing, to.leg.swing);
  cur.leg.splay = mix(cur.leg.splay, to.leg.splay);
  cur.leg.knee = mix(cur.leg.knee, to.leg.knee);
  cur.arm.swing = mix(cur.arm.swing, to.arm.swing);
  cur.arm.raise = mix(cur.arm.raise, to.arm.raise);
  cur.arm.elbow = mix(cur.arm.elbow, to.arm.elbow);
}
