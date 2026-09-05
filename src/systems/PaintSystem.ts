/**
 * PaintSystem — THE BAY, on the robot itself (ff2/docs/paint.md §2).
 *
 * The robot is the canvas: wherever it stands, in the light it will hide
 * in, you paint it. B (right) or Y (left) opens THE TRAY beside it — the
 * four kinds and the colours, this place's own tones first — and a tap on
 * a swatch puts a unit in your hand. Then:
 *
 *  - sweep the ray over the robot: the unit ghost-previews under it, live;
 *  - thumbstick x twists it, y sizes it, grip + y sets a stripe's width;
 *  - trigger places it;
 *  - with an empty hand, trigger on placed paint lifts it back up;
 *  - B/Y with a unit held drops the unit.
 *
 * The bake is the paint module's; this system decides WHEN (a look
 * change, a throttled ghost) and never per frame.
 */

import { createSystem, InputComponent } from '@iwsdk/core';
import { Raycaster, Vector3, type Intersection, type Object3D } from 'three';
import * as sfx from '../audio/sfx.js';
import { PAINT } from '../config.js';
import {
  KIND_LABEL,
  PAINT_KINDS,
  applyLook,
  bay,
  clearLook,
  handLift,
  handPlace,
  handReturn,
  handTake,
  myLook,
  paintState,
  type PaintKind,
  type PaintPart,
} from '../companion/paint.js';
import { currentPlace } from '../env/place.js';
import { HANDS, PointerRay, aimRay, type Hand } from '../input/rays.js';
import { Panel, PAPER, SIGNAL, chip, label, plateBg, type PanelButton } from '../ui/panel.js';
import { companion } from './CompanionSystem.js';
import { environmentView } from './EnvironmentSystem.js';
import { game, setPhase } from '../game/state.js';

const _ray = new Raycaster();
const _head = new Vector3();
const _p = new Vector3();
const _side = new Vector3();

const TRAY_W = 900;
const TRAY_H = 1180;

/** Read by the dev hook and the probes. */
export const paintView: { trayOpen: boolean; click?: (id: string) => void } = { trayOpen: false };

export class PaintSystem extends createSystem({}) {
  private tray!: Panel;
  private pointers!: Record<Hand, PointerRay>;
  private ghostOn = false;
  private ghostAt = 0;
  private hoverHand: Hand | null = null;
  private lookVersion = -1;

  init(): void {
    this.tray = new Panel('tray', 0.5, 0.5 * (TRAY_H / TRAY_W), TRAY_W, TRAY_H, (g, W, H, hover) => this.drawTray(g, W, H, hover));
    this.scene.add(this.tray.group);
    this.pointers = { left: new PointerRay(this.scene), right: new PointerRay(this.scene) };
    paintView.click = (id) => this.trayAction(id);
  }

