/**
 * THE RIG — applies a Pose to a Robot, and walks it.
 *
 * Every frame the companion system hands this the current (tweened) pose
 * and how far the robot has walked this frame; it sets every group's
 * position and rotation from those numbers. Walking is a trot: diagonal
 * pairs (front-left with rear-right) swing together, the swing leg lifts
 * at the knee, and the mantle bobs a millimetre or two on the beat.
 */

import type { Robot } from './body.js';
import type { Pose } from './poses.js';

/** One stride's length (m) — the gait clock runs on distance, not time,
 *  so feet never slide: stopped means still. */
const STRIDE = 0.16;
const SWING_AMP = 0.42;
const LIFT_AMP = 0.75;
const BOB = 0.006;

/** Skirt fin rotation as built (rig.ts flares it up by this much). */
const SKIRT_FLARE = 0.35;

export function applyPose(robot: Robot, pose: Pose, gaitPhase: number, moving: number): void {
  const bob = moving * BOB * Math.sin(gaitPhase * Math.PI * 4);
  robot.body.position.y = pose.bodyY + bob;
  robot.body.rotation.set(pose.pitch, 0, pose.roll);

  // The head: tilts, and tucks back under the prow.
  robot.head.rotation.x = pose.headPitch;
  robot.head.position.z = -0.19 + pose.headTuck * 0.075;
  robot.head.position.y = -0.02 - pose.headTuck * 0.01;

  for (const leg of robot.legs) {
    const base = leg.end > 0 ? pose.front : pose.rear;
    // The gait: diagonal pairs share a phase; the other pair is half a
    // stride behind. swing = fore/aft; lift folds the knee mid-swing.
    const pairPhase = (leg.side * leg.end > 0 ? gaitPhase : gaitPhase + 0.5) % 1;
    const swing = moving * SWING_AMP * Math.sin(pairPhase * Math.PI * 2);
    const lift = moving * LIFT_AMP * Math.max(0, Math.sin(pairPhase * Math.PI * 2 + Math.PI / 2));
    // Splay is about z, mirrored per side; the knee folds back in the same
    // plane. Swing is about x. Rotation order 'ZXY' so the splay frames the
    // swing (an insect leg reaches out, then forward).
    leg.hip.rotation.order = 'ZXY';
    leg.hip.rotation.z = leg.side * base.splay;
    leg.hip.rotation.x = base.swing + swing;
    leg.knee.rotation.z = -leg.side * (base.knee + lift);
  }

  for (let i = 0; i < robot.skirts.length; i++) {
    const side = i === 0 ? -1 : 1;
    // Folded flat = rolled up against the flank.
    robot.skirts[i].rotation.z = side * (pose.skirt * (SKIRT_FLARE + 0.9));
  }
  robot.tail.rotation.x = pose.tail;
}

export const GAIT_STRIDE = STRIDE;
