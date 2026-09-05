/**
 * THE WALLED GARDEN — the first place.
 *
 * A kitchen garden behind old brick walls on a late summer afternoon: a
 * flagstone path around a lawn, three raised beds, a big tree in the
 * corner, a lean-to greenhouse against the north wall, a potting bench
 * under it with pots stacked and strewn, a small pond with a stone edge,
 * a bench, a log pile, a wheelbarrow, ivy up the walls. The sun is low
 * from the west so everything throws a long shadow to hide in.
 *
 * Built the FF2 way: every surface painted onto a canvas, every prop a
 * handful of primitives, the whole lot merged into a few dozen draws.
 * The palette it publishes is what it is painted in — a robot in MOSS,
 * BARK and TERRACOTTA belongs here.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { collapseStatic } from './kit/merge.js';
import { makeRng } from './kit/paper.js';
import { conifer, fern, flowers, grassTuft, ivy, lumpGeometry, mossCushion, shrub, tree, grassTuft as tuft } from './kit/plants.js';
import { put, scatter } from './kit/scatter.js';
import { rockMat, woodMat } from './kit/skins.js';
import { clouds, skyDome, sunDisc } from './kit/sky.js';
import { brick, flagstone, lawn, limestone, planks, soil, surfaced } from './kit/surfaces.js';
import { tagFloor, type Place } from './place.js';

// Palette indices (config PAINT.colours): MOSS 24, FERN 25, SANDSTONE 26,
// BARK 27, LIMESTONE 28, SLATE 29, TERRACOTTA 32, VERDIGRIS 34, HEDGE 36,
// BRICK 37.
const GARDEN_PALETTE = [24, 25, 36, 27, 32, 37, 28, 26, 34, 5];

const W = 14; // the garden is W × D inside the walls
const D = 12;
const WALL_H = 2.5;
const SUN = new Vector3(-0.5, 0.36, 0.5); // low, from the south-west: long shadows sweep north-east

const flat = (): number => 0;

export function buildGarden(): Place {
  const root = new Group();
  root.name = 'garden';
  const rng = makeRng(2024);
  const statics = new Group(); // merged at the end
  const stick = new Group(); // walls + big props: blockers and stickables
  const live = new Group(); // things that breathe
  root.add(statics, stick, live);

  /* ── sky + light ─────────────────────────────────────────────────── */
  const sky = new Color(0xc9dcea);
  root.add(skyDome({ zenith: 0x5f8fc4, horizon: 0xd9e4ec, glow: 0xffd9a8, ground: 0x3a4a2e }, SUN));
  root.add(sunDisc(SUN, 0xfff0cf, 260, 9));
  root.add(clouds(9, 41, 0xfff8f0));

  const sun = new DirectionalLight(0xffe2b8, 3.2);
  sun.position.copy(SUN).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  const cam = sun.shadow.camera;
  cam.near = 5;
  cam.far = 70;
  cam.left = cam.bottom = -11;
  cam.right = cam.top = 11;
  cam.updateProjectionMatrix();
  root.add(sun, sun.target);
  const hemi = new HemisphereLight(0xbcd3ea, 0x4a5a34, 0.42);
  root.add(hemi);

  /* ── the ground ──────────────────────────────────────────────────── */
  // Lawn in the middle, a flagstone path all round it, soil under the beds.
  const ground = new Group();
  const pathMat = surfaced(flagstone(), { repeat: [W / 2.2, D / 2.2], roughness: 0.95, bumpScale: 0.03, color: 0xd8d2c8 });
  const path = new Mesh(new PlaneGeometry(W, D), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.receiveShadow = true;
  ground.add(tagFloor(path));
  const lawnMat = surfaced(lawn(), { repeat: [5, 4], roughness: 1, bumpScale: 0.015, color: 0xc4ccb0 });
  const grass = new Mesh(new PlaneGeometry(7.5, 5.6), lawnMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0.4, 0.012, 0.6);
  grass.receiveShadow = true;
  ground.add(tagFloor(grass));
  // Beyond the walls: a field, so the gate does not open onto nothing.
  const field = new Mesh(new PlaneGeometry(220, 220), new MeshStandardMaterial({ color: 0x66803f, roughness: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.02;
  ground.add(field);
  root.add(ground);

  /* ── the walls ───────────────────────────────────────────────────── */
  const brickMat = surfaced(brick(), { repeat: [11.5, 2.1], roughness: 0.92, bumpScale: 0.025 });
  const copingMat = surfaced(limestone(), { repeat: [10, 1], roughness: 0.8, bumpScale: 0.02, color: 0xd6ccb4 });
  const wallSeg = (len: number, x: number, z: number, ry: number, gate = false): void => {
    const g = new Group();
    if (gate) {
      // Two piers either side of an arched opening.
      const half = (len - 1.6) / 2;
      for (const s of [-1, 1]) {
        const seg = new Mesh(new BoxGeometry(half, WALL_H, 0.36), brickMat);
        seg.position.set(s * (0.8 + half / 2), WALL_H / 2, 0);
        seg.castShadow = seg.receiveShadow = true;
        g.add(seg);
        const pier = new Mesh(new BoxGeometry(0.5, WALL_H + 0.3, 0.5), copingMat);
        pier.position.set(s * 0.95, (WALL_H + 0.3) / 2, 0);
        pier.castShadow = true;
        g.add(pier);
        const ball = new Mesh(new SphereGeometry(0.2, 12, 10), copingMat);
        ball.position.set(s * 0.95, WALL_H + 0.5, 0);
        g.add(ball);
      }
      // A wrought gate hung on the right pier, standing half open inward.
      const iron = new MeshStandardMaterial({ color: 0x1d2024, roughness: 0.55, metalness: 0.8 });
      const gateG = new Group();
      for (let i = 0; i <= 7; i++) {
        const bar = new Mesh(new CylinderGeometry(0.014, 0.014, 1.9, 6), iron);
        bar.position.set(-i * 0.19, 0.95, 0);
        gateG.add(bar);
        if (i % 2 === 0) {
          const tip = new Mesh(new SphereGeometry(0.025, 6, 5), iron);
          tip.position.set(-i * 0.19, 1.92, 0);
          gateG.add(tip);
        }
      }
      for (const y of [0.25, 1.05, 1.7]) {
        const rail = new Mesh(new BoxGeometry(1.4, 0.035, 0.035), iron);
        rail.position.set(-0.665, y, 0);
        gateG.add(rail);
      }
      gateG.position.set(0.66, 0, 0);
      gateG.rotation.y = -1.15;
      g.add(gateG);
    } else {
      const seg = new Mesh(new BoxGeometry(len, WALL_H, 0.36), brickMat);
      seg.position.y = WALL_H / 2;
      seg.castShadow = seg.receiveShadow = true;
      g.add(seg);
      const cope = new Mesh(new BoxGeometry(len + 0.08, 0.12, 0.5), copingMat);
      cope.position.y = WALL_H + 0.06;
      cope.castShadow = true;
      g.add(cope);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    stick.add(g);
  };
  wallSeg(W + 0.36, 0, -D / 2, 0); // north
  wallSeg(W + 0.36, 0, D / 2, 0, true); // south, with the gate
  wallSeg(D, -W / 2, 0, Math.PI / 2); // west
  wallSeg(D, W / 2, 0, Math.PI / 2); // east

  // Ivy: a wide mat on the east wall, a narrower climb by the gate.
  const ivyE = ivy(rng, 7, 2.4, 1100);
  ivyE.position.set(W / 2 - 0.19, 0, 1.2);
  ivyE.rotation.y = -Math.PI / 2;
  statics.add(ivyE);
  const ivyN = ivy(rng, 3.5, 2.3, 600, 0x35552f);
  ivyN.position.set(-4.6, 0, -D / 2 + 0.19);
  statics.add(ivyN);

  /* ── beyond the walls: hedgerows, a few tall trees, low hills ────── */
  {
    const far = new Group();
    const hillMat = new MeshStandardMaterial({ color: 0x5d7a3e, roughness: 1, envMapIntensity: 0.2 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.5;
      const rr = 55 + rng() * 40;
      const hill = new Mesh(lumpGeometry(rng, 1, 0.12), hillMat);
      const sx = 30 + rng() * 40;
      hill.scale.set(sx, 6 + rng() * 9, sx * (0.6 + rng() * 0.5));
      hill.position.set(Math.cos(a) * rr, -2.5, Math.sin(a) * rr);
      hill.rotation.y = rng() * 6;
      far.add(hill);
    }
    const hedgeMat = new MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1, envMapIntensity: 0.2 });
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rng() * 0.12;
      const rr = 14 + rng() * 9;
      const lump = new Mesh(lumpGeometry(rng, 1, 0.2), hedgeMat);
      const sx = 2.2 + rng() * 2.6;
      lump.scale.set(sx, 1.4 + rng() * 1.6, sx);
      lump.position.set(Math.cos(a) * rr, 0.2, Math.sin(a) * rr);
      far.add(lump);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng();
      const rr = 12 + rng() * 10;
      put(tree(rng, 6 + rng() * 4, i % 2 ? 0x35602f : 0x4a7a38), Math.cos(a) * rr, Math.sin(a) * rr, rng() * 6, flat, far);
    }
    statics.add(far);
  }

  /* ── the raised beds ─────────────────────────────────────────────── */
  const edgeMat = surfaced(limestone(), { repeat: [4, 1], roughness: 0.85, color: 0xcfc4ac });
  const soilMat = surfaced(soil(), { repeat: [3, 2], roughness: 1 });
  const bed = (x: number, z: number, w: number, d: number, ry: number, fill: (into: Group, rng: () => number) => void): void => {
    const g = new Group();
    const h = 0.42;
    for (const [dx, dz, len, rot] of [
      [0, -d / 2, w, 0],
      [0, d / 2, w, 0],
      [-w / 2, 0, d, Math.PI / 2],
      [w / 2, 0, d, Math.PI / 2],
    ] as [number, number, number, number][]) {
      const side = new Mesh(new BoxGeometry(len + 0.16, h, 0.16), edgeMat);
      side.position.set(dx, h / 2, dz);
      side.rotation.y = rot;
      side.castShadow = side.receiveShadow = true;
      g.add(side);
    }
    const earth = new Mesh(new BoxGeometry(w, 0.06, d), soilMat);
    earth.position.y = h - 0.08;
    earth.receiveShadow = true;
    g.add(earth);
    const plants = new Group();
    plants.position.y = h - 0.05;
    fill(plants, rng);
    g.add(plants);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    stick.add(g);
  };
  // Bed 1: ferns and hostas under the tree's side.
  bed(-4.6, 2.2, 2.6, 1.4, 0, (into, r) => {
    scatter(7, { half: 1.05, halfZ: 0.45, ground: flat, rng: r, spacing: 0.4 }, (rr) => fern(rr, 0.45 + rr() * 0.2, 0x4c7a3a), into);
    scatter(4, { half: 1.0, halfZ: 0.4, ground: flat, rng: r, spacing: 0.3 }, (rr) => shrub(rr, 0.35, 0x5a7d47), into);
  });
  // Bed 2: lavender-ish mounds and tall grasses.
  bed(4.6, 2.4, 2.6, 1.4, 0, (into, r) => {
    scatter(6, { half: 1.05, halfZ: 0.45, ground: flat, rng: r, spacing: 0.4 }, (rr) => shrub(rr, 0.4, 0x6f7d5a), into);
    scatter(8, { half: 1.1, halfZ: 0.5, ground: flat, rng: r, spacing: 0.25 }, (rr) => grassTuft(rr, 0.55 + rr() * 0.3, 0x7a8c46), into);
    scatter(5, { half: 1.0, halfZ: 0.45, ground: flat, rng: r }, (rr) => flowers(rr, 0xb06bff, 6, 0.4), into);
  });
  // Bed 3: the vegetable bed along the north path — rows of leaf.
  bed(1.2, -4.0, 4.2, 1.3, 0, (into, r) => {
    for (let i = 0; i < 9; i++) {
      const g = shrub(r, 0.3, i % 2 ? 0x4f7a3f : 0x7fa35a);
      g.position.set(-1.8 + i * 0.45, 0, (i % 2) * 0.5 - 0.25);
      into.add(g);
    }
    scatter(4, { half: 1.7, halfZ: 0.4, ground: flat, rng: r }, (rr) => flowers(rr, 0xffb02e, 5, 0.45), into);
  });

  /* ── the tree, the conifers, the shrubbery ───────────────────────── */
  const bigTree = tree(rng, 5.6, 0x3b6b34, 0x6b5a48);
  put(bigTree, -5.2, -3.6, 0.4, flat, stick);
  for (const [x, z, h] of [
    [5.8, -4.6, 1.8],
    [5.2, -3.4, 1.3],
    [-5.9, 4.8, 1.5],
  ]) {
    put(conifer(rng, h), x, z, rng() * 6, flat, stick);
  }
  // Shrubs along the west wall — the hedge you crouch behind.
  for (let i = 0; i < 5; i++) {
    put(shrub(rng, 0.8 + rng() * 0.3, 0x33422e), -W / 2 + 0.7, -2.4 + i * 1.15, rng() * 6, flat, stick);
  }
  // Odd ferns and moss where the path meets the walls.
  scatter(10, { half: 6.4, cz: 0, ground: flat, rng, ok: (x, z) => Math.abs(x) > 5.6 || Math.abs(z) > 4.6, spacing: 0.8 }, (r) => fern(r, 0.35, 0x4c7a3a), statics);
  scatter(14, { half: 6.6, ground: flat, rng, ok: (x, z) => Math.abs(x) > 5.4 || Math.abs(z) > 4.8, spacing: 0.5 }, (r) => mossCushion(r, 0.18 + r() * 0.2), statics);
  scatter(12, { half: 3.2, cx: 0.4, cz: 0.6, ground: flat, rng, spacing: 0.6 }, (r) => tuft(r, 0.12 + r() * 0.08, 0x5f7f3a), statics);

  /* ── the greenhouse lean-to, north wall, east half ────────────────── */
  {
    const g = new Group();
    const frameMat = woodMat(0xe0d8c8, { roughness: 0.8 });
    const glass = new MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.28, envMapIntensity: 1.2 });
    const gw = 4.2;
    const gd = 1.7;
    const hBack = 2.35;
    const hFront = 1.7;
    // Posts.
    for (const [x, z, h] of [
      [-gw / 2, 0, hFront],
      [gw / 2, 0, hFront],
      [-gw / 2, -gd, hBack],
      [gw / 2, -gd, hBack],
      [0, 0, hFront],
    ]) {
      const p = new Mesh(new BoxGeometry(0.08, h, 0.08), frameMat);
      p.position.set(x, h / 2, z);
      p.castShadow = true;
      g.add(p);
    }
    // Rails.
    for (const [y, z] of [
      [hFront, 0],
      [0.9, 0],
      [hBack, -gd],
    ]) {
      const r = new Mesh(new BoxGeometry(gw, 0.07, 0.07), frameMat);
      r.position.set(0, y, z);
      g.add(r);
    }
    // Sloping roof glass and the front glass.
    const slope = Math.hypot(gd, hBack - hFront);
    const roof = new Mesh(new PlaneGeometry(gw, slope), glass);
    roof.position.set(0, (hBack + hFront) / 2, -gd / 2);
    roof.rotation.x = -Math.PI / 2 + Math.atan2(hBack - hFront, gd);
    g.add(roof);
    const front = new Mesh(new PlaneGeometry(gw, hFront - 0.9), glass);
    front.position.set(0, (hFront + 0.9) / 2, 0);
    g.add(front);
    for (const s of [-1, 1]) {
      const side = new Mesh(new PlaneGeometry(gd, hFront - 0.9), glass);
      side.position.set(s * gw / 2, (hFront + 0.9) / 2, -gd / 2);
      side.rotation.y = Math.PI / 2;
      g.add(side);
    }
    // Roof glazing bars.
    for (let i = 0; i <= 6; i++) {
      const bar = new Mesh(new BoxGeometry(0.04, 0.04, slope), frameMat);
      bar.position.set(-gw / 2 + (i * gw) / 6, (hBack + hFront) / 2 + 0.02, -gd / 2);
      bar.rotation.x = Math.atan2(hBack - hFront, gd);
      g.add(bar);
    }
    // The potting bench inside, with its shelf.
    const plankMat = surfaced(planks(), { repeat: [2, 1], roughness: 0.9 });
    const top = new Mesh(new BoxGeometry(gw - 0.4, 0.05, 0.6), plankMat);
    top.position.set(0, 0.86, -gd + 0.45);
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    for (const x of [-gw / 2 + 0.4, gw / 2 - 0.4]) {
      for (const z of [-gd + 0.2, -gd + 0.7]) {
        const leg = new Mesh(new BoxGeometry(0.06, 0.84, 0.06), frameMat);
        leg.position.set(x, 0.42, z);
        g.add(leg);
      }
    }
    const shelf = new Mesh(new BoxGeometry(gw - 0.4, 0.04, 0.3), plankMat);
    shelf.position.set(0, 1.5, -gd + 0.2);
    g.add(shelf);
    // Pots: on the bench, on the shelf, stacked underneath.
    const terracotta = rockMat(0xc95d3c, { roughness: 0.85, bumpScale: 0.01 });
    const potGeo = (r: number, h: number): LatheGeometry =>
      new LatheGeometry(
        [new Vector2(0, 0), new Vector2(r * 0.72, 0), new Vector2(r * 0.95, h * 0.86), new Vector2(r, h * 0.86), new Vector2(r, h), new Vector2(r * 0.88, h), new Vector2(r * 0.86, h * 0.86), new Vector2(r * 0.62, h * 0.08)],
        14,
      );
    const pot = (r: number, h: number, x: number, y: number, z: number, planted?: Object3D): void => {
      const m = new Mesh(potGeo(r, h), terracotta);
      m.position.set(x, y, z);
      m.rotation.y = rng() * 6;
      m.castShadow = true;
      g.add(m);
      if (planted) {
        planted.position.set(x, y + h * 0.9, z);
        g.add(planted);
      }
    };
    for (let i = 0; i < 6; i++) {
      const r = 0.07 + rng() * 0.05;
      pot(r, r * 1.3, -gw / 2 + 0.5 + i * 0.6, 0.885, -gd + 0.3 + rng() * 0.2, i % 2 ? fern(rng, 0.22) : flowers(rng, [0xff4f8e, 0xffe94a, 0xe8352a][i % 3], 4, 0.18));
    }
    for (let i = 0; i < 8; i++) pot(0.05 + rng() * 0.02, 0.08, -gw / 2 + 0.4 + i * 0.45, 1.52, -gd + 0.2);
    // A stack under the bench and a couple tipped over.
    for (let i = 0; i < 5; i++) pot(0.11, 0.13, -gw / 2 + 0.7, 0.0 + i * 0.045, -gd + 0.45);
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(potGeo(0.09, 0.12), terracotta);
      m.position.set(gw / 2 - 0.9 - i * 0.28, 0.09, -gd + 0.5);
      m.rotation.set(Math.PI / 2, 0, rng() * 6);
      g.add(m);
    }
    // A watering can on the bench.
    const zinc = new MeshStandardMaterial({ color: 0x8a949c, roughness: 0.45, metalness: 0.85, envMapIntensity: 1 });
    const can = new Mesh(new CylinderGeometry(0.11, 0.12, 0.26, 12), zinc);
    can.position.set(gw / 2 - 0.5, 0.885 + 0.13, -gd + 0.35);
    g.add(can);
    const spout = new Mesh(new CylinderGeometry(0.014, 0.02, 0.32, 6), zinc);
    spout.position.set(gw / 2 - 0.34, 0.885 + 0.24, -gd + 0.35);
    spout.rotation.z = -1.0;
    g.add(spout);
    const handle = new Mesh(new TorusGeometry(0.08, 0.012, 6, 14, Math.PI), zinc);
    handle.position.set(gw / 2 - 0.5, 0.885 + 0.26, -gd + 0.35);
    g.add(handle);
    g.position.set(2.6, 0, -D / 2 + 0.18 + gd);
    stick.add(g);
  }

  /* ── the pond ────────────────────────────────────────────────────── */
  {
    const g = new Group();
    const r = 1.35;
    const water = new Mesh(
      new CircleGeometry(r, 40),
      new MeshStandardMaterial({ color: 0x1d3a3a, roughness: 0.04, metalness: 0.4, envMapIntensity: 2.4, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.05;
    water.name = 'live-water';
    live.add(water);
    const rim = new Mesh(new TorusGeometry(r + 0.12, 0.14, 8, 40), rockMat(0x9a9080, { roughness: 0.9 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    rim.castShadow = rim.receiveShadow = true;
    g.add(rim);
    // Stones round the rim.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const s = new Mesh(new SphereGeometry(0.1 + rng() * 0.09, 8, 6), rockMat(0x8c8272));
      s.scale.set(1, 0.5 + rng() * 0.3, 1);
      s.position.set(Math.cos(a) * (r + 0.2), 0.06, Math.sin(a) * (r + 0.2));
      s.rotation.y = rng() * 6;
      s.castShadow = true;
      g.add(s);
    }
    // Lily pads.
    const padMat = new MeshStandardMaterial({ color: 0x4f7a3f, roughness: 0.6 });
    for (let i = 0; i < 9; i++) {
      const pad = new Mesh(new CircleGeometry(0.1 + rng() * 0.08, 12, 0.3, Math.PI * 1.85), padMat);
      pad.rotation.x = -Math.PI / 2;
      const a = rng() * Math.PI * 2;
      const rr = rng() * r * 0.8;
      pad.position.set(Math.cos(a) * rr, 0.056, Math.sin(a) * rr);
      pad.rotation.z = rng() * 6;
      g.add(pad);
    }
    // Reeds on one side.
    for (let i = 0; i < 6; i++) {
      const t = grassTuft(rng, 0.7 + rng() * 0.3, 0x5f7a34);
      const a = 0.4 + rng() * 1.2;
      t.position.set(Math.cos(a) * (r + 0.35), 0, Math.sin(a) * (r + 0.35));
      g.add(t);
    }
    g.position.set(3.2, 0, -0.4);
    live.position.copy(g.position);
    stick.add(g);
  }

  /* ── the bench, the log pile, the wheelbarrow, the birdbath ──────── */
  {
    const plankMat = surfaced(planks(), { repeat: [1.5, 0.4], roughness: 0.9, color: 0xcdbfa8 });
    const iron = new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.8 });
    const bench = new Group();
    for (let i = 0; i < 3; i++) {
      const slat = new Mesh(new BoxGeometry(1.6, 0.04, 0.11), plankMat);
      slat.position.set(0, 0.45, -0.15 + i * 0.14);
      slat.castShadow = slat.receiveShadow = true;
      bench.add(slat);
    }
    for (let i = 0; i < 3; i++) {
      const slat = new Mesh(new BoxGeometry(1.6, 0.11, 0.04), plankMat);
      slat.position.set(0, 0.58 + i * 0.14, 0.2);
      slat.rotation.x = -0.15;
      slat.castShadow = true;
      bench.add(slat);
    }
    for (const s of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.05, 0.45, 0.42), iron);
      leg.position.set(s * 0.72, 0.225, 0);
      bench.add(leg);
      const back = new Mesh(new BoxGeometry(0.05, 0.55, 0.05), iron);
      back.position.set(s * 0.72, 0.7, 0.2);
      back.rotation.x = -0.15;
      bench.add(back);
    }
    put(bench, -3.4, 4.6, Math.PI + 0.25, flat, stick);

    // Log pile against the west wall.
    const logs = new Group();
    const bark = rockMat(0x6b5a48, { roughness: 0.95 });
    const cut = new MeshStandardMaterial({ color: 0xd6c7a8, roughness: 0.9 });
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 6 - row; i++) {
        const log = new Mesh(new CylinderGeometry(0.11, 0.11, 0.5, 10), bark);
        log.rotation.z = Math.PI / 2;
        log.position.set(row * 0.11 + i * 0.22 - 0.5, 0.11 + row * 0.19, (rng() - 0.5) * 0.05);
        log.castShadow = true;
        logs.add(log);
        for (const s of [-1, 1]) {
          const end = new Mesh(new CircleGeometry(0.1, 10), cut);
          end.position.set(log.position.x + s * 0.251, log.position.y, log.position.z);
          end.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
          logs.add(end);
        }
      }
    }
    logs.rotation.y = Math.PI / 2;
    put(logs, -W / 2 + 0.55, 3.6, Math.PI / 2, flat, stick);

    // Wheelbarrow by the north wall: a tub over a front wheel, two legs at
    // the back, two long handles reaching behind.
    const barrow = new Group();
    const tin = new MeshStandardMaterial({ color: 0x4a7f8c, roughness: 0.55, metalness: 0.5, envMapIntensity: 0.8 });
    const tubH = 0.28;
    const tubY = 0.3;
    const tub = new Mesh(new BoxGeometry(0.62, tubH, 0.85), tin);
    tub.position.set(0, tubY + tubH / 2, 0);
    tub.castShadow = true;
    barrow.add(tub);
    const tubLip = new Mesh(new BoxGeometry(0.7, 0.03, 0.93), tin);
    tubLip.position.set(0, tubY + tubH, 0);
    barrow.add(tubLip);
    const wheel = new Mesh(new TorusGeometry(0.15, 0.045, 8, 16), iron);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.195, -0.5);
    barrow.add(wheel);
    const hub = new Mesh(new CylinderGeometry(0.05, 0.05, 0.08, 8), iron);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    barrow.add(hub);
    const ash = woodMat(0xb8b0a0);
    for (const s of [-1, 1]) {
      const handle = new Mesh(new BoxGeometry(0.045, 0.045, 1.35), ash);
      handle.position.set(s * 0.26, tubY - 0.03, 0.2);
      handle.rotation.x = -0.12;
      handle.castShadow = true;
      barrow.add(handle);
      const leg = new Mesh(new BoxGeometry(0.04, tubY, 0.04), iron);
      leg.position.set(s * 0.26, tubY / 2, 0.32);
      barrow.add(leg);
      const strut = new Mesh(new BoxGeometry(0.03, 0.03, 0.6), iron);
      strut.position.set(s * 0.26, 0.08, -0.05);
      strut.rotation.x = 0.35;
      barrow.add(strut);
    }
    put(barrow, -1.6, -D / 2 + 1.1, 0.6, flat, stick);

    // Birdbath on the lawn.
    const bath = new Group();
    const stone = rockMat(0xb8b0a0, { roughness: 0.85 });
    const stem = new Mesh(new CylinderGeometry(0.07, 0.12, 0.7, 12), stone);
    stem.position.y = 0.35;
    stem.castShadow = true;
    bath.add(stem);
    const bowl = new Mesh(new LatheGeometry([new Vector2(0.05, 0), new Vector2(0.32, 0.03), new Vector2(0.36, 0.12), new Vector2(0.3, 0.13), new Vector2(0.1, 0.08)], 18), stone);
    bowl.position.y = 0.7;
    bowl.castShadow = true;
    bath.add(bowl);
    const bathWater = new Mesh(new CircleGeometry(0.28, 18), new MeshStandardMaterial({ color: 0x3a5a5c, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 }));
    bathWater.rotation.x = -Math.PI / 2;
    bathWater.position.y = 0.79;
    bath.add(bathWater);
    put(bath, 0.4, 0.8, 0, flat, stick);
  }

  /* ── odds and ends to hide behind ────────────────────────────────── */
  {
    const slat = surfaced(planks(), { repeat: [1, 0.5], roughness: 0.95, color: 0x9a8a72 });
    // A compost bin in the north-east corner: slatted, open-topped, heaped.
    const bin = new Group();
    for (const [x, z, ry] of [
      [0, -0.5, 0],
      [0, 0.5, 0],
      [-0.5, 0, Math.PI / 2],
      [0.5, 0, Math.PI / 2],
    ]) {
      for (let i = 0; i < 5; i++) {
        const b = new Mesh(new BoxGeometry(1.0, 0.13, 0.03), slat);
        b.position.set(x, 0.1 + i * 0.17, z);
        b.rotation.y = ry;
        b.castShadow = true;
        bin.add(b);
      }
    }
    for (const [x, z] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ]) {
      const post = new Mesh(new BoxGeometry(0.06, 0.95, 0.06), slat);
      post.position.set(x, 0.475, z);
      bin.add(post);
    }
    const heap = new Mesh(lumpGeometry(rng, 1, 0.2), surfaced(soil(), { repeat: [2, 2], roughness: 1, color: 0x8a7a66 }));
    heap.scale.set(0.46, 0.3, 0.46);
    heap.position.y = 0.72;
    bin.add(heap);
    put(bin, W / 2 - 0.9, -D / 2 + 0.9, 0.1, flat, stick);

    // A rain barrel at the greenhouse's end, a bucket beside it.
    const barrelMat = surfaced(planks(), { repeat: [4, 1], roughness: 0.9, color: 0x7a6a56 });
    const barrel = new Mesh(new CylinderGeometry(0.3, 0.27, 0.9, 16), barrelMat);
    barrel.position.y = 0.45;
    barrel.castShadow = true;
    const barrelG = new Group();
    barrelG.add(barrel);
    for (const y of [0.15, 0.75]) {
      const hoop = new Mesh(new TorusGeometry(0.305, 0.012, 6, 24), new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.8 }));
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      barrelG.add(hoop);
    }
    const barrelWater = new Mesh(new CircleGeometry(0.28, 16), new MeshStandardMaterial({ color: 0x24403f, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 }));
    barrelWater.rotation.x = -Math.PI / 2;
    barrelWater.position.y = 0.86;
    barrelG.add(barrelWater);
    put(barrelG, 5.4, -D / 2 + 0.55, 0, flat, stick);
    const zinc = new MeshStandardMaterial({ color: 0x8a949c, roughness: 0.45, metalness: 0.85, envMapIntensity: 1 });
    const bucket = new Mesh(new CylinderGeometry(0.15, 0.12, 0.3, 12, 1, true), zinc);
    bucket.material.side = 2;
    bucket.position.y = 0.15;
    bucket.castShadow = true;
    put(bucket, 4.8, -D / 2 + 0.7, 0.3, flat, stick);

    // Crates stacked by the log pile, one on its side.
    const crateMat = surfaced(planks(), { repeat: [1, 1], roughness: 0.95, color: 0xb8a686 });
    const crate = (x: number, y: number, z: number, ry: number, rx = 0): void => {
      const c = new Mesh(new BoxGeometry(0.5, 0.36, 0.38), crateMat);
      c.position.set(x, y, z);
      c.rotation.set(rx, ry, 0);
      c.castShadow = true;
      stick.add(c);
    };
    crate(-W / 2 + 0.6, 0.18, 5.0, 0.2);
    crate(-W / 2 + 0.62, 0.54, 5.02, -0.15);
    crate(-W / 2 + 1.25, 0.19, 5.2, 1.2);
  }

  /* ── the merge ───────────────────────────────────────────────────── */
  const keepLive = (o: Object3D): boolean => o.name.startsWith('live-') || (o as Mesh).userData?.walkable === true;
  collapseStatic(statics, keepLive);
  collapseStatic(stick, keepLive);

  const floors: Object3D[] = [];
  ground.traverse((o) => {
    if (o.userData.walkable) floors.push(o);
  });
  const stickables: Object3D[] = [];
  stick.traverse((o) => {
    if ((o as Mesh).isMesh) stickables.push(o);
  });

  let t = 0;
  const water = live.getObjectByName('live-water') as Mesh | undefined;

  return {
    id: 'garden',
    name: 'The Walled Garden',
    root,
    floors,
    blockers: stickables,
    stickables,
    spawn: { x: -0.8, z: 4.2, yaw: 0 },
    palette: GARDEN_PALETTE,
    sky,
    update: (delta) => {
      t += delta;
      if (water) {
        const m = water.material as MeshStandardMaterial;
        m.roughness = 0.05 + 0.03 * Math.sin(t * 1.3);
        water.position.y = 0.05 + 0.003 * Math.sin(t * 0.8);
      }
    },
  };
}
