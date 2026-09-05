/**
 * Terrain — a displaced, vertex-coloured plane (ff2's desert terrain,
 * generalised): give it a height function and a colour function and it
 * hands back one mesh you can walk on.
 */

import { Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry, type Color } from 'three';

export interface TerrainOpts {
  size: number;
  segments: number;
  height: (x: number, z: number) => number;
  /** Colour at a point (writes into `out`). */
  colour: (x: number, z: number, y: number, out: Color) => void;
  material?: MeshStandardMaterial;
}

export function buildTerrain(o: TerrainOpts, scratch: Color): Mesh {
  const geo = new PlaneGeometry(o.size, o.size, o.segments, o.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = o.height(x, z);
    pos.setY(i, y);
    o.colour(x, z, y, scratch);
    cols[i * 3] = scratch.r;
    cols[i * 3 + 1] = scratch.g;
    cols[i * 3 + 2] = scratch.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mat = o.material ?? new MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  mat.vertexColors = true;
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
