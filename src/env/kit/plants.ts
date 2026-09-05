/**
 * Plants — the growing things, built from primitives the way ff2's desert
 * builds its cacti and agave: a few hundred cheap meshes that merge into a
 * handful of draws, deterministic from a seed, sized to hide a small robot
 * under.
 */

import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './paper.js';
import { barkMat } from './skins.js';

const leafMats = new Map<number, MeshStandardMaterial>();
const foliageMats = new Map<string, MeshStandardMaterial>();

/** A foliage tint near `hex`, snapped to one of three shades so the merge
 *  can batch a whole canopy: every puff with its own material is its own
 *  draw call, and a garden of trees adds up. */
export function foliageMat(hex: number, rng: () => number): MeshStandardMaterial {
  const shade = Math.floor(rng() * 3); // dark · mid · light
  const key = `${hex}:${shade}`;
  let m = foliageMats.get(key);
  if (!m) {
    const c = new Color(hex).multiplyScalar([0.8, 1, 1.18][shade]).offsetHSL((shade - 1) * 0.012, 0, 0);
    m = new MeshStandardMaterial({ color: c, roughness: 0.92, envMapIntensity: 0.35 });
    foliageMats.set(key, m);
  }
  return m;
}

/** A leaf material, double-sided, cached per colour. */
export function leafMat(hex: number, roughness = 0.85): MeshStandardMaterial {
  let m = leafMats.get(hex);
  if (!m) {
    m = new MeshStandardMaterial({ color: hex, roughness, metalness: 0, side: DoubleSide, envMapIntensity: 0.4 });
    leafMats.set(hex, m);
  }
  return m;
}

/** Noise-displaced sphere — the bush, the canopy puff, the moss cushion. */
export function lumpGeometry(rng: () => number, detail = 2, rough = 0.18): BufferGeometry {
  // Index the icosahedron first: displacing a non-indexed one tears every
  // triangle away from its neighbours, and the smooth normals need shared
  // vertices anyway.
  const geo = mergeVertices(new IcosahedronGeometry(1, detail));
  const pos = geo.getAttribute('position');
  const seed = rng() * 100;
  const s2 = rng() * 50;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Two octaves of smooth, position-keyed wobble — no per-vertex random.
    const n1 = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 - seed) * Math.sin(z * 3.3 + seed * 0.5);
    const n2 = Math.sin(x * 7.3 + s2) * Math.sin(y * 6.1 + s2 * 0.3) * Math.cos(z * 6.7 - s2);
    const k = 1 + n1 * rough + n2 * rough * 0.35;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A round shrub, `r` across, leafy tone with a darker underside. */
export function shrub(rng: () => number, r: number, hex = 0x3f5a3a): Group {
  const g = new Group();
  const lumps = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < lumps; i++) {
    const m = new Mesh(lumpGeometry(rng, 2, 0.22), foliageMat(hex, rng));
    const s = r * (0.45 + rng() * 0.35);
    const sy = s * (0.75 + rng() * 0.3);
    m.scale.set(s, sy, s);
    // Seated: the lump's underside sits a little below the ground line.
    m.position.set((rng() - 0.5) * r * 0.6, sy * 0.82, (rng() - 0.5) * r * 0.6);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** A fern rosette: arching blades from a crown. */
export function fern(rng: () => number, size = 0.5, hex = 0x4c7a3a): Group {
  const g = new Group();
  const blades = 7 + Math.floor(rng() * 6);
  // A frond: a spine with leaflets — a zigzag outline, widest a third up.
  const shape = new Shape();
  shape.moveTo(0, 0);
  const teeth = 16;
  for (let i = 1; i <= teeth; i++) {
    const t = i / teeth;
    const w = 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.12)) + 0.008;
    shape.lineTo(w, t - 0.018);
    shape.lineTo(w * 0.78, t);
  }
  for (let i = teeth; i >= 1; i--) {
    const t = i / teeth;
    const w = 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.12)) + 0.008;
    shape.lineTo(-w * 0.78, t);
    shape.lineTo(-w, t - 0.018);
  }
  shape.closePath();
  const geo = new ShapeGeometry(shape, 2);
  const mat = leafMat(hex);
  for (let i = 0; i < blades; i++) {
    const blade = new Mesh(geo, mat);
    const len = size * (0.7 + rng() * 0.5);
    blade.scale.set(len * 1.6, len, 1);
    blade.rotation.order = 'YXZ';
    blade.rotation.y = (i / blades) * Math.PI * 2 + rng() * 0.4;
    blade.rotation.x = -(0.5 + rng() * 0.7); // arch out and over
    blade.position.y = 0.02;
    blade.castShadow = true;
    g.add(blade);
  }
  return g;
}

/** A tuft of tall grass: crossed planes with a cut-blade outline. */
export function grassTuft(rng: () => number, h = 0.5, hex = 0x6f8c3c): Group {
  const g = new Group();
  const mat = leafMat(hex, 0.95);
  const n = 7 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const bh = h * (0.6 + rng() * 0.5);
    const w = bh * 0.09;
    const p = new Mesh(new PlaneGeometry(w, bh, 1, 5), mat);
    // Taper to a point, and bow outward toward the tip.
    const pos = p.geometry.getAttribute('position');
    const bow = 0.25 + rng() * 0.35;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getY(k) / bh + 0.5; // 0 root → 1 tip
      pos.setX(k, pos.getX(k) * (1 - t * 0.9));
      pos.setZ(k, -t * t * bh * bow);
    }
    p.geometry.computeVertexNormals();
    p.position.y = bh / 2;
    p.rotation.y = (i / n) * Math.PI * 2 + rng() * 0.6;
    g.add(p);
  }
  return g;
}

