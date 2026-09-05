/**
 * THE WORKSHOP — the second place.
 *
 * A lock-up garage on a bright morning: breeze-block walls, a concrete
 * floor with oil on it, a corrugated roller door down, and one high window
 * throwing a hard block of sun across the floor. A workbench with a vice
 * under a pegboard of tools, steel racking stacked with boxes, cans and
 * jars, oil drums, a tyre stack, a stepladder, a red tool chest, a car
 * under a dust sheet, pallets, a broom, a fridge that hums. Indoors is
 * where the seeker's eye line matters: under the bench, behind the drums,
 * on top of the racking, on the ceiling.
 *
 * Light: the sun through the window (the one shadow caster), two hanging
 * tubes as emissive fixtures with one warm point light under them, and a
 * dim hemisphere. Everything else is emissive paint.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { collapseStatic } from './kit/merge.js';
import { makeRng } from './kit/paper.js';
import { lumpGeometry } from './kit/plants.js';
import { rustMat, woodMat } from './kit/skins.js';
import { skyDome } from './kit/sky.js';
import { blockwall, cardboard, concrete, corrugated, pegboard, planks, surfaced } from './kit/surfaces.js';
import { tagFloor, type Place } from './place.js';

// SLATE 29, WET SLATE 30, PEWTER 38, RUST 3, UMBER 7, BRICK 37, SIGNAL RED 19,
// VOLT YELLOW 17, CHALK 35, JET BLACK 1, LINEN 39, BARK 27.
const WORKSHOP_PALETTE = [29, 30, 38, 3, 7, 1, 19, 17, 35, 39];

const W = 9; // x
const D = 7; // z
const H = 3.2;
const SUN = new Vector3(0.35, 0.55, -0.75); // in through the north window, high


export function buildWorkshop(): Place {
  const root = new Group();
  root.name = 'workshop';
  const rng = makeRng(777);
  const statics = new Group();
  const stick = new Group();
  const live = new Group();
  root.add(statics, stick, live);

  const sky = new Color(0xb9c9d6);
  root.add(skyDome({ zenith: 0x6f9fd0, horizon: 0xd8e2ea, glow: 0xfff0d6, ground: 0x4a4a44 }, SUN));

  /* ── light ───────────────────────────────────────────────────────── */
  const sun = new DirectionalLight(0xfff0d8, 3.4);
  sun.position.copy(SUN).multiplyScalar(14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.015;
  const cam = sun.shadow.camera;
  cam.near = 2;
  cam.far = 40;
  cam.left = cam.bottom = -7;
  cam.right = cam.top = 7;
  cam.updateProjectionMatrix();
  root.add(sun, sun.target);
  root.add(new HemisphereLight(0x9fb0bf, 0x3a3a36, 0.32));
  const lamp = new PointLight(0xfff2d0, 14, 12, 1.6);
  lamp.position.set(0.5, 2.7, 0.2);
  root.add(lamp);

  /* ── the shell ───────────────────────────────────────────────────── */
  const floorMat = surfaced(concrete(), { repeat: [W / 3, D / 3], roughness: 0.85, bumpScale: 0.01 });
  const floor = new Mesh(new PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(tagFloor(floor));
  const floors: Object3D[] = [floor];

  const wallMat = surfaced(blockwall(), { repeat: [W / 2.6, H / 1.3], roughness: 0.92, bumpScale: 0.02, color: 0xd9dbd3 });
  const wall = (len: number, x: number, z: number, ry: number, holes: [number, number, number, number][] = []): void => {
    // A wall is a row of boxes with gaps where the holes are (x0..x1 along
    // the wall, y0..y1), so the sun really comes through the window.
    const g = new Group();
    const pieces: [number, number, number, number][] = [];
    if (!holes.length) pieces.push([-len / 2, len / 2, 0, H]);
    for (const [x0, x1, y0, y1] of holes) {
      pieces.push([-len / 2, x0, 0, H], [x1, len / 2, 0, H], [x0, x1, 0, y0], [x0, x1, y1, H]);
    }
    for (const [x0, x1, y0, y1] of pieces) {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) continue;
      const m = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, 0.25), wallMat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    stick.add(g);
  };
  wall(W, 0, -D / 2, 0, [[1.2, 3.2, 1.9, 2.8]]); // north, with the window
  wall(W, 0, D / 2, 0); // south
  wall(D, -W / 2, 0, Math.PI / 2); // west
  wall(D, W / 2, 0, Math.PI / 2, [[-2.2, 2.2, 0, 2.5]]); // east: the roller door opening

  // The window: frame, glass, a sill, and the bright outside beyond it.
  {
    const frameMat = new MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.6, metalness: 0.4 });
    const g = new Group();
    for (const [x, y, w, h] of [
      [2.2, 1.9, 2.1, 0.06],
      [2.2, 2.8, 2.1, 0.06],
      [1.2, 2.35, 0.06, 0.9],
      [3.2, 2.35, 0.06, 0.9],
      [2.2, 2.35, 0.04, 0.9],
      [2.2, 2.35, 2.1, 0.04],
    ]) {
      const bar = new Mesh(new BoxGeometry(w, h, 0.08), frameMat);
      bar.position.set(x, y, -D / 2 + 0.02);
      g.add(bar);
    }
    const glass = new Mesh(new PlaneGeometry(2.0, 0.9), new MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.15, transparent: true, opacity: 0.22, side: DoubleSide }));
    glass.position.set(2.2, 2.35, -D / 2 + 0.02);
    g.add(glass);
    const sill = new Mesh(new BoxGeometry(2.3, 0.05, 0.36), frameMat);
    sill.position.set(2.2, 1.87, -D / 2 + 0.06);
    g.add(sill);
    root.add(g);
    // Outside: a bright yard wall far enough back to read as daylight.
    const yard = new Mesh(new PlaneGeometry(30, 12), new MeshStandardMaterial({ color: 0xcfd8dc, roughness: 1 }));
    yard.position.set(2, 3, -D / 2 - 6);
    root.add(yard);
    const yardFloor = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: 0x8a8f86, roughness: 1 }));
    yardFloor.rotation.x = -Math.PI / 2;
    yardFloor.position.set(0, -0.02, 0);
    root.add(yardFloor);
  }

  // The roller door: corrugated slats in the east opening, with a rail.
  {
    const doorMat = surfaced(corrugated(), { repeat: [1, 4], roughness: 0.55, metalness: 0.55, bumpScale: 0.03, color: 0xb9c1c6 });
    const door = new Mesh(new BoxGeometry(4.4, 2.5, 0.06), doorMat);
    door.position.set(W / 2 - 0.1, 1.25, 0);
    door.rotation.y = Math.PI / 2;
    door.castShadow = door.receiveShadow = true;
    stick.add(door);
    const rail = new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.8 });
    for (const z of [-2.25, 2.25]) {
      const r = new Mesh(new BoxGeometry(0.08, 2.6, 0.08), rail);
      r.position.set(W / 2 - 0.16, 1.3, z);
      stick.add(r);
    }
    const drum = new Mesh(new CylinderGeometry(0.2, 0.2, 4.6, 12), rail);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(W / 2 - 0.3, 2.75, 0);
    stick.add(drum);
  }

  // Ceiling: joists under a sheet, two hanging tubes.
  {
    const ceil = new Mesh(new PlaneGeometry(W, D), new MeshStandardMaterial({ color: 0x9a9c98, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    ceil.receiveShadow = true;
    stick.add(ceil);
    const joist = woodMat(0x8a7a62, { repeat: [6, 1] });
    for (let i = 0; i < 7; i++) {
      const j = new Mesh(new BoxGeometry(W, 0.18, 0.06), joist);
      j.position.set(0, H - 0.09, -D / 2 + 0.5 + i * 1.0);
      stick.add(j);
    }
    for (const x of [-2.2, 2.2]) {
      const fitting = new Mesh(new BoxGeometry(1.3, 0.06, 0.12), new MeshStandardMaterial({ color: 0xd8dcd6, roughness: 0.6 }));
      fitting.position.set(x, H - 0.55, 0.2);
      stick.add(fitting);
      const tube = new Mesh(new CylinderGeometry(0.02, 0.02, 1.2, 8), new MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false }));
      tube.rotation.z = Math.PI / 2;
      tube.position.set(x, H - 0.6, 0.2);
      stick.add(tube);
      for (const dx of [-0.5, 0.5]) {
        const chain = new Mesh(new CylinderGeometry(0.006, 0.006, 0.5, 4), new MeshStandardMaterial({ color: 0x555 }));
        chain.position.set(x + dx, H - 0.28, 0.2);
        stick.add(chain);
      }
    }
  }

  /* ── the bench, the pegboard, the vice ───────────────────────────── */
  const steel = new MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.5, metalness: 0.75, envMapIntensity: 0.9 });
  const darkSteel = new MeshStandardMaterial({ color: 0x1f2226, roughness: 0.45, metalness: 0.8 });
  {
    const g = new Group();
    const top = new Mesh(new BoxGeometry(3.6, 0.08, 0.8), surfaced(planks(), { repeat: [3, 0.7], roughness: 0.8, color: 0xb9a68a }));
    top.position.set(0, 0.9, 0);
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    for (const [x, z] of [
      [-1.7, -0.3],
      [1.7, -0.3],
      [-1.7, 0.3],
      [1.7, 0.3],
    ]) {
      const leg = new Mesh(new BoxGeometry(0.08, 0.86, 0.08), steel);
      leg.position.set(x, 0.43, z);
      g.add(leg);
    }
    const shelf = new Mesh(new BoxGeometry(3.4, 0.04, 0.6), surfaced(planks(), { repeat: [3, 0.6], roughness: 0.9, color: 0x9a8a72 }));
    shelf.position.set(0, 0.25, 0);
    g.add(shelf);
    // Pegboard behind, up the wall.
    const board = new Mesh(new BoxGeometry(3.4, 1.4, 0.03), surfaced(pegboard(), { repeat: [1, 1], roughness: 0.9 }));
    board.position.set(0, 1.75, -0.42);
    g.add(board);
    // The vice, bolted to the right end.
    const vice = new Group();
    const body = new Mesh(new BoxGeometry(0.22, 0.14, 0.16), darkSteel);
    body.position.y = 0.07;
    vice.add(body);
    const jaw = new Mesh(new BoxGeometry(0.16, 0.12, 0.08), darkSteel);
    jaw.position.set(0, 0.1, 0.13);
    vice.add(jaw);
    const screw = new Mesh(new CylinderGeometry(0.014, 0.014, 0.28, 8), steel);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, 0.07, 0.2);
    vice.add(screw);
    const handleBar = new Mesh(new CylinderGeometry(0.008, 0.008, 0.22, 6), steel);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 0.07, 0.34);
    vice.add(handleBar);
    vice.position.set(1.3, 0.94, 0.15);
    g.add(vice);
    // Things on the bench: a radio, a jar of screws, an oily rag, a mug.
    const radio = new Mesh(new BoxGeometry(0.3, 0.16, 0.1), new MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }));
    radio.position.set(-1.3, 1.02, -0.25);
    g.add(radio);
    const aerial = new Mesh(new CylinderGeometry(0.004, 0.004, 0.4, 4), steel);
    aerial.position.set(-1.18, 1.3, -0.25);
    aerial.rotation.z = -0.3;
    g.add(aerial);
    for (let i = 0; i < 3; i++) {
      const jar = new Mesh(new CylinderGeometry(0.05, 0.05, 0.13, 10), new MeshStandardMaterial({ color: 0xbfd0c8, roughness: 0.1, transparent: true, opacity: 0.5 }));
      jar.position.set(-0.6 + i * 0.16, 1.0, -0.28);
      g.add(jar);
      const fill = new Mesh(new CylinderGeometry(0.045, 0.045, 0.08, 10), new MeshStandardMaterial({ color: [0x8a8f96, 0xc9a24b, 0x5b5f66][i], roughness: 0.6, metalness: 0.5 }));
      fill.position.set(-0.6 + i * 0.16, 0.98, -0.28);
      g.add(fill);
    }
    const rag = new Mesh(lumpGeometry(rng, 1, 0.3), new MeshStandardMaterial({ color: 0x8c2f2a, roughness: 1 }));
    rag.scale.set(0.16, 0.04, 0.12);
    rag.position.set(0.4, 0.96, 0.1);
    g.add(rag);
    const mug = new Mesh(new CylinderGeometry(0.045, 0.04, 0.1, 12), new MeshStandardMaterial({ color: 0xe0d8c8, roughness: 0.4 }));
    mug.position.set(0.9, 0.99, -0.2);
    g.add(mug);
    // Under the bench: a paint can, a coil of cable, a toolbox.
    const can = new Mesh(new CylinderGeometry(0.11, 0.11, 0.2, 14), new MeshStandardMaterial({ color: 0xa3a6a8, roughness: 0.4, metalness: 0.7 }));
    can.position.set(-1.0, 0.37, 0.1);
    g.add(can);
    const coil = new Mesh(new TorusGeometry(0.17, 0.05, 8, 18), new MeshStandardMaterial({ color: 0xff7a18, roughness: 0.6 }));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0.3, 0.32, 0.1);
    g.add(coil);
    const toolbox = new Mesh(new BoxGeometry(0.5, 0.22, 0.24), new MeshStandardMaterial({ color: 0x1c4f8a, roughness: 0.5, metalness: 0.4 }));
    toolbox.position.set(1.2, 0.38, 0.05);
    g.add(toolbox);
    g.position.set(-1.6, 0, -D / 2 + 0.55);
    stick.add(g);
  }

  /* ── steel racking along the west wall ───────────────────────────── */
  {
    const g = new Group();
    const upright = new MeshStandardMaterial({ color: 0x2f4f8f, roughness: 0.5, metalness: 0.6 });
    const beam = new MeshStandardMaterial({ color: 0xe0722a, roughness: 0.55, metalness: 0.5 });
    const bay = 1.8;
    const depth = 0.6;
    const levels = [0.15, 0.95, 1.75, 2.45];
    for (let b = 0; b <= 2; b++) {
      for (const z of [-depth / 2, depth / 2]) {
        const u = new Mesh(new BoxGeometry(0.06, 2.6, 0.06), upright);
        u.position.set(b * bay - bay, 1.3, z);
        g.add(u);
      }
    }
    const deck = surfaced(planks(), { repeat: [2, 0.5], roughness: 0.9, color: 0xa08a6a });
    for (const y of levels) {
      for (let b = 0; b < 2; b++) {
        const x = b * bay - bay / 2;
        for (const z of [-depth / 2, depth / 2]) {
          const bm = new Mesh(new BoxGeometry(bay - 0.06, 0.08, 0.05), beam);
          bm.position.set(x, y, z);
          g.add(bm);
        }
        const d = new Mesh(new BoxGeometry(bay - 0.08, 0.03, depth - 0.06), deck);
        d.position.set(x, y + 0.045, 0);
        d.receiveShadow = true;
        g.add(d);
      }
    }
    // Stock: boxes, cans, a crate of bottles, a folded tarp, a helmet.
    const boxMat = surfaced(cardboard(), { repeat: [1, 1], roughness: 0.95 });
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): void => {
      const m = new Mesh(new BoxGeometry(w, h, d), boxMat);
      m.position.set(x, y + h / 2, z);
      m.rotation.y = ry;
      m.castShadow = true;
      g.add(m);
    };
    box(-1.3, 0.21, 0, 0.5, 0.4, 0.45, 0.05);
    box(-0.7, 0.21, 0.05, 0.45, 0.32, 0.4, -0.08);
    box(0.4, 0.21, 0, 0.6, 0.5, 0.5);
    box(-1.2, 1.01, -0.05, 0.4, 0.3, 0.4, 0.1);
    box(-0.5, 1.01, 0, 0.55, 0.42, 0.45);
    box(1.2, 1.01, 0.04, 0.35, 0.25, 0.35, 0.3);
    box(-1.0, 1.81, 0, 0.7, 0.35, 0.45);
    box(0.9, 2.51, 0, 0.5, 0.4, 0.45, -0.1);
    box(0.2, 2.51, 0.05, 0.5, 0.3, 0.4, 0.15);
    const tin = (x: number, y: number, z: number, r: number, h: number, hex: number): void => {
      const m = new Mesh(new CylinderGeometry(r, r, h, 14), new MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0.5 }));
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      g.add(m);
      const lid = new Mesh(new CylinderGeometry(r * 0.98, r * 0.98, 0.012, 14), steel);
      lid.position.set(x, y + h + 0.006, z);
      g.add(lid);
    };
    tin(0.2, 1.01, -0.1, 0.09, 0.18, 0xc9d2dd);
    tin(0.42, 1.01, 0.08, 0.08, 0.15, 0xe8352a);
    tin(0.62, 1.01, -0.08, 0.07, 0.12, 0x2f6fbf);
    tin(1.3, 1.81, 0, 0.11, 0.22, 0xffe94a);
    tin(1.0, 1.81, 0.1, 0.06, 0.1, 0x4a7f8c);
    tin(0.6, 1.81, -0.1, 0.1, 0.2, 0xa3a6a8);
    const tarp = new Mesh(new BoxGeometry(0.6, 0.14, 0.45), new MeshStandardMaterial({ color: 0x3a5fa8, roughness: 0.8 }));
    tarp.position.set(1.4, 0.26, 0);
    g.add(tarp);
    const helmet = new Mesh(lumpGeometry(rng, 1, 0.05), new MeshStandardMaterial({ color: 0xffe94a, roughness: 0.4 }));
    helmet.scale.set(0.14, 0.11, 0.16);
    helmet.position.set(-0.4, 2.58, 0);
    g.add(helmet);
    g.position.set(-W / 2 + 0.5, 0, 0.8);
    g.rotation.y = Math.PI / 2;
    stick.add(g);
  }

  /* ── the car under a dust sheet ──────────────────────────────────── */
  {
    const g = new Group();
    const sheetMat = new MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.95, envMapIntensity: 0.3 });
    // Body, cabin and a skirt to the floor, all soft-cornered: a sheet
    // rounds everything it lies over.
    const body = new Mesh(new RoundedBoxGeometry(3.9, 0.8, 1.8, 4, 0.32), sheetMat);
    body.position.set(0, 0.62, 0);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const cabin = new Mesh(new RoundedBoxGeometry(2.0, 0.62, 1.55, 4, 0.3), sheetMat);
    cabin.position.set(0.25, 1.22, 0);
    cabin.castShadow = true;
    g.add(cabin);
    const bonnetSlope = new Mesh(new RoundedBoxGeometry(1.0, 0.42, 1.5, 4, 0.2), sheetMat);
    bonnetSlope.position.set(-0.95, 1.0, 0);
    bonnetSlope.rotation.z = 0.2;
    g.add(bonnetSlope);
    const skirt = new Mesh(new RoundedBoxGeometry(3.95, 0.5, 1.85, 2, 0.12), sheetMat);
    skirt.position.set(0, 0.22, 0);
    skirt.castShadow = true;
    g.add(skirt);
    // Folds: a few creases of sheet on the floor around it.
    for (let i = 0; i < 6; i++) {
      const fold = new Mesh(lumpGeometry(rng, 1, 0.3), sheetMat);
      const a = rng() * Math.PI * 2;
      fold.scale.set(0.3 + rng() * 0.3, 0.06, 0.2 + rng() * 0.2);
      fold.position.set(Math.cos(a) * 2.0, 0.03, Math.sin(a) * 0.95);
      g.add(fold);
    }
    const rubber = new MeshStandardMaterial({ color: 0x151719, roughness: 0.9 });
    for (const [x, z] of [
      [-1.3, -0.9],
      [1.3, -0.9],
      [-1.3, 0.9],
      [1.3, 0.9],
    ]) {
      const t = new Mesh(new CylinderGeometry(0.31, 0.31, 0.22, 14), rubber);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, 0.31, z);
      g.add(t);
    }
    g.position.set(1.5, 0, 0.7);
    g.rotation.y = 0.08;
    stick.add(g);
  }

  /* ── drums, tyres, ladder, tool chest, pallets, fridge, broom ────── */
  {
    // Oil drums in the south-west corner, one on its side.
    const drumMat = rustMat(0x2a5a8a, { roughness: 0.6, metalness: 0.5 });
    const drumMat2 = rustMat(0x8a2f24, { roughness: 0.65, metalness: 0.45 });
    const drum = (x: number, z: number, mat: MeshStandardMaterial, side = false): void => {
      const m = new Mesh(new CylinderGeometry(0.29, 0.29, 0.88, 18), mat);
      if (side) {
        m.rotation.z = Math.PI / 2;
        m.position.set(x, 0.29, z);
      } else m.position.set(x, 0.44, z);
      m.castShadow = true;
      stick.add(m);
      for (const y of [-0.25, 0.25]) {
        const ring = new Mesh(new TorusGeometry(0.295, 0.012, 6, 24), steel);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        m.add(ring);
      }
    };
    drum(-3.6, 2.6, drumMat);
    drum(-3.0, 2.85, drumMat2);
    drum(-3.5, 1.7, drumMat, true);

    // A tyre stack by the door.
    const rubber = new MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const t = new Mesh(new TorusGeometry(0.24, 0.1, 10, 22), rubber);
      t.rotation.x = Math.PI / 2;
      t.position.set(3.4, 0.1 + i * 0.2, -2.6 + (rng() - 0.5) * 0.06);
      t.rotation.z = (rng() - 0.5) * 0.1;
      t.castShadow = true;
      stick.add(t);
    }
    const loose = new Mesh(new TorusGeometry(0.24, 0.1, 10, 22), rubber);
    loose.position.set(2.7, 0.34, -2.9);
    loose.rotation.set(0, 0.4, Math.PI / 2 - 0.15);
    stick.add(loose);

    // A stepladder leaning on the south wall.
    const ladder = new Group();
    const ali = new MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.35, metalness: 0.85 });
    for (const x of [-0.22, 0.22]) {
      const rail = new Mesh(new BoxGeometry(0.05, 2.2, 0.03), ali);
      rail.position.set(x, 1.1, 0);
      ladder.add(rail);
    }
    for (let i = 0; i < 7; i++) {
      const rung = new Mesh(new BoxGeometry(0.42, 0.03, 0.06), ali);
      rung.position.set(0, 0.2 + i * 0.3, 0);
      ladder.add(rung);
    }
    ladder.rotation.x = 0.3;
    ladder.position.set(-0.4, 0.02, D / 2 - 0.45);
    stick.add(ladder);

    // The red tool chest on castors.
    const chest = new Group();
    const red = new MeshStandardMaterial({ color: 0xc0231e, roughness: 0.35, metalness: 0.3, envMapIntensity: 0.9 });
    const cab = new Mesh(new BoxGeometry(0.7, 0.9, 0.45), red);
    cab.position.y = 0.55;
    cab.castShadow = true;
    chest.add(cab);
    for (let i = 0; i < 5; i++) {
      const drawer = new Mesh(new BoxGeometry(0.62, 0.12, 0.02), new MeshStandardMaterial({ color: 0xa61d18, roughness: 0.35, metalness: 0.3 }));
      drawer.position.set(0, 0.2 + i * 0.16, 0.235);
      chest.add(drawer);
      const pull = new Mesh(new BoxGeometry(0.3, 0.02, 0.02), steel);
      pull.position.set(0, 0.2 + i * 0.16, 0.25);
      chest.add(pull);
    }
    for (const [x, z] of [
      [-0.28, -0.16],
      [0.28, -0.16],
      [-0.28, 0.16],
      [0.28, 0.16],
    ]) {
      const w = new Mesh(new CylinderGeometry(0.05, 0.05, 0.04, 10), darkSteel);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.05, z);
      chest.add(w);
    }
    chest.position.set(2.2, 0, -2.2);
    chest.rotation.y = -0.4;
    stick.add(chest);

    // Pallets stacked in the north-east corner.
    const pal = surfaced(planks(), { repeat: [1, 0.3], roughness: 0.95, color: 0xa09070 });
    for (let i = 0; i < 3; i++) {
      const p = new Group();
      for (let k = 0; k < 5; k++) {
        const b = new Mesh(new BoxGeometry(1.2, 0.02, 0.14), pal);
        b.position.set(0, 0.13, -0.42 + k * 0.21);
        p.add(b);
      }
      for (const x of [-0.5, 0, 0.5]) {
        const bearer = new Mesh(new BoxGeometry(0.1, 0.1, 1.0), pal);
        bearer.position.set(x, 0.06, 0);
        p.add(bearer);
      }
      p.position.set(3.6, i * 0.15, -1.1);
      p.rotation.y = (rng() - 0.5) * 0.12;
      stick.add(p);
    }

    // A fridge by the bench end, humming.
    const fridge = new Mesh(new BoxGeometry(0.6, 1.5, 0.6), new MeshStandardMaterial({ color: 0xe6e8e4, roughness: 0.35, metalness: 0.1 }));
    fridge.position.set(-3.9, 0.75, -2.6);
    fridge.castShadow = true;
    stick.add(fridge);
    const fridgeHandle = new Mesh(new BoxGeometry(0.03, 0.5, 0.03), steel);
    fridgeHandle.position.set(-3.7, 0.85, -2.28);
    stick.add(fridgeHandle);
    const seam = new Mesh(new BoxGeometry(0.58, 0.012, 0.012), darkSteel);
    seam.position.set(-3.9, 1.12, -2.29);
    stick.add(seam);
    const fridgeFoot = new Mesh(new BoxGeometry(0.56, 0.08, 0.5), darkSteel);
    fridgeFoot.position.set(-3.9, 0.04, -2.62);
    stick.add(fridgeFoot);

    // A broom leaning on the racking end, a bucket, a bin.
    const broom = new Group();
    const shaft = new Mesh(new CylinderGeometry(0.014, 0.014, 1.4, 6), woodMat(0xc9b48a));
    shaft.position.y = 0.72;
    broom.add(shaft);
    const head = new Mesh(new BoxGeometry(0.34, 0.06, 0.06), woodMat(0x8a7a62));
    head.position.y = 0.06;
    broom.add(head);
    const bristles = new Mesh(new BoxGeometry(0.32, 0.06, 0.05), new MeshStandardMaterial({ color: 0xc9a24b, roughness: 1 }));
    bristles.position.y = 0.01;
    broom.add(bristles);
    broom.rotation.z = 0.18;
    broom.position.set(-3.95, 0.0, 2.4);
    stick.add(broom);
    const bin = new Mesh(new CylinderGeometry(0.24, 0.2, 0.7, 14), new MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.7, metalness: 0.3 }));
    bin.position.set(-0.4, 0.35, -2.9);
    stick.add(bin);
  }

  /* ── the merge ───────────────────────────────────────────────────── */
  const keep = (o: Object3D): boolean => o.name.startsWith('live-') || (o as Mesh).userData?.walkable === true;
  collapseStatic(statics, keep);
  collapseStatic(stick, keep);
  const stickables: Object3D[] = [];
  stick.traverse((o) => {
    if ((o as Mesh).isMesh) stickables.push(o);
  });

  return {
    id: 'workshop',
    name: 'The Workshop',
    root,
    floors,
    blockers: stickables,
    stickables,
    spawn: { x: -1.2, z: 2.6, yaw: 0.35 },
    palette: WORKSHOP_PALETTE,
    sky,
    fog: [40, 200],
  };
}

