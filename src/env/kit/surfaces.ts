/**
 * Surface painters — canvas-drawn tiling textures for the built world
 * (in the manner of ff2's club/materials.ts and pub/textures.ts).
 * Every painter is seeded and cached: one canvas per surface, ever.
 */

import { MeshStandardMaterial, type CanvasTexture } from 'three';
import { makeBumpTexture, makeCanvasTexture } from './canvas.js';
import { makeRng, valueNoise2D } from './paper.js';

const cache = new Map<string, { map: CanvasTexture; bump: CanvasTexture }>();

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Flagstones: irregular pavers in a jittered grid, mossy joints. */
export function flagstone(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('flagstone');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(311);
  const noise = valueNoise2D(rng, 16);
  const cells = 5;
  const cell = size / cells;
  type Stone = { x: number; y: number; w: number; h: number; tone: number; r: number };
  const stones: Stone[] = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const jitter = cell * 0.12;
      const x = i * cell + (rng() - 0.5) * jitter;
      const y = j * cell + (rng() - 0.5) * jitter;
      const w = cell * (0.86 + rng() * 0.1);
      const h = cell * (0.86 + rng() * 0.1);
      stones.push({ x, y, w, h, tone: rng(), r: 6 + rng() * 10 });
    }
  }
  const drawStones = (g: CanvasRenderingContext2D, height: boolean): void => {
    // Joints: dark soil with moss.
    g.fillStyle = height ? '#404040' : '#2f3324';
    g.fillRect(0, 0, size, size);
    if (!height) {
      for (let k = 0; k < 900; k++) {
        const x = rng() * size;
        const y = rng() * size;
        g.fillStyle = hsl(90 + rng() * 30, 35, 22 + rng() * 14, 0.5);
        g.fillRect(x, y, 2 + rng() * 3, 2 + rng() * 3);
      }
    }
    for (const s of stones) {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.save();
          g.translate(ox, oy);
          g.beginPath();
          g.roundRect(s.x, s.y, s.w, s.h, s.r);
          if (height) {
            g.fillStyle = `rgb(${180 + s.tone * 40}, ${180 + s.tone * 40}, ${180 + s.tone * 40})`;
          } else {
            const l = 48 + s.tone * 18;
            g.fillStyle = hsl(36 + s.tone * 14, 14 + s.tone * 10, l);
          }
          g.fill();
          if (!height) {
            // grain + a lit top edge
            g.clip();
            for (let k = 0; k < 120; k++) {
              const x = s.x + rng() * s.w;
              const y = s.y + rng() * s.h;
              const n = noise(x / 40, y / 40);
              g.fillStyle = hsl(34, 12, 40 + n * 30, 0.35);
              g.fillRect(x, y, 3 + rng() * 6, 1 + rng() * 2);
            }
            g.strokeStyle = 'rgba(255,255,255,0.18)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(s.x + 3, s.y + 2);
            g.lineTo(s.x + s.w - 3, s.y + 2);
            g.stroke();
          }
          g.restore();
        }
      }
    }
  };
  const map = makeCanvasTexture(size, (g) => drawStones(g, false));
  const bump = makeBumpTexture(size, (g) => drawStones(g, true));
  const out = { map, bump };
  cache.set('flagstone', out);
  return out;
}

/** Old brick: running bond, warm and varied, lime mortar. */
export function brick(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('brick');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(517);
  const rows = 16;
  const bh = size / rows;
  const bw = bh * 2.3;
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#4a4a4a' : '#9c9484';
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let x = -bw; x < size + bw; x += bw) {
        const t = rng();
        const dark = rng() < 0.12; // a burnt header now and then
        const hue = 8 + t * 18;
        const sat = dark ? 18 : 28 + t * 16;
        const l = dark ? 22 + t * 8 : 30 + t * 16;
        g.fillStyle = height ? `rgb(${160 + t * 60},${160 + t * 60},${160 + t * 60})` : hsl(hue, sat, l);
        const m = 2.5;
        g.fillRect(x + off + m, r * bh + m, bw - 2 * m, bh - 2 * m);
        if (!height) {
          // weathering: speckle, a soot streak, a lighter lime bloom
          for (let k = 0; k < 14; k++) {
            g.fillStyle = hsl(hue, sat - 8, l - 12 + rng() * 24, 0.45);
            g.fillRect(x + off + m + rng() * (bw - 2 * m), r * bh + m + rng() * (bh - 2 * m), 3 + rng() * 9, 1 + rng() * 3);
          }
          if (rng() < 0.25) {
            g.fillStyle = 'rgba(40,30,25,0.25)';
            g.fillRect(x + off + m, r * bh + m, bw - 2 * m, 3 + rng() * 5);
          }
          if (rng() < 0.2) {
            g.fillStyle = 'rgba(230,225,210,0.18)';
            g.fillRect(x + off + m + rng() * bw * 0.5, r * bh + m, 6 + rng() * 14, bh - 2 * m);
          }
        } else {
          // a chipped edge or two
          g.fillStyle = '#3a3a3a';
          if (rng() < 0.3) g.fillRect(x + off + m, r * bh + m + rng() * (bh - 4), 4 + rng() * 6, 2);
        }
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('brick', out);
  return out;
}

