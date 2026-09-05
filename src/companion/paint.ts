/**
 * THE PAINT — FIRE FIGHT 2's paint pipeline (ff2/src/avatar/paint.ts,
 * ff2/docs/paint.md), carried over for the robot.
 *
 * A LOOK is an ordered list of placed paint units — stripe, splotch, dot,
 * square — each quantized to bytes by construction (u, v, angle, len, wid
 * live in 0..255; colour and variant are indices), so the caps ARE the
 * validation and the same data renders the same everywhere. This module
 * owns the Look model + localStorage persistence, the 8-byte wire form,
 * THE HAND (the one unit held on the ray in the bay), and the BAKE: every
 * paint surface (meshes tagged `userData.paintPart`) gets a canvas per
 * MATERIAL painted primer-first, then every unit oldest-first, uploaded
 * once as the material's map. A repaint happens only when the look
 * changes; at runtime a painted robot costs exactly what a blank costs.
 *
 * What changed from FF2: the parts are the robot's (head, body, legs, fin);
 * there is no locker and no wallet — every colour on the rack is free to
 * take, because here the paint is the game, not the endgame; and the bake
 * keys its canvas on the material, so the four legs (one material) bake
 * once and wear one sheet.
 */

import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace, type Object3D } from 'three';
import { PAINT } from '../config.js';

export type PaintKind = 'stripe' | 'splotch' | 'dot' | 'square';
export const PAINT_KINDS: readonly PaintKind[] = ['stripe', 'splotch', 'dot', 'square'];
export const KIND_LABEL: Record<PaintKind, string> = { stripe: 'STRIPE', splotch: 'SPLOTCH', dot: 'DOT', square: 'SQUARE' };

export type PaintPart = 'head' | 'body' | 'legs' | 'fin';
export const PAINT_PARTS: readonly PaintPart[] = ['head', 'body', 'legs', 'fin'];

export interface PlacedPaint {
  kind: PaintKind;
  /** Index into PAINT.colours — the wire value, never a free RGB. */
  colour: number;
  /** Splotch silhouette roll. */
  variant: number;
  part: PaintPart;
  /** Anchor + pose, floats 0..1 here, bytes on the wire. */
  u: number;
  v: number;
  angle: number;
  len: number;
  wid: number;
}

export interface Look {
  paint: PlacedPaint[];
}

/* ── the store ────────────────────────────────────────────────────────── */

const KEY = 'rcf-look';

/** Bumped on every look change — whoever renders the robot repaints. */
export const paintState = { version: 1 };

let current: Look | null = null;

const clamp01 = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Validate one stored/received unit; null drops it (fail-soft). */
export function cleanUnit(raw: unknown): PlacedPaint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kind = (PAINT_KINDS as readonly unknown[]).includes(r.kind) ? (r.kind as PaintKind) : null;
  const part = (PAINT_PARTS as readonly unknown[]).includes(r.part) ? (r.part as PaintPart) : null;
  const colour = typeof r.colour === 'number' ? Math.floor(r.colour) : -1;
  if (!kind || !part || colour < 0 || colour >= PAINT.colours.length) return null;
  return {
    kind,
    part,
    colour,
    variant: typeof r.variant === 'number' ? Math.floor(Math.abs(r.variant)) % 256 : 0,
    u: clamp01(r.u),
    v: clamp01(r.v),
    angle: clamp01(r.angle),
    len: clamp01(r.len),
    wid: clamp01(r.wid),
  };
}

export function myLook(): Look {
  if (current) return current;
  let paint: PlacedPaint[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { paint?: unknown[] };
    paint = (raw.paint ?? []).map(cleanUnit).filter((p): p is PlacedPaint => p !== null).slice(0, PAINT.maxUnits);
  } catch {
    /* fresh robot */
  }
  current = { paint };
  return current;
}

export function setLook(look: Look): void {
  current = { paint: look.paint.map(cleanUnit).filter((p): p is PlacedPaint => p !== null).slice(0, PAINT.maxUnits) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode — the look lives for the session */
  }
  paintState.version += 1;
}

