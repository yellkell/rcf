/**
 * THE COVE — the third place.
 *
 * A rocky beach at low tide under a hazy afternoon: sand running down to
 * a slow sea, a shelf of dark rock to the east pocked with tide pools,
 * boulders everywhere, a cliff at your back, a groyne of black posts
 * marching into the water, a rowing boat pulled up on the sand, driftwood,
 * weed on the rocks, a lighthouse out on the headland. The ground is a
 * heightfield — the step lands on slopes and on top of rocks — and the
 * hiding is in the gaps: between boulders, under the boat, in a pool.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { collapseStatic } from './kit/merge.js';
import { makeRng, valueNoise2D } from './kit/paper.js';
import { grassTuft, lumpGeometry } from './kit/plants.js';
import { put, scatter, trs } from './kit/scatter.js';
import { rockMat, woodMat } from './kit/skins.js';
import { clouds, skyDome, sunDisc } from './kit/sky.js';
import { planks, surfaced } from './kit/surfaces.js';
import { buildTerrain } from './kit/terrain.js';
import { tagFloor, type Place } from './place.js';

// SLATE 29, WET SLATE 30, SANDSTONE 26, LIMESTONE 28, VERDIGRIS 34, MOSS 24,
// CHALK 35, UMBER 7, BONE WHITE 0, PEWTER 38, TERRACOTTA 32.
const COVE_PALETTE = [29, 30, 26, 28, 34, 24, 35, 7, 0, 38];

const SUN = new Vector3(0.6, 0.32, -0.55);
const SIZE = 44;
const SEA_Y = 0;

/** Where the tide pools are: (x, z, radius, floor depth). */
const POOLS: [number, number, number, number][] = [
  [6.5, -2.5, 1.3, 0.35],
  [9.2, 0.8, 1.0, 0.3],
  [5.0, 1.6, 0.8, 0.25],
  [8.4, -5.6, 1.1, 0.3],
];

