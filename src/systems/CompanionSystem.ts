/**
 * CompanionSystem — the little robot that walks in front of you.
 *
 * STATION. While it is FOLLOWING, its station is a point on the floor
 * ~0.95 m ahead of your head. It stays put until you are far enough from
 * that station (a head turn never makes it shuffle), then walks there at a
 * trot — arriving a beat after you do — and turns to face you.
 *
 * THE WHEEL. Hold A (right) or X (left) and the pose wheel opens above the
 * robot, facing you: FOLLOW · STAND · SIT · LIE · CROUCH · FLATTEN · CLING ·
 * PERISCOPE. Point at a wedge, let go, it does the thing — on the spot,
 * where it stands. Any pose but FOLLOW leaves it there.
 *
 * CARRY. Squeeze the grip with the controller on the robot and it rides
 * your hand (legs tucked). Let go over a floor and it lands on its feet;
 * let go against a wall or a ceiling and it STICKS — the robot rolls onto
 * the surface's normal and takes the CLING pose.
 *
 * It has no face. It turns to face you all the same.
 */

import { createSystem, InputComponent } from '@iwsdk/core';
import { CanvasTexture, CircleGeometry, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3, type Intersection } from 'three';
import * as sfx from '../audio/sfx.js';
import { buildRobot, type Robot } from '../companion/body.js';
import { applyLook, myLook, paintState } from '../companion/paint.js';
import { POSES, POSE_IDS, POSE_LABEL, chasePose, clonePose, type Pose, type PoseId } from '../companion/poses.js';
import { GAIT_STRIDE, applyPose } from '../companion/rig.js';
import { COMPANION } from '../config.js';
import { currentPlace, onPlaceChange, type Place } from '../env/place.js';
import { HANDS, aimRay, type Hand } from '../input/rays.js';
import { Panel, INK, PAPER, SIGNAL, label } from '../ui/panel.js';
import { floorUnder } from './TeleportSystem.js';

export type CompanionState = 'free' | 'held' | 'stuck';

type Wedge = PoseId | 'follow';
const WEDGES: readonly Wedge[] = ['follow', ...POSE_IDS];
const WEDGE_LABEL: Record<Wedge, string> = { follow: 'FOLLOW ME', ...POSE_LABEL };

const _head = new Vector3();
const _fwd = new Vector3();
const _q = new Quaternion();
const _p = new Vector3();
const _to = new Vector3();
const _n = new Vector3();
const _m = new Matrix4();
const _x = new Vector3();
const _z = new Vector3();
const _ray = new Raycaster();
const UP = new Vector3(0, 1, 0);

let blobTex: CanvasTexture | null = null;
function blobTexture(): CanvasTexture {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTex = new CanvasTexture(c);
  return blobTex;
}

/** What other systems (the paint bay, the dev hook) may read. */
export const companion: {
  robot: Robot | null;
  state: CompanionState;
  following: boolean;
  poseId: PoseId;
  setPose: (id: PoseId) => void;
  follow: () => void;
  /** The wheel's current wedge label, for the HUD probes. */
  wheelOpen: boolean;
} = {
  robot: null,
  state: 'free',
  following: true,
  poseId: 'stand',
  setPose: () => undefined,
  follow: () => undefined,
  wheelOpen: false,
};

export class CompanionSystem extends createSystem({}) {
  private robot!: Robot;
  private pose: Pose = clonePose(POSES.stand);
  private target: Pose = POSES.stand;
  private gait = 0;
  private moving = 0;
  private lookVersion = -1;
  private station = new Vector3(0, 0, -1);
  private hasStation = false;
  private wheel!: Panel;
  private wheelHand: Hand | null = null;
  private wheelHover: Wedge | null = null;
  private heldBy: Hand | null = null;
  private stuckUp = new Vector3(0, 1, 0);
  private blob!: Mesh;

