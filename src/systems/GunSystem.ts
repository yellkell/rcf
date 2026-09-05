/**
 * GunSystem — the seeker's tag (config GUN).
 *
 * In the SEEK phase a pistol rides your right hand. Trigger fires a ray
 * down the barrel: a robot shell in the way is FOUND (it crumples where it
 * lies, the sting plays); anything else is a miss — a chip of dust where
 * it landed, loud enough that a home player nearby knows a seeker is
 * about. FIVE SHOTS a round, counted in pips on the slide; empty is a dry
 * click. The magazine is the rule that makes the paint matter.
 *
 * HIDE again (the tray's PLAY button, the round clock, or B held with
 * the gun out) puts the gun away and reloads it.
 */

import { createSystem, InputComponent } from '@iwsdk/core';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Raycaster,
  Sprite,
  Vector3,
  type Intersection,
  type Object3D,
} from 'three';
import * as sfx from '../audio/sfx.js';
import { GUN, PALETTE } from '../config.js';
import { currentPlace } from '../env/place.js';
import { softSprite } from '../env/kit/skins.js';
import { game, onPhase, setPhase } from '../game/state.js';
import { Panel, label } from '../ui/panel.js';
import { companion } from './CompanionSystem.js';

const _ray = new Raycaster();
const _muzzle = new Vector3();
const _dir = new Vector3();
const _q = new Quaternion();

export const gunView: {
  shots: number;
  /** Fire down the barrel; returns what it hit. */
  fire?: () => 'robot' | 'world' | 'nothing' | 'empty' | 'cooling';
  /** Fire from the head toward a world point (headless probes). */
  fireAt?: (x: number, y: number, z: number, from?: [number, number, number]) => 'robot' | 'world' | 'nothing' | 'empty' | 'cooling';
  reload?: () => void;
  setPhase: typeof setPhase;
} = { shots: GUN.shots, setPhase };

export class GunSystem extends createSystem({}) {
  private gun!: Group;
  private pips!: Panel;
  private flash!: Sprite;
  private tracer!: Line;
  private tracerMat!: LineBasicMaterial;
  private puff!: Sprite;
  /** Wall-clock stamps (ms): the headless page's frames run slow, and a
   *  cooldown counted in frames would stretch with them. */
  private fxUntil = 0;
  private readyAt = 0;
  private holstered = true;

  init(): void {
    this.gun = this.buildGun();
    this.gun.visible = false;
    this.player.gripSpaces.right.add(this.gun);

    this.flash = new Sprite(softSprite(0xfff1b0, 0.95));
    this.flash.material.blending = AdditiveBlending;
    this.flash.scale.setScalar(0.12);
    this.flash.position.set(0, 0.02, -0.19);
    this.flash.visible = false;
    this.gun.add(this.flash);

    this.tracerMat = new LineBasicMaterial({ color: PALETTE.warm, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
    this.tracer = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), this.tracerMat);
    this.tracer.frustumCulled = false;
    this.tracer.visible = false;
    this.scene.add(this.tracer);

    this.puff = new Sprite(softSprite(0xd8d0c0, 0.7));
    this.puff.scale.setScalar(0.18);
    this.puff.visible = false;
    this.scene.add(this.puff);

    gunView.fire = () => this.fire();
    gunView.fireAt = (x, y, z, from) => {
      if (from) _muzzle.set(from[0], from[1], from[2]);
      else this.player.head.getWorldPosition(_muzzle);
      _dir.set(x, y, z).sub(_muzzle).normalize();
      return this.shoot();
    };
    gunView.reload = () => this.reload();
    // Every phase change reloads; leaving SEEK stands a found robot back up.
    onPhase((p) => {
      this.reload();
      if (p !== 'seek') companion.revive();
    });
  }

  update(): void {
    const now = performance.now();
    const out = game.phase === 'seek';
    if (out === this.holstered) {
      this.holstered = !out;
      this.gun.visible = out;
    }
    if (this.fxUntil && now > this.fxUntil) {
      this.fxUntil = 0;
      this.flash.visible = false;
      this.tracer.visible = false;
    }
    if (!out) return;

    this.pips.redraw(`${gunView.shots}`);

    const right = this.input.xr.gamepads.right;
    if (right?.getButtonDown(InputComponent.Trigger)) this.fire();
    // B held a beat with the gun out: back to hiding (a test convenience
    // until the round clock owns the phase).
    if (right?.getButtonDown(InputComponent.B_Button)) setPhase('hide');
  }