export function buildCove(): Place {
  const root = new Group();
  root.name = 'cove';
  const rng = makeRng(4242);
  const noise = valueNoise2D(rng, 32);
  const noise2 = valueNoise2D(rng, 32);
  const statics = new Group();
  const stick = new Group();
  const live = new Group();
  root.add(statics, stick, live);

  /* ── the ground ──────────────────────────────────────────────────── */
  const shelf = (x: number, z: number): number => {
    // The rock shelf: rises in the east, ragged edge, flat-topped.
    const t = Math.max(0, Math.min(1, (x - 2.5 + noise(z * 0.15 + 7, 3) * 3) / 3));
    return t * t * (3 - 2 * t);
  };
  const height = (x: number, z: number): number => {
    // The beach: a gentle fall from the cliff foot (+z) to the sea (−z).
    let y = 0.75 - (11 - z) * 0.075;
    y += noise(x * 0.12 + 3, z * 0.12 + 5) * 0.35 - 0.17; // dune and hollow
    y += noise2(x * 0.5, z * 0.5) * 0.06; // the sand's own ripple
    // The shelf: a raised slab of rock with its own bumps.
    const s = shelf(x, z);
    y += s * (0.85 + noise2(x * 0.35 + 9, z * 0.35) * 0.5);
    // Pools: smooth bowls cut into the shelf.
    for (const [px, pz, r, depth] of POOLS) {
      const d = Math.hypot(x - px, z - pz) / r;
      if (d < 1.3) {
        const k = 1 - Math.max(0, Math.min(1, (d - 0.3) / 1.0));
        y -= depth * k * k * (3 - 2 * k) * 1.4 + 0.1 * (d < 1 ? 1 : 0) * (1 - d);
      }
    }
    // The cliff foot: the ground climbs steeply past z = 11 and levels
    // onto the plateau behind the cliff.
    if (z > 10.5) y += Math.min(6.4, (z - 10.5) * (z - 10.5) * 0.4);
    return y;
  };
  const sand = new Color(0xd6c7a8);
  const wetSand = new Color(0xb09a78);
  const rock = new Color(0x4a4e52);
  const wetRock = new Color(0x2f3a44);
  const turf = new Color(0x6f8a44);
  const scratch = new Color();
  const tmp = new Color();
  const ground = buildTerrain(
    {
      size: SIZE,
      segments: 150,
      height,
      colour: (x, z, y, out) => {
        const s = shelf(x, z);
        const wet = Math.max(0, Math.min(1, 1 - (y - SEA_Y) / 0.5));
        if (z > 13.5) {
          // The plateau: turf.
          out.copy(turf).offsetHSL(0, 0, (noise2(x * 0.5, z * 0.5) - 0.5) * 0.08);
          return;
        }
        out.copy(sand).lerp(wetSand, wet * 0.8);
        out.offsetHSL(0, 0, (noise2(x * 0.9 + 3, z * 0.9) - 0.5) * 0.05);
        tmp.copy(rock).lerp(wetRock, wet);
        tmp.offsetHSL(0, 0, (noise2(x * 0.8, z * 0.8) - 0.5) * 0.12);
        out.lerp(tmp, s);
      },
    },
    scratch,
  );
  ground.name = 'ground';
  root.add(tagFloor(ground));
  const floors: Object3D[] = [ground];
  const groundAt = (x: number, z: number): number => height(x, z);

  /* ── the sea ─────────────────────────────────────────────────────── */
  const sea = new Mesh(
    new PlaneGeometry(400, 400, 1, 1),
    new MeshStandardMaterial({ color: 0x2a5a66, roughness: 0.12, metalness: 0.25, envMapIntensity: 1.8, transparent: true, opacity: 0.9 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  sea.name = 'live-sea';
  live.add(sea);
  // Wet shine at the waterline: a translucent skirt just above the sea.
  const foamMat = new MeshStandardMaterial({ color: 0xe8f0ee, roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const x = -22 + i * 1.75 + (rng() - 0.5);
    // Find where the beach meets the sea for this x.
    let z = -14;
    for (let zz = 8; zz > -20; zz -= 0.2) {
      if (height(x, zz) < SEA_Y + 0.02) {
        z = zz;
        break;
      }
    }
    const f = new Mesh(lumpGeometry(rng, 1, 0.3), foamMat);
    f.scale.set(1.1 + rng() * 0.8, 0.03, 0.35 + rng() * 0.3);
    f.position.set(x, SEA_Y + 0.02, z + 0.2);
    statics.add(f);
  }

  /* ── sky + light ─────────────────────────────────────────────────── */
  const sky = new Color(0xcfdde6);
  root.add(skyDome({ zenith: 0x7aa6cf, horizon: 0xdbe6ec, glow: 0xffe6c4, ground: 0x6b7a80 }, SUN));
  root.add(sunDisc(SUN, 0xfff4dc, 260, 10));
  root.add(clouds(14, 77, 0xfdfbf8, 30, 90, 150, 230));
  const sun = new DirectionalLight(0xffe9cc, 3.0);
  sun.position.copy(SUN).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const cam = sun.shadow.camera;
  cam.near = 10;
  cam.far = 90;
  cam.left = cam.bottom = -16;
  cam.right = cam.top = 16;
  cam.updateProjectionMatrix();
  root.add(sun, sun.target);
  root.add(new HemisphereLight(0xcfe0ec, 0x6b6a5c, 0.5));

  /* ── the cliff, the headland, the lighthouse ─────────────────────── */
  {
    const cliffMat = rockMat(0xa39f97, { repeat: [7, 4], roughness: 0.95, bumpScale: 0.05 });
    for (let i = 0; i < 16; i++) {
      const x = -24 + i * 3.2 + (rng() - 0.5) * 1.5;
      const m = new Mesh(lumpGeometry(rng, 2, 0.28), cliffMat);
      const sx = 3.0 + rng() * 2.2;
      const sy = 4.5 + rng() * 3;
      m.scale.set(sx, sy, 2.6 + rng() * 1.6);
      m.position.set(x, sy * 0.5 + 0.8, 13.6 + rng() * 2);
      m.rotation.y = rng() * 6;
      m.castShadow = m.receiveShadow = true;
      stick.add(m);
    }
    // Grass along the plateau's lip, over the cliff.
    for (let i = 0; i < 40; i++) {
      const gx = -21 + rng() * 42;
      const gz = 15.2 + rng() * 4;
      const g = grassTuft(rng, 0.6 + rng() * 0.5, 0x8a9a52);
      g.position.set(gx, groundAt(gx, gz), gz);
      statics.add(g);
    }
    // The headland to the west, and the lighthouse on it.
    const headMat = rockMat(0x5e5a54, { repeat: [4, 2] });
    for (let i = 0; i < 6; i++) {
      const m = new Mesh(lumpGeometry(rng, 1, 0.22), headMat);
      m.scale.set(9 + rng() * 6, 4 + rng() * 3, 8 + rng() * 5);
      m.position.set(-38 + rng() * 10, 0.5, -8 - i * 5 + rng() * 3);
      statics.add(m);
    }
    const lhMat = new MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.7 });
    const lh = new Mesh(new CylinderGeometry(0.9, 1.3, 9, 14), lhMat);
    lh.position.set(-36, 8, -22);
    statics.add(lh);
    const band = new Mesh(new CylinderGeometry(1.02, 1.08, 1.6, 14), new MeshStandardMaterial({ color: 0xc02a2a, roughness: 0.7 }));
    band.position.set(-36, 9.4, -22);
    statics.add(band);
    const lantern = new Mesh(new CylinderGeometry(0.8, 0.8, 1.4, 12), new MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.8, roughness: 0.3 }));
    lantern.position.set(-36, 13.2, -22);
    statics.add(lantern);
    const cap = new Mesh(new CylinderGeometry(0.2, 1.0, 0.9, 12), new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6 }));
    cap.position.set(-36, 14.3, -22);
    statics.add(cap);
  }

  /* ── boulders (instanced) ────────────────────────────────────────── */
  {
    const boulderGeo = lumpGeometry(rng, 2, 0.3);
    const count = 90;
    const mat = rockMat(0x9a9690, { roughness: 0.92, bumpScale: 0.04 });
    const inst = new InstancedMesh(boulderGeo, mat, count);
    inst.castShadow = inst.receiveShadow = true;
    const tint = new Color();
    for (let i = 0; i < count; i++) {
      // Thickest along the shelf and the cliff foot, a few on the sand.
      const onShelf = rng() < 0.6;
      const x = onShelf ? 2 + rng() * 12 : -16 + rng() * 22;
      const z = onShelf ? -10 + rng() * 14 : rng() < 0.5 ? 8 + rng() * 3.5 : -10 + rng() * 18;
      if (POOLS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + 0.4)) continue;
      const s = 0.25 + rng() * rng() * 1.3;
      inst.setMatrixAt(i, trs(x, groundAt(x, z) - s * 0.35, z, s * (0.8 + rng() * 0.5), s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.5), rng() * 6));
      tint.setHSL(0.09 + rng() * 0.05, 0.03 + rng() * 0.05, 0.3 + rng() * 0.3);
      inst.setColorAt(i, tint);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    stick.add(inst);
  }

  /* ── tide pools: water and weed ──────────────────────────────────── */
  {
    const poolMat = new MeshStandardMaterial({ color: 0x2f5e5e, roughness: 0.05, metalness: 0.3, envMapIntensity: 2.0, transparent: true, opacity: 0.85 });
    for (const [x, z, r, depth] of POOLS) {
      const w = new Mesh(new CircleGeometry(r * 0.95, 28), poolMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(x, groundAt(x, z) + depth * 0.75, z);
      w.name = 'live-pool';
      live.add(w);
      // Weed around the lip, a limpet or two.
      for (let i = 0; i < 6; i++) {
        const a = rng() * Math.PI * 2;
        const rr = r * (0.85 + rng() * 0.4);
        const wx = x + Math.cos(a) * rr;
        const wz = z + Math.sin(a) * rr;
        const weed = new Mesh(lumpGeometry(rng, 1, 0.35), new MeshStandardMaterial({ color: [0x3a4a2a, 0x5a5a28, 0x2a3a2a][i % 3], roughness: 0.6, envMapIntensity: 0.6 }));
        weed.scale.set(0.2 + rng() * 0.25, 0.05 + rng() * 0.04, 0.15 + rng() * 0.2);
        weed.position.set(wx, groundAt(wx, wz) + 0.02, wz);
        weed.rotation.y = rng() * 6;
        statics.add(weed);
      }
    }
    // Weed on the shelf generally, and a few on boulders.
    scatter(
      40,
      { half: 6, halfZ: 7, cx: 8, cz: -3, ground: groundAt, rng, ok: (x, z) => shelf(x, z) > 0.5 && !POOLS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r) },
      (r) => {
        const weed = new Mesh(lumpGeometry(r, 1, 0.35), new MeshStandardMaterial({ color: r() < 0.5 ? 0x3d4a2c : 0x5c5a2c, roughness: 0.55, envMapIntensity: 0.6 }));
        weed.scale.set(0.25 + r() * 0.3, 0.05, 0.2 + r() * 0.25);
        return weed;
      },
      statics,
    );
  }

  /* ── the groyne ──────────────────────────────────────────────────── */
  {
    const post = woodMat(0x2c2a26, { roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const z = 4 - i * 1.6;
      const x = -6.5 + (rng() - 0.5) * 0.1;
      const h = 1.5 - i * 0.05;
      const p = new Mesh(new CylinderGeometry(0.16, 0.18, h, 10), post);
      const gy = Math.max(groundAt(x, z), SEA_Y - 0.6);
      p.position.set(x, gy + h / 2 - 0.15, z);
      p.rotation.z = (rng() - 0.5) * 0.08;
      p.castShadow = true;
      stick.add(p);
    }
    const rail = new Mesh(new BoxGeometry(0.12, 0.25, 12 * 1.6), post);
    rail.position.set(-6.5, groundAt(-6.5, -5) + 1.1, -4.8);
    rail.rotation.x = 0.045;
    stick.add(rail);
  }

  /* ── the boat, driftwood, a lobster pot ──────────────────────────── */
  {
    const boat = new Group();
    const shape = new Shape();
    shape.moveTo(-1.6, 0);
    shape.quadraticCurveTo(-0.9, 0.62, 0.9, 0.55);
    shape.quadraticCurveTo(1.35, 0.5, 1.5, 0.12);
    shape.lineTo(1.5, -0.12);
    shape.quadraticCurveTo(1.35, -0.5, 0.9, -0.55);
    shape.quadraticCurveTo(-0.9, -0.62, -1.6, 0);
    const hullMat = surfaced(planks(), { repeat: [3, 0.5], roughness: 0.8, color: 0x6f8fb0 });
    const hull = new Mesh(new ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.04, bevelSegments: 2 }), hullMat);
    hull.rotation.x = -Math.PI / 2;
    hull.position.y = 0.0;
    hull.castShadow = hull.receiveShadow = true;
    boat.add(hull);
    const inner = new Mesh(new ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false }), new MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9 }));
    inner.scale.set(0.86, 0.82, 1);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.2;
    boat.add(inner);
    const seatMat = woodMat(0xc9b48a);
    for (const x of [-0.6, 0.5]) {
      const thwart = new Mesh(new BoxGeometry(0.18, 0.04, 1.0), seatMat);
      thwart.position.set(x, 0.42, 0);
      boat.add(thwart);
    }
    const oar = new Mesh(new CylinderGeometry(0.02, 0.025, 2.2, 6), seatMat);
    oar.rotation.set(0, 0, Math.PI / 2 - 0.15);
    oar.position.set(0.1, 0.5, 0.1);
    boat.add(oar);
    const blade = new Mesh(new BoxGeometry(0.4, 0.02, 0.14), seatMat);
    blade.position.set(-1.05, 0.65, 0.1);
    boat.add(blade);
    boat.rotation.z = 0.12; // heeled over on the sand
    put(boat, -3.2, 5.5, 0.6, (x, z) => groundAt(x, z) + 0.12, stick);

    // Driftwood: a few bleached logs, and a big root stump.
    const drift = new MeshStandardMaterial({ color: 0xb8ad98, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const x = -14 + rng() * 18;
      const z = 3 + rng() * 5;
      const len = 1 + rng() * 1.6;
      const log = new Mesh(new CylinderGeometry(0.08 + rng() * 0.08, 0.05 + rng() * 0.05, len, 8), drift);
      log.rotation.set(Math.PI / 2 + (rng() - 0.5) * 0.2, rng() * 6, 0);
      log.position.set(x, groundAt(x, z) + 0.08, z);
      log.castShadow = true;
      stick.add(log);
    }
    const stump = new Mesh(lumpGeometry(rng, 2, 0.4), drift);
    stump.scale.set(0.9, 0.6, 0.8);
    stump.position.set(-9, groundAt(-9, 7.5) + 0.3, 7.5);
    stump.castShadow = true;
    stick.add(stump);
    for (let i = 0; i < 5; i++) {
      const rootB = new Mesh(new CylinderGeometry(0.03, 0.09, 1.2, 6), drift);
      const a = rng() * Math.PI * 2;
      rootB.position.set(-9 + Math.cos(a) * 0.9, groundAt(-9, 7.5) + 0.35, 7.5 + Math.sin(a) * 0.8);
      rootB.rotation.set((rng() - 0.5) * 2, a, Math.PI / 2 + (rng() - 0.5));
      stick.add(rootB);
    }

    // A lobster pot and a coil of rope by the boat.
    const potMat = new MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9, wireframe: true });
    const pot = new Mesh(new CylinderGeometry(0.35, 0.4, 0.45, 10, 3), potMat);
    pot.position.set(-1.6, groundAt(-1.6, 6.2) + 0.23, 6.2);
    stick.add(pot);
    const potFrame = new Mesh(new CylinderGeometry(0.35, 0.4, 0.45, 10, 1, true), new MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.9, transparent: true, opacity: 0.35, side: 2 }));
    potFrame.position.copy(pot.position);
    stick.add(potFrame);
    const rope = new Mesh(new CylinderGeometry(0.28, 0.28, 0.08, 16), new MeshStandardMaterial({ color: 0x3f7fbf, roughness: 0.9 }));
    rope.position.set(-2.4, groundAt(-2.4, 6.6) + 0.04, 6.6);
    stick.add(rope);
    // Buoys: two bright floats on the sand.
    for (const [x, z, hex] of [
      [-0.6, 7.0, 0xff5a1f],
      [1.4, 6.4, 0xffe94a],
    ] as [number, number, number][]) {
      const b = new Mesh(new SphereGeometry(0.22, 12, 10), new MeshStandardMaterial({ color: hex, roughness: 0.5 }));
      b.position.set(x, groundAt(x, z) + 0.18, z);
      b.castShadow = true;
      stick.add(b);
    }
  }

  // Marram grass in the dunes at the cliff foot.
  scatter(36, { half: 18, halfZ: 1.8, cz: 9.6, ground: groundAt, rng, spacing: 0.5 }, (r) => grassTuft(r, 0.5 + r() * 0.4, 0x9aa66a), statics);

  /* ── the merge ───────────────────────────────────────────────────── */
  const keep = (o: Object3D): boolean => o.name.startsWith('live-') || (o as Mesh).userData?.walkable === true || (o as InstancedMesh).isInstancedMesh === true;
  collapseStatic(statics, keep);
  collapseStatic(stick, keep);
  const stickables: Object3D[] = [];
  stick.traverse((o) => {
    if ((o as Mesh).isMesh) stickables.push(o);
  });

  let t = 0;
  return {
    id: 'cove',
    name: 'The Cove',
    root,
    floors,
    blockers: [], // nothing here blocks a hop but the ground itself
    stickables: [...stickables, ground],
    spawn: { x: -1.5, z: 3.5, yaw: 0.2 },
    palette: COVE_PALETTE,
    sky,
    fog: [30, 260],
    update: (delta) => {
      t += delta;
      sea.position.y = SEA_Y + Math.sin(t * 0.5) * 0.04;
      (sea.material as MeshStandardMaterial).roughness = 0.12 + 0.04 * Math.sin(t * 0.9);
    },
  };
}
