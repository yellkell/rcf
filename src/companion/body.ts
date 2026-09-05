/**
 * THE LITTLE GUY — FIRE FIGHT 2's blank, with legs.
 *
 * The body is ff2's mannequin verbatim (ff2/src/avatar/mannequin.ts): a
 * bare egg for a head, and ONE loft from the neck to the hip taper —
 * a stack of elliptical rings stitched into a single smooth surface with
 * seam-safe cylindrical UVs, so the paint can wrap a stripe anywhere.
 * What FF2 never had, this one does: two ARMS (shoulder, elbow, a hand)
 * and two LEGS (hip, knee, a foot), each segment its own small loft and
 * a paint surface — arms share a sheet, legs share a sheet — with the
 * joints in the same white.
 *
 * Authored at FF2's human size (hips at 0.95 m); the companion system
 * scales the root down to a thing you can pick up (COMPANION.scale).
 * Front is −z. The two eye turrets on the head track you: the chameleon.
 */

import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

export interface Ring {
  y: number;
  w: number;
  d: number;
  z?: number;
}

const SEG = 36;

/** The blank's shell — soft matte porcelain white. One instance per paint
 *  sheet: the bake writes the map per material. */
export function shellMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.6 });
}

/** Joints, hands, feet: the same white, never painted (one shared
 *  material — these are spheres with no unwrap, and a shared paint sheet
 *  would stamp a mark on every one of them at once). */
let jointMat: MeshStandardMaterial | null = null;
export function steelMat(): MeshStandardMaterial {
  if (!jointMat) jointMat = new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.6 });
  return jointMat;
}

/**
 * Stitch rings into ONE smooth closed surface (mannequin.ts's loft): the
 * seam vertex is duplicated so u runs a clean 0..1 around the body, v runs
 * by cumulative profile arc from the first ring (v = 1) to the last (v = 0).
 * Front of the body sits at u = 0.75.
 */
