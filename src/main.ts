/**
 * ROBOT CUTTLEFISH — entry point.
 *
 * Boots an IWSDK World as a full immersive-VR session: the places are
 * opaque and painted, your real floor is y = 0 (local-floor reference
 * space), and you are a head and two hands with a little robot in front
 * of you. `npm run dev` and open the page: a headset offers ENTER VR; on
 * desktop the IWSDK dev plugin provides a WebXR emulator (WASD + mouse).
 */

import { launchXR, SessionMode, World } from '@iwsdk/core';
import { ensureAudio } from './audio/sfx.js';
import { demoLook, myLook, setLook, clearLook, packLook, unpackLook, bay, handTake, handPlace, handLift, handReturn, myPackedLook } from './companion/paint.js';
import { FOVEATION } from './config.js';
import { CompanionSystem, companion } from './systems/CompanionSystem.js';
import { EnvironmentSystem, environmentView } from './systems/EnvironmentSystem.js';
import { PaintSystem, paintView } from './systems/PaintSystem.js';
import { GunSystem, gunView } from './systems/GunSystem.js';
import { game, setPhase } from './game/state.js';
import { TeleportSystem, teleportView } from './systems/TeleportSystem.js';

const container = document.getElementById('scene-container') as HTMLDivElement;
const enterButton = document.getElementById('enter-vr') as HTMLButtonElement | null;

enterButton?.setAttribute('disabled', '');

function hideLanding(): void {
  document.body.classList.add('app-entered');
}

function showLanding(): void {
  document.body.classList.remove('app-entered');
  enterButton?.removeAttribute('disabled');
}

World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'none',
  },
  // The step is our own (TeleportSystem); nothing is grabbed through the
  // SDK — the robot is picked up by proximity in CompanionSystem.
  features: {
    grabbing: false,
    locomotion: false,
    spatialUI: false,
  },
  render: {
    defaultLighting: false,
    far: 400,
    camera: { position: [0, 1.6, 0] },
  },
}).then(async (world) => {
  world.renderer.xr.setFoveation(FOVEATION);

  // Order: the place first (so floors exist), then the step, then the robot
  // (reads the floors and the player), then the paint (reads the robot).
  world.registerSystem(EnvironmentSystem);
  world.registerSystem(TeleportSystem);
  world.registerSystem(CompanionSystem);
  world.registerSystem(PaintSystem);
  world.registerSystem(GunSystem);

  // The dev window: every verb the controllers drive, headless (`__rcf`).
  (window as unknown as { __rcf: unknown }).__rcf = {
    world,
    move: teleportView,
    env: environmentView,
    companion,
    game,
    setPhase,
    gun: gunView,
    paint: {
      demo: () => setLook(demoLook()),
      clear: () => clearLook(),
      count: () => myLook().paint.length,
      set: setLook,
      pack: () => myPackedLook(),
      unpack: (w: unknown) => unpackLook(w),
      packLook,
      take: handTake,
      place: handPlace,
      lift: handLift,
      ret: handReturn,
      held: () => bay.held,
      view: paintView,
    },
  };

  const vrSupported = (await navigator.xr?.isSessionSupported(SessionMode.ImmersiveVR).catch(() => false)) === true;
  let sessionPoll = 0;

  const startXR = (): void => {
    enterButton?.setAttribute('disabled', '');
    ensureAudio();
    launchXR(world, { sessionMode: SessionMode.ImmersiveVR });
    // Poll on a TIMER: Quest Browser suspends window rAF while presenting.
    window.clearInterval(sessionPoll);
    sessionPoll = window.setInterval(() => {
      if (!world.session) return;
      window.clearInterval(sessionPoll);
      hideLanding();
      world.session.addEventListener('end', showLanding, { once: true });
      world.session.addEventListener('selectstart', ensureAudio);
      world.session.addEventListener('squeezestart', ensureAudio);
    }, 50);
    window.setTimeout(() => {
      if (!world.session) enterButton?.removeAttribute('disabled');
    }, 4000);
  };

  if (enterButton && vrSupported) {
    enterButton.removeAttribute('disabled');
    enterButton.addEventListener('click', startXR);
  } else if (enterButton) {
    enterButton.textContent = 'XR unavailable';
  }

  // A packaged immersive PWA launches behind the system splash and waits
  // for the content to start XR; enter directly there.
  const packaged = document.referrer.startsWith('android-app://') || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  if (packaged && vrSupported) startXR();

  // eslint-disable-next-line no-console
  console.info('[ROBOT CUTTLEFISH] World ready — the garden is open.');
});
