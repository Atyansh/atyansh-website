#!/usr/bin/env node

/**
 * The Block — screenshot + FPS harness (see docs/WORLD_DESIGN_BRIEF.md §10)
 *
 * Serves the built site, opens /world headless, captures the fixed camera
 * bookmarks plus a player-view shot, then runs the scripted walk loop and
 * reports frame-time stats.
 *
 * Usage:
 *   node scripts/world-shots.cjs [--out shots/] [--skip-fps]
 * Requires a fresh `npx astro build` (serves ./dist via astro preview).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'world-shots';
const SKIP_FPS = process.argv.includes('--skip-fps');
const PORT = 4407;

async function waitFor(fn, ms, what) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > ms) throw new Error(`timeout waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const preview = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    stdio: 'ignore', detached: false,
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--use-gl=angle', '--enable-webgl', '--window-size=1600,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text().slice(0, 200));
    });

    await waitFor(async () => {
      try {
        const r = await fetch(`http://localhost:${PORT}/world/`);
        return r.ok;
      } catch { return false; }
    }, 20000, 'preview server');

    await page.goto(`http://localhost:${PORT}/world/`, { waitUntil: 'networkidle0', timeout: 60000 });
    await waitFor(
      () => page.evaluate(() => Boolean(window.__world && window.__world.ready)),
      30000, 'world boot',
    );
    // Let shaders compile / first frames settle; hide HUD for clean shots
    await page.evaluate(() => window.__world.hideHud());
    await new Promise((r) => setTimeout(r, 3500));

    const bookmarks = await page.evaluate(() => window.__world.bookmarks);
    for (const name of [...bookmarks, 'player']) {
      await page.evaluate((n) => window.__world.snap(n), name);
      await new Promise((r) => setTimeout(r, 400));
      const file = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: file });
      console.log('shot:', file);
    }
    await page.evaluate(() => window.__world.snap('player'));

    if (!SKIP_FPS) {
      console.log('fps probe: 30s scripted walk...');
      await page.evaluate(() => {
        window.__world.resetStats();
        window.__world.autowalk(true);
      });
      await new Promise((r) => setTimeout(r, 30000));
      const stats = await page.evaluate(() => {
        window.__world.stopwalk();
        return window.__world.stats();
      });
      const medianFps = stats.median > 0 ? (1000 / stats.median).toFixed(1) : '?';
      const p99Fps = stats.p99 > 0 ? (1000 / stats.p99).toFixed(1) : '?';
      console.log(`frames=${stats.frames} median=${stats.median.toFixed(2)}ms (${medianFps} fps) ` +
        `p99=${stats.p99.toFixed(2)}ms (${p99Fps} fps)`);
      // A shot mid-walk from the follow camera
      await page.screenshot({ path: path.join(OUT, 'walk-end.png') });
    }
  } finally {
    await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