export function loft(rings: Ring[], mat: MeshStandardMaterial): Mesh {
  const cols = SEG + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const arc: number[] = [0];
  for (let k = 1; k < rings.length; k++) {
    const a = rings[k - 1];
    const b = rings[k];
    arc.push(arc[k - 1] + Math.hypot(b.y - a.y, (b.w + b.d - (a.w + a.d)) / 2));
  }
  const total = arc[arc.length - 1] || 1;
  rings.forEach((r, k) => {
    for (let s = 0; s < cols; s++) {
      const t = ((s % SEG) / SEG) * Math.PI * 2;
      pos.push(Math.cos(t) * r.w, r.y, Math.sin(t) * r.d + (r.z ?? 0));
      uv.push(s / SEG, 1 - arc[k] / total);
    }
  });
  for (let k = 0; k < rings.length - 1; k++) {
    const a0 = k * cols;
    const b0 = (k + 1) * cols;
    for (let s = 0; s < SEG; s++) {
      idx.push(a0 + s, b0 + s + 1, b0 + s, a0 + s, a0 + s + 1, b0 + s + 1);
    }
  }
  const top = pos.length / 3;
  pos.push(0, rings[0].y, rings[0].z ?? 0);
  uv.push(0.5, 1);
  const bottom = top + 1;
  pos.push(0, rings[rings.length - 1].y, rings[rings.length - 1].z ?? 0);
  uv.push(0.5, 0);
  for (let s = 0; s < SEG; s++) {
    idx.push(top, s, s + 1);
    const l0 = (rings.length - 1) * cols;
    idx.push(bottom, l0 + s + 1, l0 + s);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new Mesh(geo, mat);
}

function paintable(mesh: Mesh, part: string): Mesh {
  mesh.userData.paintPart = part;
  mesh.castShadow = true;
  return mesh;
}

/* ── the plan, FF2's numbers ─────────────────────────────────────────── */

/** ff2 BODY_IK.headRadius. */
const HEAD_R = 0.13;
/** The head's centre above the hips when standing (ff2 NECK_SEAT). */
const NECK_SEAT = 0.63;

/**
 * THE BODY — ff2's BODY_RINGS, hip-local (y = 0 is the pelvis centre),
 * top → down: the neck, the shoulder line, the chest, the waist pinch,
 * the hip line, then a monotonic taper to a rounded tip.
 */
const BODY_RINGS: Ring[] = [
  { y: 0.488, w: 0.048, d: 0.043, z: -0.058 },
  { y: 0.47, w: 0.058, d: 0.05, z: -0.045 },
  { y: 0.45, w: 0.08, d: 0.062, z: -0.028 },
  { y: 0.425, w: 0.165, d: 0.078, z: -0.01 },
  { y: 0.395, w: 0.252, d: 0.09 },
  { y: 0.35, w: 0.232, d: 0.098 },
  { y: 0.29, w: 0.166, d: 0.1 },
  { y: 0.23, w: 0.124, d: 0.09 },
  { y: 0.175, w: 0.094, d: 0.077 },
  { y: 0.13, w: 0.09, d: 0.074 },
  { y: 0.075, w: 0.105, d: 0.086 },
  { y: 0.02, w: 0.126, d: 0.1 },
  { y: -0.02, w: 0.132, d: 0.104 },
  // FF2's blank tapers from here to a point — a hip cut on a body with no
  // legs. With legs under it that taper hangs between them, so the body
  // ends at the hip line instead: a short rounded underside the legs hang
  // from, nothing below the hips but leg.
  { y: -0.06, w: 0.118, d: 0.094 },
  { y: -0.09, w: 0.08, d: 0.066 },
  { y: -0.105, w: 0.03, d: 0.026 },
];

/** A limb segment: a slim loft, `len` long along −y. */
function segment(len: number, r0: number, r1: number, mat: MeshStandardMaterial): Mesh {
  return loft(
    [
      { y: 0, w: r0, d: r0 },
      { y: -len * 0.3, w: r0 * 0.95, d: r0 * 0.95 },
      { y: -len * 0.8, w: r1, d: r1 },
      { y: -len, w: r1 * 0.75, d: r1 * 0.75 },
    ],
    mat,
  );
}

export const LIMB = {
  hipX: 0.105,
  hipY: -0.055,
  thigh: 0.42,
  shin: 0.43,
  footH: 0.04,
  shoulderX: 0.235,
  shoulderY: 0.385,
  upperArm: 0.29,
  forearm: 0.27,
} as const;

/** Where the hips sit above the soles when standing straight. */
export const STAND_HIP_Y = -LIMB.hipY + LIMB.thigh + LIMB.shin + LIMB.footH;

export interface Leg {
  hip: Group;
  knee: Group;
  foot: Group;
  side: 1 | -1;
}

export interface Arm {
  shoulder: Group;
  elbow: Group;
  hand: Group;
  side: 1 | -1;
}

export interface Robot {
  root: Group;
  /** The pelvis pivot: everything hangs off it. */
  body: Group;
  /** The head pivot, at the neck seat. */
  head: Group;
  legs: Leg[];
  arms: Arm[];
  shells: Mesh[];
}

/** Build the blank at the origin, facing −z, soles at y = 0 in STAND. */
export function buildRobot(): Robot {
  const root = new Group();
  root.name = 'robot';
  const shells: Mesh[] = [];

  const body = new Group();
  body.name = 'body';
  const torso = paintable(loft(BODY_RINGS, shellMat()), 'body');
  body.add(torso);
  shells.push(torso);
  root.add(body);

  // THE HEAD — a bare egg floating clear of the neck (ff2's rule: a head
  // carrying its neck drags it through the shoulders on every turn).
  const head = new Group();
  head.name = 'head';
  head.position.set(0, NECK_SEAT, -0.03);
  // THE NECK: a column from the shoulders up into the skull, leaning
  // forward with the body's neck rings. White and unpainted, like a joint.
  const neck = new Mesh(new CylinderGeometry(0.042, 0.052, 0.2, 14), steelMat());
  neck.position.set(0, 0.5, -0.045);
  neck.rotation.x = 0.16;
  body.add(neck);
  const skull = paintable(new Mesh(new SphereGeometry(HEAD_R, 28, 22), shellMat()), 'head');
  skull.scale.set(0.84, 1.08, 0.93);
  skull.position.y = HEAD_R * 0.05;
  head.add(skull);
  shells.push(skull);
  body.add(head);

  // THE ARMS.
  const arms: Arm[] = [];
  const armMat = shellMat();
  for (const side of [-1, 1] as const) {
    const shoulder = new Group();
    shoulder.position.set(side * LIMB.shoulderX, LIMB.shoulderY, 0);
    shoulder.add(new Mesh(new SphereGeometry(0.056, 12, 8), steelMat()));
    const upper = paintable(segment(LIMB.upperArm, 0.052, 0.044, armMat), 'arms');
    shoulder.add(upper);
    const elbow = new Group();
    elbow.position.y = -LIMB.upperArm;
    elbow.add(new Mesh(new SphereGeometry(0.046, 12, 8), steelMat()));
    const fore = paintable(segment(LIMB.forearm, 0.044, 0.036, armMat), 'arms');
    elbow.add(fore);
    const hand = new Group();
    hand.position.y = -LIMB.forearm;
    const fist = new Mesh(new SphereGeometry(0.05, 12, 8), steelMat());
    fist.scale.set(0.85, 1.1, 0.7);
    hand.add(fist);
    elbow.add(hand);
    shoulder.add(elbow);
    body.add(shoulder);
    shells.push(upper, fore);
    arms.push({ shoulder, elbow, hand, side });
  }

  // THE LEGS.
  const legs: Leg[] = [];
  const legMat = shellMat();
  for (const side of [-1, 1] as const) {
    const hip = new Group();
    hip.position.set(side * LIMB.hipX, LIMB.hipY, 0);
    hip.add(new Mesh(new SphereGeometry(0.07, 12, 8), steelMat()));
    const thigh = paintable(segment(LIMB.thigh, 0.072, 0.058, legMat), 'legs');
    hip.add(thigh);
    const knee = new Group();
    knee.position.y = -LIMB.thigh;
    knee.add(new Mesh(new SphereGeometry(0.06, 12, 8), steelMat()));
    const shin = paintable(segment(LIMB.shin, 0.06, 0.048, legMat), 'legs');
    knee.add(shin);
    const foot = new Group();
    foot.position.y = -LIMB.shin;
    const sole = new Mesh(new SphereGeometry(0.065, 12, 8), steelMat());
    sole.scale.set(1.0, LIMB.footH / 0.065, 1.6);
    sole.position.set(0, -LIMB.footH * 0.5, -0.04);
    foot.add(sole);
    knee.add(foot);
    hip.add(knee);
    body.add(hip);
    shells.push(thigh, shin);
    legs.push({ hip, knee, foot, side });
  }

  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  return { root, body, head, legs, arms, shells };
}
