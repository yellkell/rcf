/**
 * The sky kit: a gradient dome (ff2's desert/saltflats sky, generalised),
 * a sun disc with a halo, and soft cloud sprites. One draw each.
 */

import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  Vector3,
} from 'three';
import { makeRng } from './paper.js';
import { softSprite } from './skins.js';

export interface SkyColours {
  zenith: number;
  horizon: number;
  /** The band right at the horizon, hottest toward the sun. */
  glow: number;
  ground: number;
}

/**
 * An inward-facing dome, radius `r`, shaded zenith → horizon → glow with a
 * warm bias toward `sunDir`. Drawn first, never writes depth, never culls.
 */
export function skyDome(c: SkyColours, sunDir: Vector3, r = 300): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new Color(c.zenith) },
      horizon: { value: new Color(c.horizon) },
      glow: { value: new Color(c.glow) },
      ground: { value: new Color(c.ground) },
      sun: { value: sunDir.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 zenith, horizon, glow, ground, sun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        float toSun = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(sun.x, 0.0, sun.z))));
        float band = exp(-max(h, 0.0) * 9.0) * (0.55 + 0.45 * toSun * toSun);
        vec3 sky = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
        sky = mix(sky, glow, band * 0.75);
        vec3 col = h < 0.0 ? mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0)) : sky;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new Mesh(new SphereGeometry(r, 32, 18), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

/** The sun: a hot disc and a soft halo, parked far out along `dir`. */
export function sunDisc(dir: Vector3, colour = 0xfff1c8, dist = 260, size = 10): Group {
  const g = new Group();
  const d = dir.clone().normalize();
  const disc = new Mesh(new SphereGeometry(size * 0.5, 16, 12), new MeshBasicMaterial({ color: colour, fog: false, toneMapped: false }));
  disc.position.copy(d).multiplyScalar(dist);
  g.add(disc);
  const halo = new Sprite(softSprite(colour, 0.5));
  halo.material.blending = AdditiveBlending;
  halo.material.fog = false;
  halo.scale.setScalar(size * 5);
  halo.position.copy(d).multiplyScalar(dist * 0.98);
  g.add(halo);
  return g;
}

/** A scatter of soft cloud puffs around the horizon. */
export function clouds(count: number, seed: number, colour = 0xfff6ea, yMin = 40, yMax = 110, rMin = 140, rMax = 220): Group {
  const g = new Group();
  const rng = makeRng(seed);
  const mat = softSprite(colour, 0.6);
  mat.fog = false;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = rMin + rng() * (rMax - rMin);
    const y = yMin + rng() * (yMax - yMin);
    const puffs = 2 + Math.floor(rng() * 4);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    for (let p = 0; p < puffs; p++) {
      const s = new Sprite(mat);
      const w = 18 + rng() * 26;
      s.scale.set(w, w * (0.45 + rng() * 0.25), 1);
      s.position.set(cx + (rng() - 0.5) * 40, y + (rng() - 0.5) * 8, cz + (rng() - 0.5) * 40);
      g.add(s);
    }
  }
  return g;
}