  init(): void {
    this.robot = buildRobot();
    this.robot.root.scale.setScalar(COMPANION.scale);
    this.scene.add(this.robot.root);
    // The shadow map is baked once and never follows the robot, so it
    // carries its own: a soft dark disc at its feet, a child of the root
    // so it lies on whatever surface the robot is on.
    this.blob = new Mesh(new CircleGeometry(0.42, 24), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.006;
    this.blob.renderOrder = 1;
    this.robot.root.add(this.blob);
    companion.robot = this.robot;
    companion.setPose = (id) => this.setPose(id);
    companion.follow = () => this.follow();

    this.wheel = new Panel('wheel', 0.56, 0.56, 512, 512, (g, W, H, hover) => this.drawWheel(g, W, H, hover));
    this.scene.add(this.wheel.group);

    // A new place: the robot appears at your feet, following.
    const arrive = (place: Place | null): void => {
      if (!place) return;
      this.scene.attach(this.robot.root);
      companion.state = 'free';
      this.heldBy = null;
      this.follow();
      this.hasStation = false;
      const ahead = COMPANION.stationDistance;
      this.robot.root.position.set(place.spawn.x - Math.sin(place.spawn.yaw) * ahead, place.spawn.y ?? 0, place.spawn.z - Math.cos(place.spawn.yaw) * ahead);
      this.robot.root.quaternion.identity();
      this.robot.root.rotation.y = place.spawn.yaw + Math.PI;
    };
    onPlaceChange(arrive);
    arrive(currentPlace()); // the place may already be open (it loads first)
  }

  update(delta: number): void {
    const robot = this.robot;
    if (paintState.version !== this.lookVersion) {
      this.lookVersion = paintState.version;
      applyLook(robot.root, myLook());
    }

    this.player.head.getWorldPosition(_head);
    this.player.head.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);

    this.updateGrab();
    this.updateWheel(delta);

    let walked = 0;
    if (companion.state === 'free') walked = this.updateStation(delta);

    // Tween the pose and drive the rig.
    const k = 1 - Math.exp(-delta / (COMPANION.poseSeconds * 0.35));
    chasePose(this.pose, this.target, k);
    const wantMoving = walked > 0 ? 1 : 0;
    this.moving += (wantMoving - this.moving) * Math.min(1, delta * 9);
    this.gait = (this.gait + walked / GAIT_STRIDE) % 1;
    applyPose(robot, this.pose, this.gait, this.moving);
    // The blob spreads as the body comes down, and fades when carried.
    // Lying figures cover more floor than standing ones.
    const spread = 1.8 - this.pose.bodyY * 1.1;
    this.blob.scale.set(Math.max(0.7, spread * 0.8), Math.max(0.7, spread), 1);
    (this.blob.material as MeshBasicMaterial).opacity = companion.state === 'held' ? 0 : 0.55;
  }

  /* ── following ──────────────────────────────────────────────────────── */

