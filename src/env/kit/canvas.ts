/**
 * The canvas painter — draw a texture with the 2D API, get a tiling
 * CanvasTexture back (FIRE FIGHT 2's pub/textures.ts, the one function
 * every surface painter in that repo is built on).
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number] = [1, 1],
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

/** A matching grey bump map painted by the same callback (draw heights as
 *  greys); linear colour space, tiling. */
export function makeBumpTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number] = [1, 1],
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}
