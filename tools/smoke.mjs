// App smoke: boot the real page headless (no XR session: the world still
// runs), then drive every verb through the __rcf dev window — the place
// loads, the robot exists, poses tween, paint packs and bakes, the step
// moves the rig — and fail on any page error. `npm run smoke`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 5196;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
};
try {
  await wait(2500);
  const browser = await chromium.launch({ executablePath: process.env.RCF_CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__rcf?.companion?.robot, null, { timeout: 90000 });
  await wait(1500); // a few frames
  const r = await page.evaluate(async () => {
    const h = window.__rcf;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    out.place = h.env.current();
    out.spawnY = h.world.player.position.y;
    const robot = h.companion.robot;
    out.robotShells = robot.shells.length;
    out.robotAtStart = robot.root.position.toArray().map((n) => +n.toFixed(2));
    // Poses tween: bodyY moves toward the lie pose.
    const y0 = robot.body.position.y;
    h.companion.setPose('lie');
    await sleep(900);
    out.bodyYStand = +y0.toFixed(3);
    out.bodyYLie = +robot.body.position.y.toFixed(3);
    out.poseId = h.companion.poseId;
    out.following = h.companion.following;
    // Paint: demo bakes; the wire roundtrips; the hand places and lifts.
    h.paint.demo();
    out.count = h.paint.count();
    const wire = h.paint.pack();
    out.wireLen = wire.length;
    out.roundtrip = h.paint.packLook(h.paint.unpack(wire)) === wire;
    h.paint.take('dot', 30);
    out.held = !!h.paint.held();
    out.placed = h.paint.place('head', 0.25, 0.4);
    out.countAfterPlace = h.paint.count();
    out.lifted = h.paint.lift('head', 0.25, 0.4);
    h.paint.ret();
    out.countAfterLift = h.paint.count();
    await sleep(300);
    const mantle = robot.shells[0];
    out.mapInstalled = !!mantle.material.map;
    // The step: the dev verb moves the rig onto the floor at (2, 2).
    h.move.go(2, 2, 0);
    await sleep(100);
    out.after = h.world.player.position.toArray().map((n) => +n.toFixed(2));
    // Follow: the robot walks toward its station after the move.
    h.companion.follow();
    await sleep(2500);
    out.robotAfter = robot.root.position.toArray().map((n) => +n.toFixed(2));
    out.dist = +Math.hypot(out.robotAfter[0] - out.after[0], out.robotAfter[2] - out.after[2]).toFixed(2);
    h.paint.clear();
    // The gun: five shots. Aim at the robot's body: found on the first,
    // then four misses into the world, then empty.
    h.setPhase('seek');
    await sleep(100);
    const bp = { x: 0, y: 0, z: 0 };
    { const v = robot.body.getWorldPosition(robot.body.position.clone()); bp.x = v.x; bp.y = v.y; bp.z = v.z; }
    // No XR head off-device, so the probe supplies the muzzle: a metre
    // above and behind the robot.
    const from = [bp.x, bp.y + 1.0, bp.z + 1.2];
    out.shot1 = h.gun.fireAt(bp.x, bp.y, bp.z, from);
    out.foundAfter = h.companion.found;
    for (const k of [2, 3, 4, 5, 6]) {
      await sleep(450);
      out['shot' + k] = h.gun.fireAt(bp.x + 0.5, -5, bp.z + 1.5, from); // into the lawn
    }
    out.shotsLeft = h.gun.shots;
    h.setPhase('hide');
    await sleep(100);
    out.revived = !h.companion.found;
    out.reloaded = h.gun.shots;
    return out;
  });
  console.log(JSON.stringify(r));
  check(r.place === 'garden', 'the garden loaded');
  check(r.robotShells === 10, `robot has ${r.robotShells} paint shells`);
  check(r.bodyYLie < r.bodyYStand - 0.05 && r.poseId === 'lie', 'LIE pose tweened the body down');
  check(r.count === 12 && r.roundtrip && r.wireLen > 0, 'demo look packs and roundtrips the wire');
  check(r.held && r.placed && r.countAfterPlace === 13 && r.lifted && r.countAfterLift === 12, 'hand takes, places and lifts');
  check(r.mapInstalled, 'the bake installed the map');
  check(Math.abs(r.after[0] - 2) < 0.5 && Math.abs(r.after[2] - 2) < 0.5, 'the step moved the rig');
  check(r.dist > 0.3 && r.dist < 2.0, `the robot walked to station (${r.dist} m from the head)`);
  check(r.shot1 === 'robot' && r.foundAfter === true, 'a shot on the robot finds it');
  check(r.shot2 === 'world' && r.shot5 === 'world' && r.shot6 === 'empty' && r.shotsLeft === 0, 'five shots, then empty');
  check(r.revived && r.reloaded === 5, 'back to hiding revives the robot and reloads');
  check(errors.length === 0, errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
} finally {
  server.kill();
  process.exit(failed ? 1 : 0);
}
