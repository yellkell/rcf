/**
 * A PLACE — what every environment hands the game (FOUNDATION.md pillar 1).
 *
 * The environments are the point of this project, so the contract they
 * meet is deliberately small: a root to show, the surfaces you can stand
 * on, the surfaces a hop may not pass through, the surfaces the companion
 * can cling to, where you start, which colours the place is painted in,
 * and a breath per frame if anything in it moves. Every system reads the
 * place through `currentPlace()`; nothing reaches into a place's geometry.
 *
 * FLOORS are raycast targets: the teleport arc lands on the first floor
 * mesh it meets, at whatever height that mesh has there — steps, rocks,
 * table tops and mezzanines are floors the same way the ground is. A
 * floor mesh needs nothing but `userData.walkable = true` (tagFloor).
 * BLOCKERS are the line-of-hop test: a wall between your head and the
 * landing refuses the step. STICKABLES are what the companion clings to.
 */

import type { Color, Group, Object3D } from 'three';

export interface Spawn {
  x: number;
  z: number;
  /** Facing, three.js convention: yaw 0 looks down −z. */
  yaw: number;
  y?: number;
}

export interface Place {
  id: string;
  name: string;
  root: Group;
  floors: Object3D[];
  blockers: Object3D[];
  stickables: Object3D[];
  spawn: Spawn;
  /** Indices into PAINT.colours — the tones this place is painted in. */
  palette: number[];
  sky: Color;
  /** Anything that breathes: leaves, water, a flag. Cheap, please. */
  update?(delta: number, time: number): void;
  dispose?(): void;
}

let place: Place | null = null;
const listeners = new Set<(p: Place | null) => void>();

export function currentPlace(): Place | null {
  return place;
}

export function setPlace(next: Place | null): void {
  if (next === place) return;
  place = next;
  for (const l of listeners) l(next);
}

export function onPlaceChange(l: (p: Place | null) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Mark a mesh walkable (and a raycast target for the arc). */
export function tagFloor<T extends Object3D>(o: T): T {
  o.userData.walkable = true;
  return o;
}