  private reload(): void {
    gunView.shots = GUN.shots;
    this.readyAt = 0;
  }

  /** Fire down the barrel. */
  private fire(): 'robot' | 'world' | 'nothing' | 'empty' | 'cooling' {
    this.flash.getWorldPosition(_muzzle);
    this.gun.getWorldQuaternion(_q);
    _dir.set(0, 0, -1).applyQuaternion(_q);
    return this.shoot();
  }

  /** Resolve a shot from _muzzle along _dir. */
  private shoot(): 'robot' | 'world' | 'nothing' | 'empty' | 'cooling' {
    if (game.phase !== 'seek') return 'nothing';
    const now = performance.now();
    if (now < this.readyAt) return 'cooling';
    if (gunView.shots <= 0) {
      sfx.dryFire();
      return 'empty';
    }
    gunView.shots -= 1;
    this.readyAt = now + GUN.cooldown * 1000;
    sfx.shot();
    this.flash.visible = true;
    this.fxUntil = now + GUN.tracerSeconds * 1000;

    _ray.set(_muzzle, _dir);
    _ray.near = 0.02;
    _ray.far = GUN.range;
    const robot = companion.robot;
    const targets: Object3D[] = [];
    if (robot && !companion.found) targets.push(...robot.shells);
    const place = currentPlace();
    if (place) targets.push(...place.floors, ...place.stickables);
    const hit = _ray.intersectObjects(targets, false)[0] as Intersection | undefined;
    const end = hit ? hit.point : _muzzle.clone().addScaledVector(_dir, GUN.range);
    const pos = this.tracer.geometry.getAttribute('position');
    pos.setXYZ(0, _muzzle.x, _muzzle.y, _muzzle.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.geometry.computeBoundingSphere();
    this.tracer.visible = true;

    if (hit && robot && hit.object.userData.paintPart) {
      companion.knockOut();
      sfx.found();
      return 'robot';
    }
    if (hit) {
      this.puff.position.copy(hit.point);
      this.puff.visible = true;
      window.setTimeout(() => (this.puff.visible = false), 220);
      sfx.ricochet();
      return 'world';
    }
    return 'nothing';
  }

  /** A chunky pistol: grip, frame, barrel, a teal slide with the pips. */
  private buildGun(): Group {
    const g = new Group();
    const steel = new MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.4, metalness: 0.7 });
    const teal = new MeshStandardMaterial({ color: PALETTE.signal, roughness: 0.5, metalness: 0.2, emissive: PALETTE.signal, emissiveIntensity: 0.25 });
    const grip = new Mesh(new BoxGeometry(0.03, 0.09, 0.04), steel);
    grip.position.set(0, -0.03, 0.01);
    grip.rotation.x = 0.25;
    g.add(grip);
    const frame = new Mesh(new BoxGeometry(0.034, 0.03, 0.14), steel);
    frame.position.set(0, 0.025, -0.05);
    g.add(frame);
    const slide = new Mesh(new BoxGeometry(0.03, 0.02, 0.15), teal);
    slide.position.set(0, 0.05, -0.05);
    g.add(slide);
    const barrel = new Mesh(new CylinderGeometry(0.008, 0.008, 0.06, 10), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, -0.15);
    g.add(barrel);
    const guard = new Mesh(new BoxGeometry(0.01, 0.03, 0.03), steel);
    guard.position.set(0, -0.005, -0.03);
    g.add(guard);
    // The pips: a little panel on top of the slide, facing your eye.
    this.pips = new Panel('pips', 0.03, 0.012, 256, 100, (gc, W, H) => {
      gc.fillStyle = 'rgba(11,17,22,0.85)';
      gc.fillRect(0, 0, W, H);
      for (let i = 0; i < GUN.shots; i++) {
        gc.beginPath();
        gc.roundRect(12 + i * ((W - 24) / GUN.shots) + 4, 22, (W - 24) / GUN.shots - 8, H - 44, 8);
        gc.fillStyle = i < gunView.shots ? '#2ee2c2' : 'rgba(231,244,241,0.15)';
        gc.fill();
      }
      if (gunView.shots === 0) label(gc, 'EMPTY', W / 2, H / 2, 40, '#ff3b2e');
      return [];
    });
    this.pips.group.position.set(0, 0.062, -0.02);
    this.pips.group.rotation.x = -Math.PI / 2 + 0.35;
    this.pips.visible = true;
    g.add(this.pips.group);
    return g;
  }
}
