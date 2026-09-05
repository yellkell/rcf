/**
 * THE ROBOT — the blank cuttlefish, built the way FIRE FIGHT 2 builds its
 * blank (ff2/src/avatar/mannequin.ts): lofted rings stitched into one
 * smooth indexed surface with seam-safe cylindrical UVs, so every shell is
 * a paint surface the bake can wrap a stripe around.
 *
 * The plan (front is −z, like the camera; the robot FACES you):
 *
 *   MANTLE  — the body, one loft laid along z: a rounded prow, a broad
 *             back, a taper to the tail. Paint part `body`.
 *   HEAD    — a smaller loft slung under the prow, where a cuttlefish's
 *             head pokes out of its mantle; the two EYE TURRETS sit on it
 *             and track you (the chameleon in the name). Paint part `head`.
 *   LEGS    — four, insect-jointed: hip (splay about z, swing about x),
 *             knee (bend in the splay plane), a foot pad. Shells are lofts
 *             and paint part `legs` (all four share one sheet). Joints are
 *             dark steel and never paint.
 *   FINS    — the mantle's skirt down each flank and a tail plate. Flat
 *             plates with normalised UVs, paint part `fin`.
 *
 * Every paintable mesh carries `userData.paintPart` and its own material
 * (the bake writes the map per material). Nothing here is merged: the
 * whole robot is ~20 draws and moves as a set of groups the poses drive.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from 'three';

/** One elliptical cross-section of a loft, in the loft's local frame:
 *  centred at x = 0, half-width `w`, half-depth `d`, at height `y`. */
export interface Ring {
  y: number;
  w: number;
  d: number;
  z?: number;
}

const SEG = 32;

/** The blank's shell — soft matte porcelain white. One instance per mesh:
 *  the bake owns the map, and two meshes must never share a sheet unless
 *  they are meant to (the legs share on purpose, via `shared`). */
export function shellMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.6 });
}

/** Joints, sockets, feet: dark steel, never painted. */
export function steelMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0x23262b, roughness: 0.45, metalness: 0.7, envMapIntensity: 0.8 });
}

/**
 * Stitch rings into ONE smooth closed surface (mannequin.ts's loft): the
 * seam vertex is duplicated so u runs a clean 0..1 around the body, v runs
 * by cumulative profile arc from the first ring (v = 1) to the last (v = 0).
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

/**
 * A flat plate from a 2D outline, UVs normalised to its bounding box so
 * the paint canvas covers it edge to edge. Double-sided: a fin is seen
 * from both flanks and wears the same paint on each.
 */
