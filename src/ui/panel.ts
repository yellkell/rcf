/**
 * The panel kit — a canvas drawn onto a plane, with buttons you point at.
 *
 * A cut-down version of FIRE FIGHT 2's ui/kit/panel.ts: a panel owns a
 * canvas, a list of rectangular buttons, a hovered button, and a redraw
 * that only runs when its key changes (the repaint-key discipline). Systems
 * raycast the plane, feed `hover(uv)` each frame and `click()` on the
 * trigger, and the panel tells them which button that was.
 */

import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

export interface PanelButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A hit-testable region the body draws itself. */
  ghost?: boolean;
}

export type PanelDraw = (g: CanvasRenderingContext2D, W: number, H: number, hover: string | null) => PanelButton[];

export class Panel {
  readonly group = new Group();
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private tex: CanvasTexture;
  private mat: MeshBasicMaterial;
  private buttons: PanelButton[] = [];
  private key = '';
  hovered: string | null = null;

  constructor(
    readonly name: string,
    readonly widthM: number,
    readonly heightM: number,
    readonly W: number,
    readonly H: number,
    private draw: PanelDraw,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.mat = new MeshBasicMaterial({ map: this.tex, transparent: true, side: DoubleSide, depthWrite: false });
    this.mesh = new Mesh(new PlaneGeometry(widthM, heightM), this.mat);
    this.mesh.name = `panel-${name}`;
    this.mesh.renderOrder = 10;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  set visible(v: boolean) {
    if (this.group.visible === v) return;
    this.group.visible = v;
    if (!v) this.hovered = null;
  }

  /** Redraw when `key` (or the hovered button) changed since last time. */
  redraw(key: string): void {
    const full = `${key}|${this.hovered ?? ''}`;
    if (full === this.key) return;
    this.key = full;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, this.W, this.H);
    this.buttons = this.draw(g, this.W, this.H, this.hovered);
    this.tex.needsUpdate = true;
  }

  /** The button under a plane uv (three's uv: v up). */
  buttonAt(u: number, v: number): PanelButton | null {
    const x = u * this.W;
    const y = (1 - v) * this.H;
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
}

/* ── the drawing vocabulary ───────────────────────────────────────────── */

export const INK = '#0b1116';
export const PAPER = '#e7f4f1';
export const SIGNAL = '#2ee2c2';
export const WARM = '#ffb02e';
export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** A plate: dark glass with a hairline edge. */
export function plateBg(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 26): void {
  roundRect(g, x, y, w, h, r);
  g.fillStyle = 'rgba(11, 17, 22, 0.86)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(46, 226, 194, 0.55)';
  g.stroke();
}

export function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour = PAPER,
  align: CanvasTextAlign = 'center',
  weight = 700,
): void {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = colour;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

/** A chip button; `on` = selected, `hot` = hovered. */
export function chip(g: CanvasRenderingContext2D, b: PanelButton, text: string, on: boolean, hot: boolean, size = 26): void {
  roundRect(g, b.x, b.y, b.w, b.h, 14);
  g.fillStyle = on ? SIGNAL : hot ? 'rgba(46, 226, 194, 0.28)' : 'rgba(231, 244, 241, 0.08)';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = on || hot ? SIGNAL : 'rgba(231, 244, 241, 0.25)';
  g.stroke();
  label(g, text, b.x + b.w / 2, b.y + b.h / 2, size, on ? INK : PAPER);
}
