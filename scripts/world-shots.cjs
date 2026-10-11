#!/usr/bin/env node
/**
 * The Block — screenshot / scenario harness.
 *
 *   node scripts/world-shots.cjs <scenario.cjs> [--url http://localhost:4321/world] [--out dir]
 *
 * A scenario module exports `async (api) => {}` where api provides:
 *   page, w(fn, ...args)  (evaluate against window.__world),
 *   shot(name), wait(ms), key(code, ms) (hold a key), log(...)
 * Console errors / page errors are collected and printed at the end.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const args = process.argv.slice(2);
  const scenarioPath = path.resolve(args[0]);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const url = opt('--url', process.env.WORLD_URL || 'http://localhost:4322/world');
  const out = path.resolve(opt('--out', '.cache/shots'));
  const width = +opt('--w', 1600);
  const height = +opt('--h', 900);
  fs.mkdirSync(out, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', `--window-size=${width},${height}`],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|THREE.WebGLProgram/.test(m.text()))) errors.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__world && window.__world.ready', { timeout: 180000 });
    console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const api = {
      page,
      w: (fn, ...a) => page.evaluate(fn, ...a),
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      shot: async (name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log(`shot ${name}`); },
      key: async (code, ms) => { await page.keyboard.down(code); await new Promise((r) => setTimeout(r, ms)); await page.keyboard.up(code); },
      log: (...a) => console.log(...a),
    };
    await require(scenarioPath)(api);
  } catch (e) {
    errors.push(`[harness] ${e.stack || e}`);
  } finally {
    if (errors.length) console.log(`--- ${errors.length} console issue(s):\n${[...new Set(errors)].slice(0, 25).join('\n')}`);
    await browser.close();
  }
})();