export function clearLook(): void {
  setLook({ paint: [] });
}

/* ── the wire form ────────────────────────────────────────────────────── */
//
// One unit is exactly 8 bytes:
//   b0  kind (bits 0..1) | part index (bits 2..7)
//   b1  colour index          b2  variant
//   b3  u ·255   b4  v ·255   b5  angle ·255   b6  len ·255   b7  wid ·255
// A whole look is [format byte][units…], base64'd. Format 1 is this game's
// first; the part order is append-only.

const WIRE_FORMAT = 1;
const WIRE_PARTS: PaintPart[] = ['head', 'body', 'legs', 'fin'];
const WIRE_KINDS: PaintKind[] = ['stripe', 'splotch', 'dot', 'square'];
const WIRE_MAX_CHARS = 1024;

const q255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n * 255)));

export function packLook(look: Look): string {
  const units = look.paint.slice(0, PAINT.maxUnits);
  if (units.length === 0) return '';
  const bytes = new Uint8Array(1 + units.length * 8);
  bytes[0] = WIRE_FORMAT;
  units.forEach((p, i) => {
    const o = 1 + i * 8;
    bytes[o] = Math.max(0, WIRE_KINDS.indexOf(p.kind)) | (Math.max(0, WIRE_PARTS.indexOf(p.part)) << 2);
    bytes[o + 1] = Math.min(255, p.colour);
    bytes[o + 2] = p.variant % 256;
    bytes[o + 3] = q255(p.u);
    bytes[o + 4] = q255(p.v);
    bytes[o + 5] = q255(p.angle);
    bytes[o + 6] = q255(p.len);
    bytes[o + 7] = q255(p.wid);
  });
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Anything wrong quietly yields the bare blank. */
export function unpackLook(wire: unknown): Look {
  const bare: Look = { paint: [] };
  if (typeof wire !== 'string' || wire.length === 0 || wire.length > WIRE_MAX_CHARS) return bare;
  let bin: string;
  try {
    bin = atob(wire);
  } catch {
    return bare;
  }
  if (bin.length < 1 + 8 || (bin.length - 1) % 8 !== 0) return bare;
  if (bin.charCodeAt(0) !== WIRE_FORMAT) return bare;
  const count = Math.min((bin.length - 1) / 8, PAINT.maxUnits);
  const paint: PlacedPaint[] = [];
  for (let i = 0; i < count; i++) {
    const o = 1 + i * 8;
    const b0 = bin.charCodeAt(o);
    const unit = cleanUnit({
      kind: WIRE_KINDS[b0 & 3],
      part: WIRE_PARTS[b0 >> 2],
      colour: bin.charCodeAt(o + 1),
      variant: bin.charCodeAt(o + 2),
      u: bin.charCodeAt(o + 3) / 255,
      v: bin.charCodeAt(o + 4) / 255,
      angle: bin.charCodeAt(o + 5) / 255,
      len: bin.charCodeAt(o + 6) / 255,
      wid: bin.charCodeAt(o + 7) / 255,
    });
    if (unit) paint.push(unit);
  }
  return { paint };
}

let packedCache = { version: -1, wire: '' };

export function myPackedLook(): string {
  if (packedCache.version !== paintState.version) {
    packedCache = { version: paintState.version, wire: packLook(myLook()) };
  }
  return packedCache.wire;
}

/* ── THE HAND ─────────────────────────────────────────────────────────── */

/** The one unit currently held on the ray, plus where the ray touches the
 *  robot this frame. The paint system drives this; the tray reads it. */
export const bay = {
  held: null as PlacedPaint | null,
  hover: null as { part: PaintPart; u: number; v: number } | null,
  /** The tray's current kind and the colour last taken. */
  kind: 'stripe' as PaintKind,
  colour: 14,
  version: 1,
};

/** Take a fresh unit into the hand. Default pose: modest size, upright. */
export function handTake(kind: PaintKind, colour: number): void {
  if (colour < 0 || colour >= PAINT.colours.length) return;
  bay.kind = kind;
  bay.colour = colour;
  bay.held = {
    kind,
    colour,
    variant: Math.floor(Math.random() * 8),
    part: 'body',
    u: 0.25,
    v: 0.5,
    angle: 0,
    len: kind === 'stripe' ? 0.3 : kind === 'splotch' ? 0.35 : kind === 'dot' ? 0.16 : 0.2,
    wid: kind === 'stripe' ? 0.12 : 0.5,
  };
  bay.version += 1;
}

/** Drop the held unit (paint is free: nothing to give back). */
export function handReturn(): void {
  if (!bay.held) return;
  bay.held = null;
  bay.version += 1;
}

/** Commit the held unit onto the robot at the hovered spot. */
export function handPlace(part: PaintPart, u: number, v: number): boolean {
  if (!bay.held) return false;
  const look = myLook();
  if (look.paint.length >= PAINT.maxUnits) return false;
  setLook({ paint: [...look.paint, { ...bay.held, part, u, v }] });
  bay.held = null;
  bay.version += 1;
  return true;
}

/** Lift the placed unit nearest (part, u, v) into the hand. */
export function handLift(part: PaintPart, u: number, v: number): boolean {
  if (bay.held) return false;
  const look = myLook();
  let best = -1;
  let bestD = 0.16;
  look.paint.forEach((p, i) => {
    if (p.part !== part) return;
    const du = Math.min(Math.abs(p.u - u), 1 - Math.abs(p.u - u));
    const d = Math.hypot(du, p.v - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return false;
  const paint = [...look.paint];
  const [unit] = paint.splice(best, 1);
  setLook({ paint });
  bay.held = unit;
  bay.version += 1;
  return true;
}

/* ── the bake ─────────────────────────────────────────────────────────── */

const PRIMER = '#f4f2ee';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** Deterministic per-unit rng (mulberry32) — a splotch rolls the same
 *  silhouette on every headset that ever bakes it. */
function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawUnit(g: CanvasRenderingContext2D, p: PlacedPaint, W: number, H: number, ghost = false): void {
  g.fillStyle = css(PAINT.colours[p.colour]);
  g.globalAlpha = ghost ? 0.55 : 1;
  const cy = (1 - p.v) * H;
  for (const off of [-1, 0, 1]) {
    const cx = (p.u + off) * W;
    if (cx < -W * 0.6 || cx > W * 1.6) continue;
    g.save();
    g.translate(cx, cy);
    g.rotate(p.angle * Math.PI * 2);
    if (p.kind === 'stripe') {
      const w = Math.max(4, p.len * W);
      const h = Math.max(3, p.wid * H * 0.35);
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, h / 2);
      g.fill();
    } else if (p.kind === 'dot') {
      g.beginPath();
      g.arc(0, 0, Math.max(3, p.len * W * 0.5), 0, Math.PI * 2);
      g.fill();
    } else if (p.kind === 'square') {
      const s = Math.max(4, p.len * W * 0.6);
      g.beginPath();
      g.roundRect(-s / 2, -s / 2, s, s, s * 0.06);
      g.fill();
    } else {
      const r = Math.max(4, p.len * W * 0.3);
      const squash = 0.6 + 0.4 * (p.wid || 0.5);
      const roll = rng(p.variant + p.colour * 31 + 7);
      const points = 9;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const rad = r * (0.62 + 0.38 * roll());
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad * squash;
        if (i === 0) g.moveTo(x, y);
        else {
          const pa = ((i - 0.5) / points) * Math.PI * 2;
          const pr = r * (0.75 + 0.35 * roll());
          g.quadraticCurveTo(Math.cos(pa) * pr, Math.sin(pa) * pr * squash, x, y);
        }
      }
      g.closePath();
      g.fill();
      for (let d = 0; d < 3; d++) {
        const a = roll() * Math.PI * 2;
        const dist = r * (1.15 + roll() * 0.5);
        const dr = r * (0.08 + roll() * 0.1);
        g.beginPath();
        g.arc(Math.cos(a) * dist, Math.sin(a) * dist * squash, dr, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

interface PaintStore {
  canvas: HTMLCanvasElement;
  tex: CanvasTexture;
}

/**
 * Bake `look` onto every paint surface under `root`. `ghost` is drawn last,
 * translucent — the held unit previewing under the ray. Cheap enough to
 * call on every look change; call it only then (and throttled for the
 * ghost) — never per frame.
 */
export function applyLook(root: Object3D, look: Look, ghost: PlacedPaint | null = null): void {
  const done = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    const part = o.userData?.paintPart as PaintPart | undefined;
    if (!part) return;
    const mesh = o as Mesh;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as MeshStandardMaterial;
    if (done.has(mat)) return;
    done.add(mat);
    const size = PAINT.canvas[part] ?? 256;
    let store = mat.userData.paintStore as PaintStore | undefined;
    if (!store) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      store = { canvas, tex };
      mat.userData.paintStore = store;
    }
    const g = store.canvas.getContext('2d')!;
    g.fillStyle = (mat.userData?.paintFill as string) ?? PRIMER;
    g.fillRect(0, 0, size, size);
    let painted = false;
    for (const p of look.paint) {
      if (p.part !== part) continue;
      drawUnit(g, p, size, size);
      painted = true;
    }
    if (ghost && ghost.part === part) drawUnit(g, ghost, size, size, true);
    const metal0 = (mat.userData.paintMetal0 as number | undefined) ?? mat.metalness;
    mat.userData.paintMetal0 = metal0;
    mat.metalness = painted ? Math.min(metal0, PAINT.metalness) : metal0;
    store.tex.needsUpdate = true;
    if (mat.map !== store.tex) {
      mat.map = store.tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  });
}

/** The look as words — its most-used colours by the palette's names. */
export function paintColourNames(look: Look, max = 3): string[] {
  const tally = new Map<number, number>();
  for (const p of look.paint) tally.set(p.colour, (tally.get(p.colour) ?? 0) + 1);
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([c]) => PAINT.colourNames[c] ?? '')
    .filter((n) => n !== '');
}

/** A demo look (dev + probes): prove the pipeline makes cool art. */
export function demoLook(): Look {
  const s = (part: PaintPart, u: number, v: number, angle: number, len: number, wid: number, colour: number): PlacedPaint => ({
    kind: 'stripe', part, u, v, angle, len, wid, colour, variant: 0,
  });
  const b = (part: PaintPart, u: number, v: number, len: number, colour: number, variant: number): PlacedPaint => ({
    kind: 'splotch', part, u, v, angle: 0, len, wid: 0.5, colour, variant,
  });
  return {
    paint: [
      // Moss down the spine (the back is u = 0.25), fern bands across it.
      s('body', 0.25, 0.5, 0.25, 0.7, 0.09, 24),
      s('body', 0.25, 0.7, 0, 0.36, 0.06, 25),
      s('body', 0.25, 0.4, 0, 0.4, 0.06, 25),
      b('body', 0.02, 0.45, 0.4, 26, 3),
      b('body', 0.48, 0.45, 0.4, 26, 7),
      b('body', 0.25, 0.22, 0.32, 27, 11),
      s('head', 0.25, 0.55, 0, 0.5, 0.12, 24),
      b('head', 0.25, 0.3, 0.3, 26, 5),
      s('legs', 0.5, 0.5, 0.25, 0.9, 0.2, 25),
      b('fin', 0.5, 0.5, 0.45, 24, 2),
      { kind: 'dot', part: 'body', u: 0.25, v: 0.86, angle: 0, len: 0.12, wid: 0.5, colour: 32, variant: 0 },
      { kind: 'square', part: 'fin', u: 0.3, v: 0.6, angle: 0.125, len: 0.2, wid: 0.5, colour: 27, variant: 0 },
    ],
  };
}
