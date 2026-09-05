/**
 * Controller ray helpers + the pointer visual (ff2/src/rave/ui/pointer.ts:
 * the beam draws only when it is ON something, the dot rides the hit).
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import type { XROrigin } from '@iwsdk/xr-input';

export type Hand = 'left' | 'right';
export const HANDS: readonly Hand[] = ['left', 'right'];

const _q = new Quaternion();

/** Point `ray` down a controller's ray space. */
export function aimRay(player: XROrigin, hand: Hand, ray: Raycaster): void {
  const space = player.raySpaces[hand];
  space.getWorldPosition(ray.ray.origin);
  space.getWorldQuaternion(_q);
  ray.ray.direction.set(0, 0, -1).applyQuaternion(_q);
}

const HOVER_IN_S = 0.1;
const HOVER_OUT_S = 0.18;
const CLICK_S = 0.15;

export class PointerRay {
  private line: Line;
  private lineMat: LineBasicMaterial;
  private dot: Mesh;
  private dotMat: MeshBasicMaterial;
  private hoverAmt = 0;
  private clickAmt = 0;

  constructor(parent: Object3D, colour = 0x2ee2c2) {
    this.lineMat = new LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.25,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -1)]);
    this.line = new Line(geo, this.lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.dotMat = new MeshBasicMaterial({ color: 0xe7f4f1, transparent: true, opacity: 0.95, depthTest: false });
    this.dot = new Mesh(new SphereGeometry(0.008, 12, 10), this.dotMat);
    this.dot.renderOrder = 31;
    this.dot.visible = false;
    parent.add(this.line);
    parent.add(this.dot);
  }

  update(delta: number, origin: Vector3, end: Vector3 | null, hovering: boolean): void {
    const on = end !== null;
    this.line.visible = on;
    this.dot.visible = on;
    if (!on) {
      this.hoverAmt = 0;
      this.clickAmt = 0;
      return;
    }
    const pos = this.line.geometry.getAttribute('position');
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    this.dot.position.copy(end);
    const want = hovering ? 1 : 0;
    const rate = want > this.hoverAmt ? delta / HOVER_IN_S : delta / HOVER_OUT_S;
    this.hoverAmt = this.hoverAmt < want ? Math.min(want, this.hoverAmt + rate) : Math.max(want, this.hoverAmt - rate);
    this.clickAmt = Math.max(0, this.clickAmt - delta / CLICK_S);
    this.dot.scale.setScalar(1 + 0.32 * this.hoverAmt + 0.5 * this.clickAmt);
    this.lineMat.opacity = 0.22 + 0.26 * this.hoverAmt;
    this.dotMat.opacity = 0.8 + 0.2 * this.hoverAmt;
  }

  click(): void {
    this.clickAmt = 1;
  }

  hide(): void {
    this.line.visible = false;
    this.dot.visible = false;
    this.hoverAmt = 0;
  }
}
