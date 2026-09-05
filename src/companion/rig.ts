/**
 * THE RIG — applies a Pose to the figure, and walks it.
 *
 * Every frame the companion system hands this the current (tweened) pose
 * and how far the figure walked; it sets every group's position and
 * rotation from those numbers. Walking swings the legs alternately with
 * the arms counter-swinging, the swing leg lifting at the knee, and the
 * body bobbing a touch on each footfall.
 */

import type { Robot } from './body.js';
import type { Pose } from './poses.js';

/** One stride's length in WORLD metres — the gait clock runs on distance,
 *  not time, so feet never slide: stopped means still. */
export const GAIT_STRIDE = 0.2;
const LEG_SWING = 0.55;
const KNEE_LIFT = 0.9;
const ARM_SWING = 0.4;
const BOB = 0.012;

export function applyPose(robot: Robot, pose: Pose, gaitPhase: number, moving: number): void {
  const bob = moving * BOB * Math.abs(Math.sin(gaitPhase * Math.PI * 2));
  robot.body.position.y = pose.bodyY + bob;
  robot.body.rotation.set(pose.pitch + pose.lean * 0.35, 0, 0);
  robot.head.rotation.x = pose.headPitch;

  for (const leg of robot.legs) {
    // Left and right legs half a stride apart.
    const ph = (leg.side > 0 ? gaitPhase : gaitPhase + 0.5) % 1;
    const swing = moving * LEG_SWING * Math.sin(ph * Math.PI * 2);
    const lift = moving * KNEE_LIFT * Math.max(0, Math.sin(ph * Math.PI * 2 + Math.PI / 2));
    leg.hip.rotation.order = 'ZXY';
    // The torso's lean is the hips' doing: the legs stay planted.
    leg.hip.rotation.x = -(pose.leg.swing + swing) - pose.lean * 0.35;
    leg.hip.rotation.z = leg.side * pose.leg.splay;
    leg.knee.rotation.x = pose.leg.knee + lift;
    leg.foot.rotation.x = -(pose.leg.knee + lift - pose.leg.swing - swing) * 0.6;
  }

  for (const arm of robot.arms) {
    // Arms counter to the leg on the same side.
    const ph = (arm.side > 0 ? gaitPhase + 0.5 : gaitPhase) % 1;
    const swing = moving * ARM_SWING * Math.sin(ph * Math.PI * 2);
    arm.shoulder.rotation.order = 'ZXY';
    arm.shoulder.rotation.x = -(pose.arm.swing + swing);
    arm.shoulder.rotation.z = arm.side * pose.arm.raise;
    arm.elbow.rotation.x = -(pose.arm.elbow + moving * 0.25);
  }
}
