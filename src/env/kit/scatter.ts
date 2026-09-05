/**
 * Placement helpers — the `place()` closure every FF2 environment wrote for
 * itself, extracted (and a TRS builder for instanced props).
 */

import { Matrix4, Object3D, type Group } from 'three';

const dummy = new Object3D();

/** A transform matrix for an instance. */
export function trs(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number): Matrix4 {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, ry, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

export interface ScatterOpts {
  /** Half-extent across x (and z, unless halfZ is given). */
  half: number;
  halfZ?: number;
  /** Centre of the square. */
  cx?: number;
  cz?: number;
  /** Nothing lands within this radius of (cx, cz). */
  clear?: number;
  /** Nothing lands within this of another placement. */
  spacing?: number;
  /** Rejection test in world space. */
  ok?: (x: number, z: number) => boolean;
  ground: (x: number, z: number) => number;
  rng: () => number;
}

/** Drop `n` things into a square, each a fresh object from `make`. */
export function scatter(n: number, o: ScatterOpts, make: (rng: () => number, i: number) => Object3D, into: Group): void {
  const cx = o.cx ?? 0;
  const cz = o.cz ?? 0;
  const placed: [number, number][] = [];
  let tries = 0;
  for (let i = 0; i < n && tries < n * 40; ) {
    tries++;
    const x = cx + (o.rng() * 2 - 1) * o.half;
    const z = cz + (o.rng() * 2 - 1) * (o.halfZ ?? o.half);
    if (o.clear && Math.hypot(x - cx, z - cz) < o.clear) continue;
    if (o.ok && !o.ok(x, z)) continue;
    if (o.spacing && placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < o.spacing!)) continue;
    const obj = make(o.rng, i);
    obj.position.set(x, o.ground(x, z), z);
    obj.rotation.y = o.rng() * Math.PI * 2;
    into.add(obj);
    placed.push([x, z]);
    i++;
  }
}

/** Put `o` at (x, z) on the ground, yawed `ry`. */
export function put(o: Object3D, x: number, z: number, ry: number, ground: (x: number, z: number) => number, into: Object3D): Object3D {
  o.position.set(x, ground(x, z), z);
  o.rotation.y = ry;
  into.add(o);
  return o;
}