  private updateStation(delta: number): number {
    const robot = this.robot;
    if (!companion.following) {
      this.faceHead(delta);
      return 0;
    }
    // Where it should be: ahead of you, on the floor.
    const fx = _fwd.x;
    const fz = _fwd.z;
    const flat = Math.hypot(fx, fz) || 1;
    _to.set(_head.x + (fx / flat) * COMPANION.stationDistance, 0, _head.z + (fz / flat) * COMPANION.stationDistance);
    const hit = floorUnder(_to.x, _to.z, _head.y);
    if (hit) {
      _to.y = hit.point.y;
      const far = !this.hasStation || _to.distanceTo(this.station) > COMPANION.stationSlack;
      if (far) {
        this.station.copy(_to);
        this.hasStation = true;
      }
    }
    if (!this.hasStation) return 0;
    _p.copy(robot.root.position);
    const dx = this.station.x - _p.x;
    const dz = this.station.z - _p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) {
      this.faceHead(delta);
      return 0;
    }
    const step = Math.min(dist, COMPANION.walkSpeed * delta);
    robot.root.position.x += (dx / dist) * step;
    robot.root.position.z += (dz / dist) * step;
    // Feet on the floor beneath, whatever it is.
    const under = floorUnder(robot.root.position.x, robot.root.position.z, robot.root.position.y + 0.5);
    if (under) robot.root.position.y += (under.point.y - robot.root.position.y) * Math.min(1, delta * 12);
    // Face the way it walks.
    const want = Math.atan2(-dx, -dz);
    this.turnTo(want, delta);
    // A footfall every half stride.
    const before = this.gait;
    const after = (before + step / GAIT_STRIDE) % 1;
    if (Math.floor(before * 2) !== Math.floor(after * 2)) sfx.footstep();
    return step;
  }

  private faceHead(delta: number): void {
    const r = this.robot.root.position;
    const want = Math.atan2(-(_head.x - r.x), -(_head.z - r.z));
    this.turnTo(want, delta);
  }

  private turnTo(yaw: number, delta: number): void {
    const cur = this.robot.root.rotation.y;
    let d = yaw - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.robot.root.rotation.y = cur + d * Math.min(1, delta * COMPANION.turnRate);
  }

  /* ── poses ──────────────────────────────────────────────────────────── */

  private setPose(id: PoseId): void {
    companion.poseId = id;
    companion.following = false;
    this.target = POSES[id];
    sfx.servo();
  }

  private follow(): void {
    companion.following = true;
    companion.poseId = 'stand';
    this.target = POSES.stand;
    if (companion.state === 'stuck') this.unstick();
  }

  /* ── the wheel ──────────────────────────────────────────────────────── */

  private updateWheel(delta: number): void {
    const robot = this.robot;
    if (!this.wheelHand) {
      for (const hand of HANDS) {
        const gp = this.input.xr.gamepads[hand];
        const btn = hand === 'right' ? InputComponent.A_Button : InputComponent.X_Button;
        if (gp?.getButtonDown(btn)) {
          this.wheelHand = hand;
          this.wheelHover = null;
          this.wheel.visible = true;
          companion.wheelOpen = true;
          sfx.uiClick();
          break;
        }
      }
      if (!this.wheelHand) {
        this.wheel.visible = false;
        companion.wheelOpen = false;
        return;
      }
    }
    // Park the wheel above the robot, facing you.
    robot.body.getWorldPosition(_p);
    this.wheel.group.position.set(_p.x, _p.y + 0.62, _p.z);
    this.wheel.group.lookAt(_head.x, _p.y + 0.62, _head.z);
    // Hover: ray against the wheel plane, wedge by angle.
    const hand = this.wheelHand;
    aimRay(this.player, hand, _ray);
    const hit = _ray.intersectObject(this.wheel.mesh, false)[0] as Intersection | undefined;
    let hover: Wedge | null = null;
    if (hit?.uv) {
      const dx = hit.uv.x - 0.5;
      const dy = hit.uv.y - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      if (r > 0.28 && r < 1.02) {
        const a = Math.atan2(dx, dy); // 0 = up, clockwise
        const n = WEDGES.length;
        hover = WEDGES[(Math.round((a / (Math.PI * 2)) * n) + n) % n];
      }
    }
    if (hover !== this.wheelHover) {
      this.wheelHover = hover;
      if (hover) sfx.uiClick();
    }
    this.wheel.hovered = hover;
    this.wheel.redraw(`${companion.poseId}|${companion.following}`);
    void delta;
    // Release picks.
    const gp = this.input.xr.gamepads[hand];
    const btn = hand === 'right' ? InputComponent.A_Button : InputComponent.X_Button;
    if (!(gp?.getButtonPressed(btn) ?? false)) {
      if (hover === 'follow') this.follow();
      else if (hover) this.setPose(hover);
      this.wheelHand = null;
      this.wheel.visible = false;
      companion.wheelOpen = false;
    }
  }

  private drawWheel(g: CanvasRenderingContext2D, W: number, H: number, hover: string | null): never[] {
    const cx = W / 2;
    const cy = H / 2;
    const R = W * 0.47;
    const r0 = W * 0.15;
    const n = WEDGES.length;
    for (let i = 0; i < n; i++) {
      const id = WEDGES[i];
      const a0 = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const on = id === 'follow' ? companion.following : !companion.following && id === companion.poseId;
      const hot = id === hover;
      g.beginPath();
      g.arc(cx, cy, R, a0 + 0.02, a1 - 0.02);
      g.arc(cx, cy, r0, a1 - 0.02, a0 + 0.02, true);
      g.closePath();
      g.fillStyle = hot ? SIGNAL : on ? 'rgba(46, 226, 194, 0.35)' : 'rgba(11, 17, 22, 0.86)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = hot || on ? SIGNAL : 'rgba(46, 226, 194, 0.4)';
      g.stroke();
      const am = (a0 + a1) / 2;
      const rm = (R + r0) / 2;
      const text = WEDGE_LABEL[id];
      const words = text.split(' ');
      words.forEach((w, j) => {
        label(g, w, cx + Math.cos(am) * rm, cy + Math.sin(am) * rm + (j - (words.length - 1) / 2) * 30, 26, hot ? INK : PAPER);
      });
    }
    // The hub: what it is doing now.
    g.beginPath();
    g.arc(cx, cy, r0 * 0.86, 0, Math.PI * 2);
    g.fillStyle = 'rgba(11, 17, 22, 0.92)';
    g.fill();
    label(g, companion.following ? 'FOLLOWING' : POSE_LABEL[companion.poseId], cx, cy, 20, SIGNAL);
    return [];
  }

  /* ── carry + stick ──────────────────────────────────────────────────── */

  private updateGrab(): void {
    const robot = this.robot;
    if (this.heldBy) {
      const gp = this.input.xr.gamepads[this.heldBy];
      if (gp?.getButtonPressed(InputComponent.Squeeze) ?? false) return;
      this.release();
      return;
    }
    robot.body.getWorldPosition(_p);
    for (const hand of HANDS) {
      const gp = this.input.xr.gamepads[hand];
      if (!gp?.getButtonDown(InputComponent.Squeeze)) continue;
      this.player.gripSpaces[hand].getWorldPosition(_to);
      if (_to.distanceTo(_p) > COMPANION.grabRadius) continue;
      this.heldBy = hand;
      companion.state = 'held';
      companion.following = false;
      this.target = POSES.crouch; // it balls up in your hand
      this.player.gripSpaces[hand].attach(robot.root);
      sfx.grab();
      return;
    }
  }

  private release(): void {
    const robot = this.robot;
    this.heldBy = null;
    this.scene.attach(robot.root);
    const place = currentPlace();
    robot.body.getWorldPosition(_p);
    // Sticking: probe from the body along its own belly (−y) and straight
    // out through the nearest wall.
    if (place && place.stickables.length) {
      robot.root.getWorldQuaternion(_q);
      _n.set(0, -1, 0).applyQuaternion(_q);
      const probes = [_n.clone(), new Vector3(0, 1, 0), new Vector3(0, 0, -1).applyQuaternion(_q), new Vector3(0, 0, 1).applyQuaternion(_q), new Vector3(1, 0, 0).applyQuaternion(_q), new Vector3(-1, 0, 0).applyQuaternion(_q)];
      let best: Intersection | null = null;
      for (const dir of probes) {
        _ray.set(_p, dir);
        _ray.near = 0;
        _ray.far = COMPANION.stickReach;
        const hit = _ray.intersectObjects(place.stickables, true)[0];
        if (hit && (!best || hit.distance < best.distance)) best = hit;
      }
      if (best && best.face) {
        const normal = best.face.normal.clone().transformDirection(best.object.matrixWorld).normalize();
        // A floor is for standing on: only walls, slopes and ceilings stick.
        if (normal.y < 0.6) {
          this.stickTo(best.point, normal);
          return;
        }
      }
    }
    // Landing: the floor beneath, else the floor under you.
    const under = floorUnder(_p.x, _p.z, _p.y + 0.2) ?? floorUnder(_head.x, _head.z, _head.y);
    robot.root.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const yaw = Math.atan2(-_fwd.x, -_fwd.z);
    robot.root.quaternion.identity();
    robot.root.rotation.y = yaw;
    if (under) robot.root.position.set(under.point.x, under.point.y, under.point.z);
    else robot.root.position.set(_p.x, 0, _p.z);
    companion.state = 'free';
    companion.following = false;
    companion.poseId = 'stand';
    this.target = POSES.stand;
    sfx.drop();
  }

  private stickTo(point: Vector3, normal: Vector3): void {
    const robot = this.robot;
    // Basis: up = the normal; forward = the robot's old forward flattened
    // onto the surface (or, if it faced the wall square on, straight up
    // the wall — a robot on a wall looks up it).
    robot.root.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    _fwd.addScaledVector(normal, -_fwd.dot(normal));
    if (_fwd.lengthSq() < 1e-4) _fwd.copy(UP).addScaledVector(normal, -UP.dot(normal));
    if (_fwd.lengthSq() < 1e-4) _fwd.set(1, 0, 0).addScaledVector(normal, -normal.x);
    _fwd.normalize();
    _z.copy(_fwd).negate();
    _x.crossVectors(normal, _z).normalize();
    _m.makeBasis(_x, normal, _z);
    robot.root.quaternion.setFromRotationMatrix(_m);
    robot.root.position.copy(point).addScaledVector(normal, 0.004);
    this.stuckUp.copy(normal);
    companion.state = 'stuck';
    companion.following = false;
    companion.poseId = 'cling';
    this.target = POSES.cling;
    sfx.stick();
  }

  private unstick(): void {
    const robot = this.robot;
    robot.body.getWorldPosition(_p);
    robot.root.quaternion.identity();
    const under = floorUnder(_p.x, _p.z, _p.y + 0.2);
    robot.root.position.set(_p.x, under?.point.y ?? 0, _p.z);
    companion.state = 'free';
  }
}