/** Lawn: dense grass strokes, two greens, a little clover. */
export function lawn(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('lawn');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(919);
  const noise = valueNoise2D(rng, 8);
  const mottle = valueNoise2D(rng, 4);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#707070' : '#3a4d26';
    g.fillRect(0, 0, size, size);
    if (!height) {
      // Big soft patches: worn, damp, sunburnt.
      for (let k = 0; k < 400; k++) {
        const x = rng() * size;
        const y = rng() * size;
        const m = mottle((x / size) * 4, (y / size) * 4);
        g.fillStyle = hsl(70 + m * 30, 30, 22 + m * 16, 0.12);
        g.beginPath();
        g.arc(x, y, 14 + rng() * 26, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let k = 0; k < 11000; k++) {
      const x = rng() * size;
      const y = rng() * size;
      const n = noise((x / size) * 8, (y / size) * 8);
      const m = mottle((x / size) * 4, (y / size) * 4);
      const l = height ? 70 + rng() * 60 : 22 + n * 14 + m * 10 + rng() * 8;
      g.strokeStyle = height ? `rgb(${l},${l},${l})` : hsl(72 + n * 24 + m * 12, 30 + rng() * 18, l);
      g.lineWidth = 1 + rng();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 6, y - 4 - rng() * 8);
      g.stroke();
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('lawn', out);
  return out;
}

/** Soil: dark crumb. */
export function soil(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('soil');
  if (hit) return hit;
  const size = 256;
  const rng = makeRng(131);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#606060' : '#2c2118';
    g.fillRect(0, 0, size, size);
    for (let k = 0; k < 4000; k++) {
      const t = rng();
      g.fillStyle = height ? `rgb(${60 + t * 140},${60 + t * 140},${60 + t * 140})` : hsl(22 + t * 14, 30, 10 + t * 16);
      g.beginPath();
      g.arc(rng() * size, rng() * size, 1 + rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('soil', out);
  return out;
}

/** Weathered planks: grain, knots, a gap between boards. */
export function planks(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('planks');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(727);
  const boards = 6;
  const bw = size / boards;
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#303030' : '#3a2c1d';
    g.fillRect(0, 0, size, size);
    for (let b = 0; b < boards; b++) {
      const t = rng();
      const l = 30 + t * 16;
      g.fillStyle = height ? `rgb(${150 + t * 60},${150 + t * 60},${150 + t * 60})` : hsl(28 + t * 8, 30, l);
      g.fillRect(b * bw + 3, 0, bw - 6, size);
      for (let k = 0; k < 90; k++) {
        const x = b * bw + 3 + rng() * (bw - 6);
        g.strokeStyle = height ? `rgba(0,0,0,${0.15 + rng() * 0.2})` : hsl(28, 30, l - 8 - rng() * 10, 0.5);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (rng() - 0.5) * 8, size * 0.33, x + (rng() - 0.5) * 8, size * 0.66, x + (rng() - 0.5) * 4, size);
        g.stroke();
      }
      if (rng() < 0.6) {
        const kx = b * bw + 8 + rng() * (bw - 16);
        const ky = rng() * size;
        g.fillStyle = height ? '#404040' : hsl(24, 40, l - 14);
        g.beginPath();
        g.ellipse(kx, ky, 4 + rng() * 4, 7 + rng() * 6, rng(), 0, Math.PI * 2);
        g.fill();
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('planks', out);
  return out;
}

/** Lichen-spotted limestone, for the wall coping and the edging. */
export function limestone(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('limestone');
  if (hit) return hit;
  const size = 256;
  const rng = makeRng(443);
  const noise = valueNoise2D(rng, 8);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise((x / size) * 8, (y / size) * 8) * 0.6 + noise((x / size) * 32, (y / size) * 32) * 0.4;
        const i = (y * size + x) * 4;
        if (height) {
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 120 + n * 100;
        } else {
          img.data[i] = 168 + n * 60;
          img.data[i + 1] = 160 + n * 55;
          img.data[i + 2] = 140 + n * 45;
        }
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    if (!height) {
      for (let k = 0; k < 60; k++) {
        g.fillStyle = hsl(70 + rng() * 30, 30, 45 + rng() * 20, 0.35);
        g.beginPath();
        g.arc(rng() * size, rng() * size, 3 + rng() * 9, 0, Math.PI * 2);
        g.fill();
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('limestone', out);
  return out;
}

export interface SurfOpts {
  repeat?: [number, number];
  roughness?: number;
  metalness?: number;
  bumpScale?: number;
  color?: number;
  envMapIntensity?: number;
}

/** A standard material wearing a painted surface (textures cloned so
 *  per-use repeats never fight). */
export function surfaced(s: { map: CanvasTexture; bump: CanvasTexture }, o: SurfOpts = {}): MeshStandardMaterial {
  const map = s.map.clone();
  const bump = s.bump.clone();
  const [rx, ry] = o.repeat ?? [1, 1];
  map.repeat.set(rx, ry);
  bump.repeat.set(rx, ry);
  map.needsUpdate = bump.needsUpdate = true;
  return new MeshStandardMaterial({
    color: o.color ?? 0xffffff,
    map,
    bumpMap: bump,
    bumpScale: o.bumpScale ?? 0.02,
    roughness: o.roughness ?? 0.92,
    metalness: o.metalness ?? 0,
    envMapIntensity: o.envMapIntensity ?? 0.5,
  });
}

/* ── indoors ─────────────────────────────────────────────────────────── */

/** Concrete floor: trowel marks, a control joint, oil and rust stains. */
export function concrete(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('concrete');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(2211);
  const noise = valueNoise2D(rng, 8);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise((x / size) * 8, (y / size) * 8) * 0.5 + noise((x / size) * 32, (y / size) * 32) * 0.3 + rng() * 0.2;
        const i = (y * size + x) * 4;
        const v = height ? 110 + n * 60 : 118 + n * 46;
        img.data[i] = v;
        img.data[i + 1] = height ? v : v - 2;
        img.data[i + 2] = height ? v : v - 8;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // The joint, a saw cut across the slab.
    g.fillStyle = height ? '#303030' : 'rgba(40,38,36,0.8)';
    g.fillRect(0, size / 2 - 3, size, 6);
    g.fillRect(size / 2 - 3, 0, 6, size);
    if (!height) {
      for (let k = 0; k < 7; k++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 20 + rng() * 60;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(20,18,16,0.55)');
        grad.addColorStop(1, 'rgba(20,18,16,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x, y, r, r * (0.6 + rng() * 0.5), rng() * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < 4; k++) {
        g.fillStyle = 'rgba(130,70,30,0.22)';
        g.beginPath();
        g.arc(rng() * size, rng() * size, 6 + rng() * 14, 0, Math.PI * 2);
        g.fill();
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('concrete', out);
  return out;
}

/** Painted breeze-block: running bond, chipped paint, a grime line. */
export function blockwall(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('blockwall');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(3311);
  const rows = 6;
  const bh = size / rows;
  const bw = bh * 2;
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#404040' : '#8d8f8a';
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let x = -bw; x < size + bw; x += bw) {
        const t = rng();
        const m = 4;
        g.fillStyle = height ? `rgb(${150 + t * 40},${150 + t * 40},${150 + t * 40})` : hsl(80, 4 + t * 4, 62 + t * 10);
        g.fillRect(x + off + m, r * bh + m, bw - 2 * m, bh - 2 * m);
        if (!height) {
          for (let k = 0; k < 40; k++) {
            g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.07})`;
            g.fillRect(x + off + m + rng() * (bw - 2 * m), r * bh + m + rng() * (bh - 2 * m), 2 + rng() * 5, 1 + rng() * 2);
          }
          if (rng() < 0.15) {
            g.fillStyle = 'rgba(96,98,92,0.7)'; // a chip down to the block
            g.beginPath();
            g.arc(x + off + m + rng() * bw * 0.8, r * bh + m + rng() * bh * 0.8, 3 + rng() * 6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('blockwall', out);
  return out;
}

/** Corrugated galvanised sheet, with rust bleeding from the fixings. */
export function corrugated(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('corrugated');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(4411);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    const ridges = 12;
    for (let x = 0; x < size; x++) {
      const t = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * ridges);
      const v = height ? 90 + t * 130 : 118 + t * 50;
      g.fillStyle = height ? `rgb(${v},${v},${v})` : `rgb(${v},${v + 3},${v + 6})`;
      g.fillRect(x, 0, 1, size);
    }
    if (!height) {
      for (let k = 0; k < 800; k++) {
        g.fillStyle = `rgba(255,255,255,${rng() * 0.08})`;
        g.fillRect(rng() * size, rng() * size, 2, 2);
      }
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(rng() * ridges) * (size / ridges) + size / ridges / 2;
        const y = rng() * size;
        g.fillStyle = 'rgba(40,40,44,0.8)';
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
        const grad = g.createLinearGradient(0, y, 0, y + 60 + rng() * 80);
        grad.addColorStop(0, 'rgba(150,70,30,0.5)');
        grad.addColorStop(1, 'rgba(150,70,30,0)');
        g.fillStyle = grad;
        g.fillRect(x - 4, y, 8, 140);
      }
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('corrugated', out);
  return out;
}

/** Pegboard with tools hung on it, painted as silhouettes with outlines
 *  chalked round them — the tidy workshop's wall. */
export function pegboard(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('pegboard');
  if (hit) return hit;
  const size = 512;
  const rng = makeRng(5511);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#808080' : '#c9b48a';
    g.fillRect(0, 0, size, size);
    // The holes.
    g.fillStyle = height ? '#303030' : '#6b5a3c';
    for (let y = 12; y < size; y += 20) for (let x = 12; x < size; x += 20) {
      g.beginPath();
      g.arc(x, y, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    if (height) return;
    const tool = (draw: () => void, x: number, y: number, rot: number): void => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      g.setLineDash([5, 4]);
      g.beginPath();
      draw();
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#2b2e33';
      g.fill();
      g.restore();
    };
    // Hammer, spanner ×2, saw, screwdrivers, pliers.
    tool(() => { g.rect(-6, -60, 12, 120); g.rect(-30, -70, 60, 22); }, 90, 140, 0.1);
    for (let i = 0; i < 2; i++) tool(() => { g.rect(-5, -50, 10, 100); g.arc(0, -56, 16, 0, Math.PI * 2); g.arc(0, 56, 14, 0, Math.PI * 2); }, 190 + i * 60, 150, -0.15 + i * 0.1);
    tool(() => { g.moveTo(-90, -20); g.lineTo(90, -20); g.lineTo(90, 0); g.lineTo(-40, 18); g.lineTo(-90, 10); g.closePath(); g.rect(-130, -30, 40, 40); }, 360, 130, 0.5);
    for (let i = 0; i < 4; i++) tool(() => { g.rect(-4, -45, 8, 60); g.rect(-9, 15, 18, 40); }, 80 + i * 40, 330, (rng() - 0.5) * 0.2);
    tool(() => { g.moveTo(-8, -50); g.lineTo(8, -50); g.lineTo(20, 20); g.lineTo(4, 60); g.lineTo(-4, 60); g.lineTo(-20, 20); g.closePath(); }, 300, 340, 0.2);
    tool(() => { g.rect(-40, -12, 80, 24); }, 420, 360, 0);
    tool(() => { g.arc(0, 0, 30, 0, Math.PI * 2); g.rect(-6, 20, 12, 60); }, 440, 240, 0);
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('pegboard', out);
  return out;
}

/** Cardboard: kraft with a tape strip and a printed label block. */
export function cardboard(): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get('cardboard');
  if (hit) return hit;
  const size = 256;
  const rng = makeRng(6611);
  const draw = (g: CanvasRenderingContext2D, height: boolean): void => {
    g.fillStyle = height ? '#707070' : '#b48e5e';
    g.fillRect(0, 0, size, size);
    for (let k = 0; k < 2000; k++) {
      g.fillStyle = height ? `rgba(0,0,0,${rng() * 0.1})` : `rgba(90,60,30,${rng() * 0.12})`;
      g.fillRect(rng() * size, rng() * size, 1 + rng() * 6, 1);
    }
    if (!height) {
      g.fillStyle = 'rgba(170,150,120,0.55)';
      g.fillRect(size * 0.44, 0, size * 0.12, size); // tape
      g.fillStyle = 'rgba(40,40,40,0.75)';
      g.fillRect(20, 30, 70, 40);
      g.fillStyle = 'rgba(40,40,40,0.55)';
      for (let i = 0; i < 4; i++) g.fillRect(20, 84 + i * 10, 30 + rng() * 50, 4);
    }
  };
  const out = { map: makeCanvasTexture(size, (g) => draw(g, false)), bump: makeBumpTexture(size, (g) => draw(g, true)) };
  cache.set('cardboard', out);
  return out;
}
