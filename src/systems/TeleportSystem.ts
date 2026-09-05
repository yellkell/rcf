/**
 * TeleportSystem — FIRE FIGHT 2's club movement, carried over whole
 * (ff2/src/rave/systems/ClubTeleportSystem.ts): teleport-only, no sliding,
 * no smooth turn.
 *
 *  - Push either thumbstick FORWARD and that controller starts aiming: a
 *    ballistic arc curves from it to the floor, ending in a ring marker
 *    with an arrow inside it.
 *  - Move the controller to move the landing spot; roll the thumbstick to
 *    spin the arrow — that's the way you'll be FACING when you arrive.
 *  - Let the stick spring back and you're there, through a short blink.
 *  - An isolated sideways flick (when not aiming) is a snap turn.
 *  - BACK on the stick is a short step backwards, on the spot.
 *
 * What changed from the club: landings are no longer rectangles from a
 * table. The arc is raycast against the PLACE's floor meshes segment by
 * segment, so a step, a boulder or a mezzanine is a floor by being tagged
 * one, and the hop is refused when a blocker mesh stands between your head
 * and the landing. Environments describe themselves; this reads them.
 *
 * A headset RECENTRE (the reference space's `reset` event) folds the new
 * origin in so you stay exactly where you stood.
 */

import { createSystem, InputComponent } from '@iwsdk/core';
import {
  BackSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
  type Intersection,
} from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { XROrigin } from '@iwsdk/xr-input';
import { PALETTE, TELEPORT } from '../config.js';
import * as sfx from '../audio/sfx.js';
import { currentPlace } from '../env/place.js';

const _origin = new Vector3();
const _dir = new Vector3();
const _quat = new Quaternion();
const _p = new Vector3();
const _v = new Vector3();
const _head = new Vector3();
const _seg = new Vector3();
const _ray = new Raycaster();
_ray.firstHitOnly = true;

/**
 * Move the rig so the player's head lands over (x, z) at floor height `y`,
 * facing `yaw` (three.js convention: yaw 0 looks down −z).
 */
export function teleportPlayer(player: XROrigin, x: number, z: number, yaw: number, y = 0): void {
  player.head.getWorldPosition(_head);
  player.head.getWorldQuaternion(_quat);
  _dir.set(0, 0, -1).applyQuaternion(_quat);
  const headYaw = Math.atan2(-_dir.x, -_dir.z);

  const dYaw = yaw - headYaw;
  player.rotation.y += dYaw;
  player.position.y = y;

  const offX = _head.x - player.position.x;
  const offZ = _head.z - player.position.z;
  const cos = Math.cos(dYaw);
  const sin = Math.sin(dYaw);
  player.position.x = x - (offX * cos + offZ * sin);
  player.position.z = z - (-offX * sin + offZ * cos);
}

/** Snap-turn the rig by `deltaYaw` about the player's HEAD. */
export function snapTurn(player: XROrigin, deltaYaw: number): void {
  player.head.getWorldPosition(_head);
  const hx = _head.x;
  const hz = _head.z;
  player.rotation.y += deltaYaw;
  const offX = hx - player.position.x;
  const offZ = hz - player.position.z;
  const cos = Math.cos(deltaYaw);
  const sin = Math.sin(deltaYaw);
  player.position.x = hx - (offX * cos + offZ * sin);
  player.position.z = hz - (-offX * sin + offZ * cos);
}

/** Where the floor is under (x, z): the highest walkable hit under a probe
 *  dropped from `fromY`. Null when there is no floor there at all. */
export function floorUnder(x: number, z: number, fromY = 3): Intersection | null {
  const place = currentPlace();
  if (!place) return null;
  _ray.set(_origin.set(x, fromY, z), _dir.set(0, -1, 0));
  _ray.near = 0;
  _ray.far = fromY + 5;
  const hits = _ray.intersectObjects(place.floors, true);
  return hits.length ? hits[0] : null;
}