/** A tree: a tapering trunk with a couple of limbs and a canopy of puffs. */
const trunkMats = new Map<number, MeshStandardMaterial>();

export function tree(rng: () => number, height = 4.5, canopyHex = 0x3b6b34, trunkHex = 0x6b5a48): Group {
  const g = new Group();
  let trunkMat = trunkMats.get(trunkHex);
  if (!trunkMat) {
    trunkMat = barkMat(trunkHex, { repeat: [2, 4] });
    trunkMats.set(trunkHex, trunkMat);
  }
  const trunkH = height * 0.48;
  const trunk = new Mesh(new CylinderGeometry(0.09, 0.19, trunkH, 10, 3), trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const limbs = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < limbs; i++) {
    const len = height * (0.28 + rng() * 0.16);
    const limb = new Mesh(new CylinderGeometry(0.035, 0.08, len, 7), trunkMat);
    limb.position.y = trunkH * (0.7 + rng() * 0.3);
    limb.rotation.order = 'YXZ';
    limb.rotation.y = (i / limbs) * Math.PI * 2 + rng();
    limb.rotation.x = -(0.55 + rng() * 0.5);
    limb.translateY(len / 2);
    limb.castShadow = true;
    g.add(limb);
  }
  const puffs = 13 + Math.floor(rng() * 5);
  const cr = height * 0.38;
  for (let i = 0; i < puffs; i++) {
    const m = new Mesh(lumpGeometry(rng, 2, 0.2), foliageMat(canopyHex, rng));
    const s = cr * (0.38 + rng() * 0.4);
    const a = rng() * Math.PI * 2;
    const rr = cr * Math.sqrt(rng()) * 1.05;
    m.position.set(Math.cos(a) * rr, trunkH + cr * 0.2 + (rng() - 0.25) * cr * 1.1, Math.sin(a) * rr);
    m.scale.set(s, s * (0.7 + rng() * 0.4), s);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** Ivy: a mat of little leaf quads climbing a wall face. Built in the
 *  wall's local frame: x across, y up, leaves at z ≈ 0 facing +z. */
export function ivy(rng: () => number, w: number, h: number, density = 900, hex = 0x2f4a2a): Group {
  const g = new Group();
  const mat = leafMat(hex, 0.8);
  const leaf = new PlaneGeometry(0.11, 0.1);
  for (let i = 0; i < density; i++) {
    // Denser low down, thinning toward the top; ragged edges.
    const x = (rng() - 0.5) * w * (0.9 + rng() * 0.2);
    const t = rng();
    const y = h * (1 - Math.pow(t, 0.55)) * (0.85 + rng() * 0.15);
    if (Math.abs(x) > (w / 2) * (0.6 + 0.4 * (1 - y / h))) continue;
    const m = new Mesh(leaf, mat);
    m.position.set(x, y, 0.02 + rng() * 0.05);
    m.rotation.set((rng() - 0.5) * 0.9, (rng() - 0.5) * 0.9, rng() * Math.PI * 2);
    const s = 0.7 + rng() * 0.7;
    m.scale.setScalar(s);
    g.add(m);
  }
  return g;
}

/** A small flower cluster: a few coloured discs on stalks. */
export function flowers(rng: () => number, hex: number, count = 5, h = 0.35): Group {
  const g = new Group();
  const stalk = leafMat(0x4c7a3a);
  const petal = new MeshStandardMaterial({ color: hex, roughness: 0.7, side: DoubleSide, emissive: hex, emissiveIntensity: 0.08 });
  for (let i = 0; i < count; i++) {
    const hh = h * (0.7 + rng() * 0.5);
    const s = new Mesh(new CylinderGeometry(0.006, 0.008, hh, 4), stalk);
    const x = (rng() - 0.5) * 0.3;
    const z = (rng() - 0.5) * 0.3;
    s.position.set(x, hh / 2, z);
    g.add(s);
    const head = new Mesh(new SphereGeometry(0.035 + rng() * 0.02, 8, 6), petal);
    head.scale.y = 0.55;
    head.position.set(x, hh, z);
    g.add(head);
  }
  return g;
}

/** A conifer-ish shrub: stacked cones. */
export function conifer(rng: () => number, h = 1.4, hex = 0x2e5533): Group {
  const g = new Group();
  const mat = new MeshStandardMaterial({ color: hex, roughness: 0.95, envMapIntensity: 0.3 });
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (h * 0.3) * (1 - t * 0.6) * (0.9 + rng() * 0.2);
    const ch = h * 0.42;
    const c = new Mesh(new ConeGeometry(r, ch, 9), mat);
    c.position.y = h * 0.2 + t * h * 0.62;
    c.rotation.y = rng();
    c.castShadow = true;
    g.add(c);
  }
  let trunkMat = trunkMats.get(0x5a4636);
  if (!trunkMat) {
    trunkMat = barkMat(0x5a4636);
    trunkMats.set(0x5a4636, trunkMat);
  }
  const trunk = new Mesh(new CylinderGeometry(0.03, 0.05, h * 0.25, 6), trunkMat);
  trunk.position.y = h * 0.12;
  g.add(trunk);
  return g;
}

/** A moss cushion on the ground. */
export function mossCushion(rng: () => number, r = 0.3, hex = 0x7a8c5a): Mesh {
  const m = new Mesh(lumpGeometry(rng, 1, 0.15), new MeshStandardMaterial({ color: hex, roughness: 1, envMapIntensity: 0.3 }));
  m.scale.set(r, r * 0.35, r);
  return m;
}

export const plantRng = makeRng;
