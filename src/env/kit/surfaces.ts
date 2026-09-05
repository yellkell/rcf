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