  update(delta: number): void {
    const robot = companion.robot;
    if (!robot) return;
    this.player.head.getWorldPosition(_head);

    // Seekers do not paint: the tray shuts, the hand empties, the ray rests.
    if (game.phase === 'seek') {
      if (bay.held) handReturn();
      if (this.tray.visible) {
        this.tray.visible = false;
        paintView.trayOpen = false;
      }
      if (this.ghostOn) this.rebake();
      for (const hand of HANDS) this.pointers[hand].hide();
      if (paintState.version !== this.lookVersion) this.rebake();
      return;
    }

    // The tray: B/Y toggles it (or drops a held unit).
    for (const hand of HANDS) {
      const gp = this.input.xr.gamepads[hand];
      const btn = hand === 'right' ? InputComponent.B_Button : InputComponent.Y_Button;
      if (!gp?.getButtonDown(btn)) continue;
      if (bay.held) {
        handReturn();
        this.rebake();
        sfx.paintLift();
      } else {
        this.tray.visible = !this.tray.visible;
        paintView.trayOpen = this.tray.visible;
        sfx.uiClick();
      }
    }
    if (this.tray.visible) this.parkTray();

    // Targets: the tray and every shell.
    const targets: Object3D[] = this.tray.visible ? [this.tray.mesh, ...robot.shells] : [...robot.shells];
    let hovered: { hand: Hand; part: PaintPart; u: number; v: number } | null = null;
    let trayHover: string | null = null;
    for (const hand of HANDS) {
      // The hand carrying the robot does not paint it.
      aimRay(this.player, hand, _ray);
      _ray.near = 0;
      _ray.far = 6;
      const hit = _ray.intersectObjects(targets, false)[0] as Intersection | undefined;
      const gp = this.input.xr.gamepads[hand];
      const down = gp?.getButtonDown(InputComponent.Trigger) ?? false;
      if (!hit) {
        this.pointers[hand].update(delta, _ray.ray.origin, null, false);
        continue;
      }
      if (hit.object === this.tray.mesh) {
        const b = hit.uv ? this.tray.buttonAt(hit.uv.x, hit.uv.y) : null;
        trayHover = b?.id ?? trayHover;
        this.pointers[hand].update(delta, _ray.ray.origin, hit.point, !!b);
        if (down && b) {
          this.pointers[hand].click();
          this.trayAction(b.id);
        }
        continue;
      }
      const part = hit.object.userData.paintPart as PaintPart;
      if (hit.uv && !hovered) {
        hovered = { hand, part, u: hit.uv.x, v: hit.uv.y };
      }
      this.pointers[hand].update(delta, _ray.ray.origin, hit.point, true);
      if (!hit.uv) continue;
      if (bay.held) {
        const axes = gp?.getAxesValues(InputComponent.Thumbstick);
        const grip = gp?.getButtonPressed(InputComponent.Squeeze) ?? false;
        if (axes) {
          if (Math.abs(axes.x) > 0.25) bay.held.angle = (bay.held.angle + axes.x * delta * 0.25 + 1) % 1;
          if (Math.abs(axes.y) > 0.25) {
            const k = grip && bay.held.kind === 'stripe' ? 'wid' : 'len';
            bay.held[k] = Math.max(0.02, Math.min(PAINT.maxSize, bay.held[k] - axes.y * delta * 0.5));
          }
        }
        if (down) {
          if (handPlace(part, hit.uv.x, hit.uv.y)) {
            this.ghostOn = false;
            this.pointers[hand].click();
            sfx.paintPlace();
          }
        }
      } else if (down) {
        if (handLift(part, hit.uv.x, hit.uv.y)) {
          this.pointers[hand].click();
          sfx.paintLift();
        }
      }
    }

    // The ghost: a live, throttled preview of the held unit under the ray.
    bay.hover = hovered ? { part: hovered.part, u: hovered.u, v: hovered.v } : null;
    this.hoverHand = hovered?.hand ?? null;
    if (bay.held && hovered) this.bakeGhost(hovered);
    else if (this.ghostOn) this.rebake();

    if (paintState.version !== this.lookVersion) {
      this.lookVersion = paintState.version;
      if (!this.ghostOn) this.rebake();
    }

    if (this.tray.visible) {
      this.tray.hovered = trayHover;
      this.tray.redraw(`${bay.version}|${paintState.version}|${currentPlace()?.id ?? ''}`);
    }
  }

  /** The tray floats beside the robot, at chest height, facing you. */
  private parkTray(): void {
    const robot = companion.robot!;
    robot.body.getWorldPosition(_p);
    // To your left of the robot, as you see it.
    _side.set(_head.x - _p.x, 0, _head.z - _p.z).normalize();
    _side.set(_side.z, 0, -_side.x); // rotate 90°: your left
    const y = Math.max(_p.y + 0.1, 0.7);
    this.tray.group.position.set(_p.x + _side.x * 0.55, y + 0.25, _p.z + _side.z * 0.55);
    this.tray.group.lookAt(_head.x, y + 0.25, _head.z);
  }

  private rebake(): void {
    const robot = companion.robot;
    if (!robot) return;
    applyLook(robot.root, myLook());
    this.ghostOn = false;
    this.lookVersion = paintState.version;
  }

  private bakeGhost(at: { part: PaintPart; u: number; v: number }): void {
    const robot = companion.robot;
    if (!robot || !bay.held) return;
    const now = performance.now();
    if (this.ghostOn && now - this.ghostAt < 90) return;
    this.ghostAt = now;
    this.ghostOn = true;
    applyLook(robot.root, myLook(), { ...bay.held, ...at });
  }

  private trayAction(id: string): void {
    if (id.startsWith('kind:')) {
      bay.kind = id.slice(5) as PaintKind;
      bay.version += 1;
      if (bay.held) handTake(bay.kind, bay.held.colour);
      sfx.uiClick();
    } else if (id.startsWith('col:')) {
      handTake(bay.kind, Number(id.slice(4)));
      sfx.uiClick();
    } else if (id === 'drop') {
      handReturn();
      this.rebake();
      sfx.paintLift();
    } else if (id === 'clear') {
      clearLook();
      handReturn();
      sfx.paintLift();
    } else if (id === 'seek') {
      handReturn();
      this.tray.visible = false;
      paintView.trayOpen = false;
      setPhase('seek');
      sfx.uiClick();
    } else if (id === 'place') {
      handReturn();
      this.tray.visible = false;
      paintView.trayOpen = false;
      environmentView.next?.();
      sfx.step();
    } else if (id === 'close') {
      this.tray.visible = false;
      paintView.trayOpen = false;
      sfx.uiClick();
    }
  }