export function plate(points: [number, number][], mat: MeshStandardMaterial): Mesh {
  const shape = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const geo = new ShapeGeometry(shape, 6);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const uvs = geo.getAttribute('uv');
  for (let i = 0; i < uvs.count; i++) {
    uvs.setXY(i, (uvs.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (uvs.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  }
  uvs.needsUpdate = true;
  mat.side = DoubleSide;
  return new Mesh(geo, mat);
}

function paintable(mesh: Mesh, part: string): Mesh {
  mesh.userData.paintPart = part;
  mesh.castShadow = true;
  return mesh;
}

/* ── the plan, in metres ─────────────────────────────────────────────── */

/** The mantle, lofted along y then laid along z (the first ring becomes
 *  the prow at −z). Half-width w is across the body; d is its height. */
const MANTLE_RINGS: Ring[] = [
  { y: 0.2, w: 0.035, d: 0.03 }, // the prow — a rounded nose
  { y: 0.185, w: 0.07, d: 0.052 },
  { y: 0.16, w: 0.098, d: 0.07 },
  { y: 0.12, w: 0.116, d: 0.082 }, // the shoulders — widest
  { y: 0.07, w: 0.12, d: 0.086 },
  { y: 0.02, w: 0.118, d: 0.084 },
  { y: -0.03, w: 0.108, d: 0.078 },
  { y: -0.08, w: 0.09, d: 0.066 },
  { y: -0.13, w: 0.066, d: 0.05 },
  { y: -0.17, w: 0.04, d: 0.032 },
  { y: -0.2, w: 0.016, d: 0.014 }, // the tail
];

/** The head: a squat egg slung under the prow. */
const HEAD_RINGS: Ring[] = [
  { y: 0.062, w: 0.018, d: 0.016 },
  { y: 0.05, w: 0.044, d: 0.036 },
  { y: 0.03, w: 0.06, d: 0.048 },
  { y: 0.0, w: 0.064, d: 0.05 },
  { y: -0.03, w: 0.056, d: 0.044 },
  { y: -0.05, w: 0.036, d: 0.03 },
  { y: -0.062, w: 0.012, d: 0.01 },
];

/** A leg segment: a slim loft, thicker at the top, `len` long along −y. */
function legSegment(len: number, r0: number, r1: number, mat: MeshStandardMaterial): Mesh {
  return loft(
    [
      { y: 0, w: r0, d: r0 },
      { y: -len * 0.35, w: r0 * 0.92, d: r0 * 0.92 },
      { y: -len * 0.8, w: r1, d: r1 },
      { y: -len, w: r1 * 0.7, d: r1 * 0.7 },
    ],
    mat,
  );
}

export interface Leg {
  /** The hip pivot, on the mantle's underside. */
  hip: Group;
  /** The knee pivot, at the end of the upper segment. */
  knee: Group;
  /** The foot pad, at the end of the lower segment (its world position is
   *  where the foot touches down). */
  foot: Group;
  /** +1 right side, −1 left. */
  side: 1 | -1;
  /** +1 front pair, −1 rear. */
  end: 1 | -1;
  upperLen: number;
  lowerLen: number;
}

export interface Eye {
  /** The turret: yaws and pitches to track. */
  turret: Group;
}

export interface Robot {
  root: Group;
  /** The mantle's pivot: everything but the legs' reach hangs off it. */
  body: Group;
  head: Group;
  legs: Leg[];
  eyes: Eye[];
  /** The tail plate's pivot. */
  tail: Group;
  /** The two skirt fins' pivots (left, right). */
  skirts: Group[];
  /** Every paintable mesh, for the bake and the bay's raycast. */
  shells: Mesh[];
}

export const LEG = { upper: 0.11, lower: 0.115, hipX: 0.088, hipZ: 0.095, hipY: -0.045 } as const;

/** Build the blank robot at the origin, facing −z, feet at y = 0 when the
 *  STAND pose is applied. */
export function buildRobot(): Robot {
  const root = new Group();
  root.name = 'robot';
  const shells: Mesh[] = [];

  // THE MANTLE. The loft runs along y; lay it along z so ring 0 is the prow
  // at −z. After the turn, u = 0.25 is the top of the back and u = 0.75
  // the belly; the flanks are u = 0 and u = 0.5.
  const body = new Group();
  body.name = 'body';
  const mantle = paintable(loft(MANTLE_RINGS, shellMat()), 'body');
  mantle.rotation.x = -Math.PI / 2;
  body.add(mantle);
  shells.push(mantle);
  root.add(body);

  // THE HEAD, under the prow, with the eye turrets on top.
  const head = new Group();
  head.name = 'head';
  head.position.set(0, -0.02, -0.19);
  const skull = paintable(loft(HEAD_RINGS, shellMat()), 'head');
  skull.rotation.x = -Math.PI / 2;
  head.add(skull);
  shells.push(skull);
  const eyes: Eye[] = [];
  for (const side of [-1, 1] as const) {
    const turret = new Group();
    turret.position.set(side * 0.036, 0.036, 0.008);
    const socket = new Mesh(new SphereGeometry(0.02, 14, 10), steelMat());
    socket.scale.set(1, 0.9, 1);
    turret.add(socket);
    const lens = new Mesh(
      new SphereGeometry(0.012, 12, 8),
      new MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.2 }),
    );
    lens.position.set(0, 0.002, -0.014);
    turret.add(lens);
    const glint = new Mesh(new SphereGeometry(0.004, 6, 4), new MeshStandardMaterial({ color: 0x2ee2c2, emissive: 0x2ee2c2, emissiveIntensity: 1.6 }));
    glint.position.set(0, 0.004, -0.024);
    turret.add(glint);
    head.add(turret);
    eyes.push({ turret });
  }
  body.add(head);

  // THE LEGS. Hips on the underside at the four corners of the mantle.
  const legs: Leg[] = [];
  const legMat = shellMat(); // ONE material: the four legs share a sheet
  for (const end of [1, -1] as const) {
    for (const side of [-1, 1] as const) {
      const hip = new Group();
      hip.position.set(side * LEG.hipX, LEG.hipY, -end * LEG.hipZ);
      const hipBall = new Mesh(new SphereGeometry(0.02, 12, 8), steelMat());
      hip.add(hipBall);
      const upper = paintable(legSegment(LEG.upper, 0.017, 0.013, legMat), 'legs');
      hip.add(upper);
      const knee = new Group();
      knee.position.y = -LEG.upper;
      const kneeBall = new Mesh(new SphereGeometry(0.015, 12, 8), steelMat());
      knee.add(kneeBall);
      const lower = paintable(legSegment(LEG.lower, 0.013, 0.01, legMat), 'legs');
      knee.add(lower);
      const foot = new Group();
      foot.position.y = -LEG.lower;
      const pad = new Mesh(new SphereGeometry(0.014, 10, 7), steelMat());
      pad.scale.set(1.2, 0.6, 1.2);
      foot.add(pad);
      knee.add(foot);
      hip.add(knee);
      body.add(hip);
      shells.push(upper, lower);
      legs.push({ hip, knee, foot, side, end, upperLen: LEG.upper, lowerLen: LEG.lower });
    }
  }

  // THE FINS: a skirt down each flank, a plate at the tail.
  const finMat = shellMat();
  const skirts: Group[] = [];
  for (const side of [-1, 1] as const) {
    const pivot = new Group();
    pivot.position.set(side * 0.108, -0.012, 0.0);
    const fin = paintable(
      plate(
        [
          [0, -0.13],
          [0.03, -0.1],
          [0.048, -0.02],
          [0.044, 0.06],
          [0.028, 0.12],
          [0, 0.15],
        ],
        finMat,
      ),
      'fin',
    );
    // The plate is drawn in xy; lay it flat-ish along the flank (xz), tipped
    // down a touch like a cuttlefish's fin, mirrored per side.
    fin.rotation.set(Math.PI / 2, side * 0.35, 0);
    fin.scale.x = side;
    pivot.add(fin);
    body.add(pivot);
    skirts.push(pivot);
    shells.push(fin);
  }
  const tail = new Group();
  tail.position.set(0, 0.0, 0.19);
  const tailFin = paintable(
    plate(
      [
        [0, 0.02],
        [0.05, 0.005],
        [0.075, -0.03],
        [0.045, -0.02],
        [0, -0.035],
        [-0.045, -0.02],
        [-0.075, -0.03],
        [-0.05, 0.005],
      ],
      finMat,
    ),
    'fin',
  );
  tailFin.rotation.x = -Math.PI / 2 + 0.2;
  tail.add(tailFin);
  body.add(tail);
  shells.push(tailFin);

  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  return { root, body, head, legs, eyes, tail, skirts, shells };
}
