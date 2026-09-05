/**
 * DESERT 2.0 — the material kit. The papercraft era's rule was "colour
 * on a facet"; the new rule is colour ON A SURFACE: every material here
 * carries a procedural canvas map (tint-neutral, so the caller's colour
 * still decides the hue) and a matching bump map cut from the same noise,
 * so sand ripples, rock strata, rust mottle, bark fissures and bone grain
 * catch the low light the way real surfaces do — for one texture fetch
 * apiece and zero extra draws. Textures are cached per kind and shared, so
 * the static merge (keyed on texture uuid) still batches everything that
 * wears the same skin.
 *
 * Nothing here is an image asset: it's all drawn at boot from the same
 * seeded value-noise the dunes use, so the desert stays one deterministic
 * function of its seed.
 */

import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, SpriteMaterial } from 'three';
import { makeRng, valueNoise2D } from './paper.js';

interface Skin {
  map: CanvasTexture;
  bump: CanvasTexture;
}

const cache = new Map<string, Skin>();

function wrap(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Sample position → [r, g, b, height], all 0..1. */
type Shader = (x: number, y: number, n: (fx: number, fy: number, oct?: number) => number) => [number, number, number, number];

/** Paint a tileable colour + height pair from a per-texel shader. */
function skin(key: string, size: number, seed: number, shade: Shader): Skin {
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = makeRng(seed);
  const cells = 32;
  const noiseA = valueNoise2D(rng, cells);
  const noiseB = valueNoise2D(rng, cells);
  // Tileable: the noise grid wraps at `cells`, so sampling in grid units
  // that divide `cells` repeats seamlessly across the texture edge.
  const n = (fx: number, fy: number, oct = 2): number => {
    let v = 0;
    let amp = 1;
    let sum = 0;
    for (let o = 0; o < oct; o++) {
      const s = 1 << o;
      v += (o % 2 ? noiseB : noiseA)(fx * s, fy * s) * amp;
      sum += amp;
      amp *= 0.5;
    }
    return v / sum;
  };
  const col = document.createElement('canvas');
  const hgt = document.createElement('canvas');
  col.width = col.height = hgt.width = hgt.height = size;
  const cc = col.getContext('2d')!;
  const hc = hgt.getContext('2d')!;
  const ci = cc.createImageData(size, size);
  const hi = hc.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, h] = shade(x / size, y / size, n);
      const i = (y * size + x) * 4;
      ci.data[i] = r * 255;
      ci.data[i + 1] = g * 255;
      ci.data[i + 2] = b * 255;
      ci.data[i + 3] = 255;
      const hv = h * 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv;
      hi.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  hc.putImageData(hi, 0, 0);
  const s: Skin = { map: wrap(col, true), bump: wrap(hgt, false) };
  cache.set(key, s);
  return s;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/* ── the skins ─────────────────────────────────────────────────────────── */

/** Wind-rippled sand: long low ripples across x, fine grain everywhere.
 *  Tint-neutral (the dunes' vertex colour supplies the sand tone). */
export function sandSkin(): Skin {
  return skin('sand', 256, 101, (x, y, n) => {
    const ripple = 0.5 + 0.5 * Math.sin((y + n(x * 4, y * 4) * 0.12) * Math.PI * 2 * 9);
    const grain = n(x * 32, y * 32, 3);
    const h = ripple * 0.55 + grain * 0.45;
    const l = 0.82 + (ripple - 0.5) * 0.14 + (grain - 0.5) * 0.16;
    return [l, l * 0.985, l * 0.96, h];
  });
}

/** Wind-carved rock: horizontal strata, grain, the odd darker seam. */
export function rockSkin(): Skin {
  return skin('rock', 256, 202, (x, y, n) => {
    const warp = n(x * 3, y * 3) * 0.08;
    const strata = 0.5 + 0.5 * Math.sin((y + warp) * Math.PI * 2 * 7);
    const seam = clamp01((n(x * 6, y * 12) - 0.62) * 6);
    const grain = n(x * 24, y * 24, 3);
    const h = clamp01(strata * 0.5 + grain * 0.5 - seam * 0.5);
    const l = 0.78 + (strata - 0.5) * 0.22 + (grain - 0.5) * 0.18 - seam * 0.3;
    return [l, l * 0.93, l * 0.86, h];
  });
}

/** Oxidised iron: mottled, drip-streaked, with bright blooms of rust. */
export function rustSkin(): Skin {
  return skin('rust', 256, 303, (x, y, n) => {
    const mottle = n(x * 8, y * 8, 3);
    const drip = n(x * 20, y * 3, 2); // stretched down the face
    const bloom = clamp01((n(x * 5, y * 5) - 0.58) * 5);
    const h = clamp01(mottle * 0.6 + bloom * 0.5 + (drip - 0.5) * 0.3);
    const l = 0.62 + (mottle - 0.5) * 0.3 - (drip - 0.5) * 0.25;
    return [clamp01(l + bloom * 0.35), clamp01(l * 0.9 + bloom * 0.12), clamp01(l * 0.8), h];
  });
}

/** Dead bark: deep vertical fissures, cracked plates between them. */
export function barkSkin(): Skin {
  return skin('bark', 256, 404, (x, y, n) => {
    const fissure = clamp01((n(x * 14, y * 2, 2) - 0.5) * 3);
    const plate = n(x * 10, y * 10, 3);
    const h = clamp01(0.3 + plate * 0.5 - fissure * 0.6);
    const l = 0.66 + (plate - 0.5) * 0.24 - fissure * 0.4;
    return [l, l * 0.9, l * 0.8, h];
  });
}

/** Sun-cured plank: long grain, a knot or two, the tone drifting. */
export function woodSkin(): Skin {
  return skin('wood', 256, 505, (x, y, n) => {
    const grain = 0.5 + 0.5 * Math.sin((y * 18 + n(x * 2, y * 6) * 3) * Math.PI * 2);
    const tone = n(x * 2, y * 2);
    const h = clamp01(grain * 0.35 + n(x * 20, y * 4, 2) * 0.65);
    const l = 0.74 + (tone - 0.5) * 0.2 + (grain - 0.5) * 0.12;
    return [l, l * 0.92, l * 0.82, h];
  });
}

/** Bleached bone: ivory with pores and a few fine cracks. */
export function boneSkin(): Skin {
  return skin('bone', 256, 606, (x, y, n) => {
    const pore = n(x * 28, y * 28, 3);
    const crack = clamp01((n(x * 4, y * 16, 2) - 0.66) * 8);
    const h = clamp01(0.55 + (pore - 0.5) * 0.5 - crack * 0.8);
    const l = 0.9 + (pore - 0.5) * 0.1 - crack * 0.35;
    return [l, l * 0.97, l * 0.9, h];
  });
}

/* ── materials ─────────────────────────────────────────────────────────── */

export interface SkinOpts {
  /** Texture repeats across UV space. */
  repeat?: [number, number];
  roughness?: number;
  metalness?: number;
  bumpScale?: number;
  envMapIntensity?: number;
}

/** A standard material wearing a skin: colour from `hex`, surface from the
 *  maps. Each call clones the cached textures so per-use repeats never
 *  fight (a clone shares the GPU image). */
export function skinned(s: Skin, hex: string | number, o: SkinOpts = {}): MeshStandardMaterial {
  const map = s.map.clone();
  const bump = s.bump.clone();
  const [rx, ry] = o.repeat ?? [1, 1];
  map.repeat.set(rx, ry);
  bump.repeat.set(rx, ry);
  map.needsUpdate = bump.needsUpdate = true;
  return new MeshStandardMaterial({
    color: hex,
    map,
    bumpMap: bump,
    bumpScale: o.bumpScale ?? 0.03,
    roughness: o.roughness ?? 0.9,
    metalness: o.metalness ?? 0,
    envMapIntensity: o.envMapIntensity ?? 0.45,
  });
}

export const rockMat = (hex: string | number, o: SkinOpts = {}): MeshStandardMaterial =>
  skinned(rockSkin(), hex, { roughness: 0.94, bumpScale: 0.05, ...o });
export const rustMat = (hex: string | number, o: SkinOpts = {}): MeshStandardMaterial =>
  skinned(rustSkin(), hex, { roughness: 0.68, metalness: 0.45, bumpScale: 0.02, envMapIntensity: 0.5, ...o });
export const barkMat = (hex: string | number, o: SkinOpts = {}): MeshStandardMaterial =>
  skinned(barkSkin(), hex, { roughness: 0.97, bumpScale: 0.05, ...o });
export const woodMat = (hex: string | number, o: SkinOpts = {}): MeshStandardMaterial =>
  skinned(woodSkin(), hex, { roughness: 0.92, bumpScale: 0.02, ...o });
export const boneMat = (hex: string | number, o: SkinOpts = {}): MeshStandardMaterial =>
  skinned(boneSkin(), hex, { roughness: 0.5, bumpScale: 0.015, envMapIntensity: 0.9, ...o });

/* ── soft sprites (clouds, glow) ───────────────────────────────────────── */

let softTex: CanvasTexture | null = null;

/** A soft, slightly ragged disc — the cloud puff and the fire's glow. */
export function softSprite(color: string | number, opacity = 1): SpriteMaterial {
  if (!softTex) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const rng = makeRng(707);
    const noise = valueNoise2D(rng, 8);
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        const rag = 0.86 + noise((x / size) * 6, (y / size) * 6) * 0.28;
        const a = clamp01(1 - r / rag);
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = a * a * (3 - 2 * a) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    softTex = new CanvasTexture(c);
    softTex.colorSpace = SRGBColorSpace;
  }
  return new SpriteMaterial({ map: softTex, color, transparent: true, opacity, depthWrite: false });
}
