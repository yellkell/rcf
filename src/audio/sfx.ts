/**
 * Tiny WebAudio sound kit — every sound synthesised at runtime, no files.
 * Lifted in shape from FIRE FIGHT 2's sfx.ts (tone + noise primitives), cut
 * to the few sounds this game needs: the step, the wheel, the servo of a
 * pose, the click of a placed unit.
 */

type Ctx = AudioContext & { _master?: GainNode };

let ctx: Ctx | null = null;

function getCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC() as Ctx;
    const master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
    ctx._master = master;
  }
  return ctx;
}

function unlock(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'click', 'keydown', 'touchstart']) {
    window.addEventListener(ev, unlock, { capture: true });
  }
}

/** Call from a user gesture to make sure audio is live. */
export function ensureAudio(): void {
  unlock();
}

function ready(): Ctx | null {
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') void c.resume();
  return c.state === 'running' ? c : null;
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
}

function tone(o: ToneOpts): void {
  const c = ready();
  if (!c) return;
  const { freq, to, type = 'sine', dur = 0.12, gain = 0.2, delay = 0 } = o;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c._master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur: number, gain: number, fromHz: number, toHz: number, delay = 0): void {
  const c = ready();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(fromHz, t0);
  f.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c._master!);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** A soft UI tick — the wheel's hover, a menu click. */
export function uiClick(): void {
  tone({ freq: 1400, to: 900, type: 'triangle', dur: 0.05, gain: 0.12 });
}

/** The step: a low thump under a short hiss, the blink of a teleport. */
export function step(): void {
  noise(0.12, 0.16, 1800, 300);
  tone({ freq: 140, to: 60, type: 'sine', dur: 0.14, gain: 0.18 });
}

/** A servo: the companion changing pose. */
export function servo(dur = 0.35): void {
  tone({ freq: 620, to: 880, type: 'sawtooth', dur, gain: 0.05 });
  tone({ freq: 310, to: 440, type: 'square', dur, gain: 0.02 });
}

/** A footstep of a very small robot. */
export function footstep(): void {
  tone({ freq: 900, to: 300, type: 'triangle', dur: 0.03, gain: 0.05 });
}

/** Paint landing: a wet click. */
export function paintPlace(): void {
  noise(0.06, 0.12, 2400, 900);
  tone({ freq: 700, to: 500, type: 'sine', dur: 0.06, gain: 0.1 });
}

/** Paint lifted back into the hand. */
export function paintLift(): void {
  tone({ freq: 500, to: 800, type: 'sine', dur: 0.07, gain: 0.1 });
}

/** The magnet: the companion sticking to a wall. */
export function stick(): void {
  tone({ freq: 220, to: 180, type: 'square', dur: 0.09, gain: 0.08 });
  noise(0.05, 0.1, 3000, 1200);
}

/** Picked up / put down. */
export function grab(): void {
  tone({ freq: 400, to: 560, type: 'triangle', dur: 0.06, gain: 0.08 });
}
export function drop(): void {
  tone({ freq: 560, to: 380, type: 'triangle', dur: 0.06, gain: 0.08 });
}

/** The gun: a sharp crack over a low thump. */
export function shot(): void {
  noise(0.09, 0.32, 3600, 700);
  tone({ freq: 180, to: 50, type: 'square', dur: 0.12, gain: 0.16 });
}

/** Empty: a dry click. */
export function dryFire(): void {
  tone({ freq: 2200, to: 1400, type: 'square', dur: 0.025, gain: 0.08 });
}

/** A find: a rising two-note sting. */
export function found(): void {
  tone({ freq: 520, to: 780, type: 'triangle', dur: 0.12, gain: 0.16 });
  tone({ freq: 780, to: 1040, type: 'triangle', dur: 0.2, gain: 0.14, delay: 0.1 });
}

/** A miss landing on the world: a dull chip. */
export function ricochet(): void {
  noise(0.05, 0.12, 2000, 5000);
  tone({ freq: 900, to: 300, type: 'sine', dur: 0.05, gain: 0.05 });
}
