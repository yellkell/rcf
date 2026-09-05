/**
 * THE ROUND — what phase the game is in, locally.
 *
 * HIDE: you have your robot, the tray and the wheel; you paint, pose and
 * place it. SEEK: you have the gun and five shots; the tray and the wheel
 * are gone. The room clock (Firestore, rooms/{code}.phase) will drive this;
 * until then the tray's PLAY button and the dev window flip it.
 */

export type Phase = 'hide' | 'seek';

export const game = {
  phase: 'hide' as Phase,
  /** Bumped on every phase change. */
  version: 1,
};

const listeners = new Set<(p: Phase) => void>();

export function setPhase(p: Phase): void {
  if (game.phase === p) return;
  game.phase = p;
  game.version += 1;
  for (const l of listeners) l(p);
}

export function onPhase(l: (p: Phase) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
