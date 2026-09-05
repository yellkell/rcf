// Headless screenshots of every place, from a few viewpoints, with the
// robot in a few poses — for looking at the work. `npm run shots`.
// Boots the Vite dev server itself; writes tools/shots/*.png.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 5199;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('tools/shots', { recursive: true });

const views = [
  ['garden-spawn', 'place=garden'],
  ['garden-tree', 'place=garden&x=2&z=3&yaw=0.9&pitch=-0.05'],
  ['garden-greenhouse', 'place=garden&x=0&z=-1&yaw=-0.5&pitch=-0.05&rx=1.4&rz=-3.2&pose=periscope'],
  ['garden-pond', 'place=garden&x=0.5&z=2&yaw=-1.0&pitch=-0.2&rx=1.9&rz=0.2&pose=lie'],
  ['garden-bench', 'place=garden&x=-1&z=2.6&yaw=1.0&pitch=-0.15&rx=-2.8&rz=4.1&pose=crouch'],
  ['robot-closeup', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.3&rx=-0.8&rz=2.2&ry=3.4&pose=stand'],
  ['robot-lie', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.35&rx=-0.8&rz=2.2&ry=2.4&pose=lie'],
  ['robot-crouch', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.3&rx=-0.8&rz=2.2&ry=3.4&pose=crouch'],
  ['robot-periscope', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.2&rx=-0.8&rz=2.2&ry=3.4&pose=periscope'],
  ['robot-flatten', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.35&rx=-0.8&rz=2.2&ry=2.6&pose=flatten'],
  ['robot-sit', 'place=garden&x=-0.8&y=0.8&z=3.3&yaw=0&pitch=-0.35&rx=-0.8&rz=2.2&ry=3.4&pose=sit'],
];

try {
  await wait(2500);
  const browser = await chromium.launch({ executablePath: process.env.RCF_CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  for (const [name, params] of views) {
    await page.goto(`http://localhost:${PORT}/env-preview.html?${params}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    const stats = await page.evaluate(() => window.__stats);
    await page.screenshot({ path: `tools/shots/${name}.png` });
    console.log(`${name}: ${stats.calls} draws, ${stats.tris} tris`);
  }
  await browser.close();
  if (errors.length) {
    console.error('page errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
} finally {
  server.kill();
}