/** True when a blocker stands on the straight line between two points. */
export function blocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const place = currentPlace();
  if (!place || place.blockers.length === 0) return false;
  _seg.set(bx - ax, by - ay, bz - az);
  const len = _seg.length();
  if (len < 1e-4) return false;
  _ray.set(_origin.set(ax, ay, az), _seg.divideScalar(len));
  _ray.near = 0;
  _ray.far = len;
  return _ray.intersectObjects(place.blockers, true).length > 0;
}

/** Dev window on the moves that resolve without a stick (`__rcf.move`). */
export const teleportView: {
  stepBack?: () => void;
  snapTurn?: (dir: -1 | 1) => void;
  go?: (x: number, z: number, yaw?: number) => void;
} = {};

export class TeleportSystem extends createSystem({}) {
  private aimingHand: 'left' | 'right' | null = null;
  private arc!: Line2;
  private arcGeo!: LineGeometry;
  private arcMat!: LineMaterial;
  private arcBuf = new Array<number>(TELEPORT.arcPoints * 3).fill(0);
  private marker!: Group;
  private markerMat!: MeshBasicMaterial;
  private arrowMat!: MeshBasicMaterial;
  private landing = new Vector3();
  private landingYaw = 0;
  private valid = false;
  private snapArmed = true;
  private refSpace: XRReferenceSpace | null = null;
  private recentered = false;
  private recenterPose = { x: 0, z: 0, yaw: 0, y: 0 };
  /** The blink: a black shell around the head that fades up and down. */
  private shade!: Mesh;
  private shadeMat!: MeshBasicMaterial;
  private fade = 0; // 0..1 opacity target progress
  private fadeDir: -1 | 0 | 1 = 0;
  private pendingStep: (() => void) | null = null;

  private onRecenter = (): void => {
    this.player.head.getWorldPosition(_head);
    this.player.head.getWorldQuaternion(_quat);
    _dir.set(0, 0, -1).applyQuaternion(_quat);
    this.recenterPose.x = _head.x;
    this.recenterPose.z = _head.z;
    this.recenterPose.yaw = Math.atan2(-_dir.x, -_dir.z);
    this.recenterPose.y = this.player.position.y;
    this.recentered = true;
  };