  private drawTray(g: CanvasRenderingContext2D, W: number, H: number, hover: string | null): PanelButton[] {
    const out: PanelButton[] = [];
    plateBg(g, 0, 0, W, H, 30);
    label(g, 'THE PAINT', W / 2, 54, 40, SIGNAL, 'center', 900);
    label(g, `${myLook().paint.length} / ${PAINT.maxUnits} placed`, W / 2, 96, 22, 'rgba(231,244,241,0.6)');

    // The kinds.
    const kx = 40;
    const kw = (W - 80 - 3 * 14) / 4;
    PAINT_KINDS.forEach((kind, i) => {
      const b: PanelButton = { id: `kind:${kind}`, x: kx + i * (kw + 14), y: 126, w: kw, h: 62 };
      chip(g, b, KIND_LABEL[kind], bay.kind === kind, hover === b.id, 24);
      out.push(b);
    });

    // This place's tones, big.
    const place = currentPlace();
    let y = 224;
    label(g, place ? `${place.name.toUpperCase()} — THIS PLACE` : 'THIS PLACE', 40, y, 22, 'rgba(231,244,241,0.7)', 'left');
    y += 24;
    const pal = place?.palette ?? [];
    const bigS = 92;
    const bigGap = 14;
    const perRow = Math.floor((W - 80 + bigGap) / (bigS + bigGap));
    pal.forEach((c, i) => {
      const b: PanelButton = {
        id: `col:${c}`,
        x: 40 + (i % perRow) * (bigS + bigGap),
        y: y + Math.floor(i / perRow) * (bigS + bigGap),
        w: bigS,
        h: bigS,
      };
      this.swatch(g, b, c, hover === b.id);
      out.push(b);
    });
    y += Math.ceil(Math.max(1, pal.length) / perRow) * (bigS + bigGap) + 26;

    // The whole rack, small.
    label(g, 'THE RACK', 40, y, 22, 'rgba(231,244,241,0.7)', 'left');
    y += 24;
    const s = 60;
    const gap = 10;
    const cols = Math.floor((W - 80 + gap) / (s + gap));
    PAINT.colours.forEach((_, c) => {
      const b: PanelButton = { id: `col:${c}`, x: 40 + (c % cols) * (s + gap), y: y + Math.floor(c / cols) * (s + gap), w: s, h: s };
      this.swatch(g, b, c, hover === b.id, true);
      out.push(b);
    });
    y += Math.ceil(PAINT.colours.length / cols) * (s + gap) + 20;

    // In hand.
    const held = bay.held;
    label(
      g,
      held ? `IN HAND: ${PAINT.colourNames[held.colour]} ${KIND_LABEL[held.kind]}` : 'TAP A COLOUR TO TAKE A UNIT',
      W / 2,
      y + 14,
      24,
      held ? SIGNAL : 'rgba(231,244,241,0.6)',
    );
    label(g, held ? 'point at the robot · stick twists and sizes · trigger places' : 'trigger on placed paint lifts it back up', W / 2, y + 46, 19, 'rgba(231,244,241,0.55)');
    y += 76;

    const bw = (W - 80 - 56) / 5;
    const row: [string, string][] = [
      ['drop', 'DROP UNIT'],
      ['clear', 'CLEAR ALL'],
      ['place', 'NEXT PLACE'],
      ['seek', 'PLAY: SEEK'],
      ['close', 'CLOSE'],
    ];
    row.forEach(([id, text], i) => {
      const b: PanelButton = { id, x: 40 + i * (bw + 14), y: H - 96, w: bw, h: 62 };
      chip(g, b, text, false, hover === b.id, 20);
      out.push(b);
    });
    void y;
    return out;
  }

  private swatch(g: CanvasRenderingContext2D, b: PanelButton, colour: number, hot: boolean, small = false): void {
    const hex = `#${PAINT.colours[colour].toString(16).padStart(6, '0')}`;
    g.beginPath();
    g.roundRect(b.x, b.y, b.w, b.h, small ? 10 : 16);
    g.fillStyle = hex;
    g.fill();
    g.lineWidth = hot ? 5 : 2;
    g.strokeStyle = hot ? SIGNAL : bay.held?.colour === colour ? PAPER : 'rgba(0,0,0,0.35)';
    g.stroke();
    if (!small) {
      const dark = ((PAINT.colours[colour] >> 16) & 255) * 0.3 + ((PAINT.colours[colour] >> 8) & 255) * 0.59 + (PAINT.colours[colour] & 255) * 0.11 < 120;
      label(g, PAINT.colourNames[colour], b.x + b.w / 2, b.y + b.h - 14, 13, dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)');
    }
  }

  get hoveringHand(): Hand | null {
    return this.hoverHand;
  }
}