  init(): void {
    teleportView.stepBack = () => this.stepBack();
    teleportView.snapTurn = (dir) => snapTurn(this.player, dir > 0 ? -TELEPORT.snapAngle : TELEPORT.snapAngle);
    teleportView.go = (x, z, yaw) => {
      const hit = floorUnder(x, z);
      teleportPlayer(this.player, x, z, yaw ?? 0, hit?.point.y ?? 0);
    };

    this.arcGeo = new LineGeometry();
    this.arcGeo.setPositions(this.arcBuf);
    this.arcMat = new LineMaterial({
      color: PALETTE.signal,
      linewidth: 0.012,
      worldUnits: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.arc = new Line2(this.arcGeo, this.arcMat);
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    this.scene.add(this.arc);

    // The landing marker: a flat ring with an arrow inside it.
    this.markerMat = new MeshBasicMaterial({
      color: PALETTE.signal,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const ring = new Mesh(new RingGeometry(TELEPORT.markerRadius * 0.82, TELEPORT.markerRadius, 40), this.markerMat);
    ring.rotation.x = -Math.PI / 2;
    this.marker = new Group();
    this.marker.add(ring);
    const shape = new Shape();
    shape.moveTo(0, 0.19);
    shape.lineTo(0.1, 0.03);
    shape.lineTo(0.04, 0.03);
    shape.lineTo(0.04, -0.15);
    shape.lineTo(-0.04, -0.15);
    shape.lineTo(-0.04, 0.03);
    shape.lineTo(-0.1, 0.03);
    shape.closePath();
    this.arrowMat = new MeshBasicMaterial({
      color: PALETTE.signal,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const arrow = new Mesh(new ShapeGeometry(shape), this.arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.y = 0.004;
    this.marker.add(arrow);
    this.marker.renderOrder = 20;
    this.marker.visible = false;
    this.scene.add(this.marker);

    // The blink shell rides the head so it covers both eyes at any pose.
    this.shadeMat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.shade = new Mesh(new SphereGeometry(0.4, 12, 8), this.shadeMat);
    this.shade.renderOrder = 1000;
    this.shade.frustumCulled = false;
    this.shade.visible = false;
    this.player.head.add(this.shade);
  }

  update(delta: number): void {
    this.watchRecenter();
    this.stepFade(delta);

    if (this.recentered) {
      this.recentered = false;
      const p = this.recenterPose;
      teleportPlayer(this.player, p.x, p.z, p.yaw, p.y);
    }

    if (!currentPlace()) {
      this.hide();
      return;
    }
    // Mid-blink: the stick is not read, so a step never doubles.
    if (this.fadeDir !== 0) {
      this.hide();
      return;
    }

    if (!this.aimingHand && this.tryFlick()) return;

    let axes: { x: number; y: number } | null = null;
    if (this.aimingHand) {
      const a = this.input.xr.gamepads[this.aimingHand]?.getAxesValues(InputComponent.Thumbstick);
      axes = a ?? null;
    } else {
      for (const hand of ['left', 'right'] as const) {
        const a = this.input.xr.gamepads[hand]?.getAxesValues(InputComponent.Thumbstick);
        if (a && a.y <= -TELEPORT.engage && Math.abs(a.y) >= Math.abs(a.x)) {
          this.aimingHand = hand;
          axes = a;
          break;
        }
      }
    }

    if (!this.aimingHand || !axes) {
      this.hide();
      return;
    }

    const mag = Math.hypot(axes.x, axes.y);
    if (mag < TELEPORT.release) {
      if (this.valid) {
        const { x, y, z } = this.landing;
        const yaw = this.landingYaw;
        this.blink(() => teleportPlayer(this.player, x, z, yaw, y));
        sfx.step();
      }
      this.hide();
      return;
    }

    this.traceArc(axes);
  }

  /** Run `move` at the darkest point of a short blink. */
  private blink(move: () => void): void {
    this.pendingStep = move;
    this.fadeDir = 1;
    this.shade.visible = true;
  }

  private stepFade(delta: number): void {
    if (this.fadeDir === 0) return;
    this.fade += (delta / TELEPORT.fadeSeconds) * this.fadeDir;
    if (this.fadeDir === 1 && this.fade >= 1) {
      this.fade = 1;
      this.pendingStep?.();
      this.pendingStep = null;
      this.fadeDir = -1;
    } else if (this.fadeDir === -1 && this.fade <= 0) {
      this.fade = 0;
      this.fadeDir = 0;
      this.shade.visible = false;
    }
    this.shadeMat.opacity = this.fade;
  }

  private traceArc(axes: { x: number; y: number }): void {
    const place = currentPlace()!;
    const ray = this.player.raySpaces[this.aimingHand!];
    ray.getWorldPosition(_origin);
    ray.getWorldQuaternion(_quat);
    _dir.set(0, 0, -1).applyQuaternion(_quat);

    _p.copy(_origin);
    _v.copy(_dir).multiplyScalar(TELEPORT.launchSpeed);
    const buf = this.arcBuf;
    const put = (i: number): void => {
      buf[i * 3] = _p.x;
      buf[i * 3 + 1] = _p.y;
      buf[i * 3 + 2] = _p.z;
    };
    let landed = false;
    let hitNormalUp = false;
    for (let i = 0; i < TELEPORT.arcPoints; i++) {
      put(i);
      if (landed) continue;
      _v.y -= TELEPORT.gravity * TELEPORT.arcStep;
      // The segment this sample flies: raycast it against the floors.
      _seg.copy(_v).multiplyScalar(TELEPORT.arcStep);
      const len = _seg.length();
      _ray.set(_p, _seg.clone().divideScalar(len));
      _ray.near = 0;
      _ray.far = len;
      const hits = _ray.intersectObjects(place.floors, true);
      if (hits.length) {
        const h = hits[0];
        _p.copy(h.point);
        landed = true;
        // Only a face that looks roughly UP is a landing; the side of a
        // step is a floor mesh too, and you don't stand on it.
        const n = h.face?.normal;
        if (n) {
          const wn = n.clone().transformDirection(h.object.matrixWorld);
          hitNormalUp = wn.y > 0.6;
        } else hitNormalUp = true;
        this.landing.copy(_p);
        for (let j = i + 1; j < TELEPORT.arcPoints; j++) {
          buf[j * 3] = _p.x;
          buf[j * 3 + 1] = _p.y;
          buf[j * 3 + 2] = _p.z;
        }
        break;
      }
      _p.add(_seg);
    }
    if (!landed) this.landing.copy(_p);
    this.arcGeo.setPositions(buf);

    this.player.head.getWorldPosition(_head);
    // The hop is judged at head height above the higher of the two floors:
    // a wall between you and the landing refuses it.
    const eye = _head.y - this.player.position.y;
    this.valid =
      landed &&
      hitNormalUp &&
      !blocked(_head.x, _head.y, _head.z, this.landing.x, this.landing.y + eye * 0.9, this.landing.z);

    const ctrlYaw = Math.atan2(-_dir.x, -_dir.z);
    const stickAngle = Math.atan2(axes.x, -axes.y);
    this.landingYaw = ctrlYaw - stickAngle;

    const colour = this.valid ? PALETTE.signal : PALETTE.danger;
    this.markerMat.color.set(colour);
    this.arrowMat.color.set(colour);
    this.arcMat.color.set(colour);
    this.marker.position.set(this.landing.x, this.landing.y + 0.01, this.landing.z);
    this.marker.rotation.y = this.landingYaw;
    this.marker.visible = true;
    this.arc.visible = true;
  }

  private tryFlick(): boolean {
    let sx = 0;
    let sy = 0;
    let mag = 0;
    for (const hand of ['left', 'right'] as const) {
      const a = this.input.xr.gamepads[hand]?.getAxesValues(InputComponent.Thumbstick);
      if (!a) continue;
      const m = Math.hypot(a.x, a.y);
      if (m > mag) {
        mag = m;
        sx = a.x;
        sy = a.y;
      }
    }
    if (mag < TELEPORT.snapReset) {
      this.snapArmed = true;
      return false;
    }
    if (!this.snapArmed) return false;
    if (Math.abs(sx) >= TELEPORT.snapEngage && Math.abs(sx) > Math.abs(sy)) {
      this.snapArmed = false;
      snapTurn(this.player, sx > 0 ? -TELEPORT.snapAngle : TELEPORT.snapAngle);
      sfx.uiClick();
      return true;
    }
    if (sy >= TELEPORT.engage && sy > Math.abs(sx)) {
      this.snapArmed = false;
      this.stepBack();
      return true;
    }
    return false;
  }

  /** Half a metre backwards, away from where the HEAD is looking, on your
   *  own level, with nothing in the way — shorter steps tried in turn. */
  private stepBack(): void {
    this.player.head.getWorldPosition(_head);
    this.player.head.getWorldQuaternion(_quat);
    _dir.set(0, 0, -1).applyQuaternion(_quat);
    const flat = Math.hypot(_dir.x, _dir.z);
    if (flat < 1e-4) return;
    const bx = -_dir.x / flat;
    const bz = -_dir.z / flat;
    const fromY = this.player.position.y;
    const yaw = Math.atan2(-_dir.x, -_dir.z);
    for (const step of TELEPORT.stepBack) {
      const x = _head.x + bx * step;
      const z = _head.z + bz * step;
      const hit = floorUnder(x, z, _head.y);
      if (!hit) continue;
      if (Math.abs(hit.point.y - fromY) > 0.08) continue;
      if (blocked(_head.x, _head.y, _head.z, x, _head.y, z)) continue;
      teleportPlayer(this.player, x, z, yaw, hit.point.y);
      sfx.uiClick();
      return;
    }
  }

  private watchRecenter(): void {
    const space = this.renderer.xr.getReferenceSpace();
    if (space === this.refSpace) return;
    this.refSpace?.removeEventListener('reset', this.onRecenter);
    this.refSpace = space;
    space?.addEventListener('reset', this.onRecenter);
  }

  private hide(): void {
    this.aimingHand = null;
    this.valid = false;
    this.arc.visible = false;
    this.marker.visible = false;
  }
}
