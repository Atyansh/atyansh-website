#!/usr/bin/env node
/**
 * People for The Block: Microsoft Rocketbox avatars (MIT licence,
 * https://github.com/microsoft/Microsoft-Rocketbox) converted to GLB.
 *
 *  1. download each avatar's FBX + TGA textures (git LFS via github.com/raw)
 *  2. convert in headless Chrome with three's FBXLoader → GLTFExporter
 *     (no FBX SDK on arm64 macs), renaming the 3ds Max Biped bones to the
 *     game's UE-style names so every bone lookup in the game keeps working
 *  3. compress with gltf-transform (webp textures, meshopt geometry)
 *
 * Clips are retargeted separately (retarget-rocketbox.mjs).
 *
 *   node scripts/world-assets/build-rocketbox.mjs [Name …]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { dedup, prune, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const SRC = '.cache/world-src/rocketbox';
const OUT = 'public/world/assets/characters/rb';
const RAW = '.cache/world-src/rocketbox/raw';

/** Avatars shipped with the game: id → [rocketbox name, texture size] */
export const CAST = {
  // player wardrobe (full-res faces)
  p_hoodie: ['Male_Adult_17', 1024],
  p_track: ['Male_Adult_10', 1024],
  p_henley: ['Male_Adult_06', 1024],
  p_denim: ['Male_Adult_12', 1024],
  p_tee: ['Male_Adult_16', 1024],
  p_jacket: ['Male_Adult_07', 1024],
  p_shirt: ['Male_Adult_08', 1024],
  p_black: ['Male_Adult_11', 1024],
  // street + staff
  m01: ['Male_Adult_01', 512], m02: ['Male_Adult_02', 512], m03: ['Male_Adult_03', 512], m04: ['Male_Adult_04', 512],
  m05: ['Male_Adult_05', 512], m09: ['Male_Adult_09', 512], m13: ['Male_Adult_13', 512], m14: ['Male_Adult_14', 512],
  m18: ['Male_Adult_18', 512], m20: ['Male_Adult_20', 512],
  f01: ['Female_Adult_01', 512], f02: ['Female_Adult_02', 512], f03: ['Female_Adult_03', 512], f04: ['Female_Adult_04', 512],
  f05: ['Female_Adult_05', 512], f07: ['Female_Adult_07', 512], f08: ['Female_Adult_08', 512], f09: ['Female_Adult_09', 512],
  f11: ['Female_Adult_11', 512], f12: ['Female_Adult_12', 512], f13: ['Female_Adult_13', 512], f14: ['Female_Adult_14', 512],
  f15: ['Female_Adult_15', 512], f17: ['Female_Adult_17', 512],
};

const BASE = 'https://github.com/microsoft/Microsoft-Rocketbox/raw/master/Assets/Avatars/Adults';

function download(name) {
  const dir = path.join(SRC, name);
  fs.mkdirSync(dir, { recursive: true });
  const fbx = path.join(dir, `${name}.fbx`);
  if (!fs.existsSync(fbx)) execFileSync('curl', ['-sfL', '-o', fbx, `${BASE}/${name}/Export/${name}.fbx`]);
  const list = JSON.parse(execFileSync('gh', ['api', `repos/microsoft/Microsoft-Rocketbox/contents/Assets/Avatars/Adults/${name}/Textures`]).toString());
  for (const t of list) {
    if (/specular/i.test(t.name)) continue; // roughness comes from a constant
    const f = path.join(dir, t.name);
    if (!fs.existsSync(f) || fs.statSync(f).size !== t.size) execFileSync('curl', ['-sfL', '-o', f, `${BASE}/${name}/Textures/${encodeURIComponent(t.name)}`]);
  }
  return dir;
}

const PAGE = /* html */ `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const SIDE = { L: 'l', R: 'r' };
const FING = ['thumb', 'index', 'middle', 'ring', 'pinky'];
function rename(n) {
  const s = n.replace(/_/g, ' ').replace(/^.*?(Bip01)/, '$1');
  if (s === 'Bip01') return 'pelvis';
  if (s === 'Bip01 Pelvis') return 'hips';
  let m;
  if ((m = s.match(/^Bip01 Spine(\\d?)$/))) return ['spine_01', 'spine_02', 'spine_03', 'spine_04'][m[1] === '' ? 0 : +m[1]];
  if (s === 'Bip01 Neck') return 'neck_01';
  if (s === 'Bip01 Head') return 'Head';
  if ((m = s.match(/^Bip01 ([LR]) (Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0)$/))) {
    const k = { Clavicle: 'clavicle', UpperArm: 'upperarm', Forearm: 'lowerarm', Hand: 'hand', Thigh: 'thigh', Calf: 'calf', Foot: 'foot', Toe0: 'ball' }[m[2]];
    return k + '_' + SIDE[m[1]];
  }
  if ((m = s.match(/^Bip01 ([LR]) Finger(\\d)(\\d?)$/))) return FING[+m[2]] + '_0' + (m[3] === '' ? 1 : +m[3] + 1) + '_' + SIDE[m[1]];
  return n.replace(/[^A-Za-z0-9_]/g, '_');
}

/** TGA DataTexture (row 0 = v 0) → canvas texture in normal image orientation */
const canv = new Map();
function toCanvas(t) {
  if (!t || !t.image || !t.image.data) return t;
  if (canv.has(t)) return canv.get(t);
  const { width: w, height: h, data } = t.image;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const rowFlip = t.flipY ? false : true;
  for (let y = 0; y < h; y++) {
    const sy = rowFlip ? h - 1 - y : y;
    img.data.set(data.subarray(sy * w * 4, (sy + 1) * w * 4), y * w * 4);
  }
  g.putImageData(img, 0, 0);
  const ct = new THREE.CanvasTexture(c);
  ct.name = t.name; ct.wrapS = t.wrapS; ct.wrapT = t.wrapT; ct.flipY = true;
  canv.set(t, ct);
  return ct;
}

window.convert = async (name) => {
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\\.tga$/i, new TGALoader(manager));
  const loader = new FBXLoader(manager);
  loader.setResourcePath('/src/' + name + '/');
  const done = new Promise((r) => { manager.onLoad = r; });
  const fbx = await loader.loadAsync('/src/' + name + '/' + name + '.fbx');
  await done; // textures finish after the FBX itself
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 20));
  const report = { meshes: [], bones: 0, mats: [] };
  fbx.traverse((o) => {
    if (o.isBone) { o.name = rename(o.name); report.bones++; }
  });
  // world height → metres
  fbx.updateMatrixWorld(true);
  let box = new THREE.Box3();
  fbx.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox?.(); box.union(new THREE.Box3().setFromObject(o, true)); } });
  const h = box.max.y - box.min.y;
  const s = h > 10 ? 0.01 : 1;
  fbx.scale.multiplyScalar(s);
  fbx.animations = [];
  const texs = new Map();
  fbx.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      report.mats.push({ name: m.name, map: m.map?.name || m.map?.image?.src || !!m.map, alpha: !!m.alphaMap, normal: !!m.normalMap, transparent: m.transparent, opacity: m.opacity });
      const opac = /opacity|hair|lash|transp/i.test(m.name) || (m.map && /opacity/i.test(m.map.name || ''));
      const n = new THREE.MeshStandardMaterial({
        name: m.name, map: m.map || null, normalMap: m.normalMap || null, color: 0xffffff,
        roughness: /head|face/i.test(m.name) ? 0.62 : 0.8, metalness: 0,
        alphaTest: opac ? 0.45 : 0, transparent: false, side: opac ? THREE.DoubleSide : THREE.FrontSide,
      });
      for (const k of ['map', 'normalMap']) n[k] = toCanvas(n[k]);
      for (const k of ['map', 'normalMap']) if (n[k] && !(n[k].image && (n[k].image.data || n[k].image.width))) n[k] = null;
      if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
      return n;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
    report.meshes.push({ name: o.name, skinned: !!o.isSkinnedMesh, verts: o.geometry.attributes.position.count, groups: o.geometry.groups.length });
  });
  const exp = new GLTFExporter();
  const glb = await exp.parseAsync(fbx, { binary: true, onlyVisible: false, maxTextureSize: 2048 });
  const b = new Uint8Array(glb);
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return { glb: btoa(bin), report, height: h * s };
};
window.ready = true;
</script>`;

async function main() {
  const want = process.argv.slice(2);
  const ids = Object.entries(CAST).filter(([id, [n]]) => !want.length || want.includes(id) || want.includes(n));
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });
  for (const [, [name]] of ids) { process.stdout.write(`download ${name}\n`); download(name); }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-web-security'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warn') && !/404/.test(m.text())) console.log('[page]', m.text()); });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.hostname !== 'rb.local') return req.continue();
    if (u.pathname === '/') return req.respond({ contentType: 'text/html', body: PAGE });
    let f = null;
    if (u.pathname.startsWith('/three/')) f = path.join('node_modules/three', u.pathname.slice(7));
    else if (u.pathname.startsWith('/src/')) f = path.join(SRC, decodeURIComponent(u.pathname.slice(5)));
    if (f && !fs.existsSync(f)) {
      // FBX paths sometimes differ in case / extension from the shipped files
      const dir = path.dirname(f);
      const base = path.basename(f).toLowerCase();
      const hit = fs.existsSync(dir) && fs.readdirSync(dir).find((x) => x.toLowerCase() === base);
      f = hit ? path.join(dir, hit) : null;
    }
    if (!f) { if (!/specular/i.test(u.pathname)) console.log('  404', u.pathname); return req.respond({ status: 404, body: '' }); }
    const type = f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    req.respond({ contentType: type, body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('http://rb.local/');
  await page.waitForFunction('window.ready === true');

  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  for (const [id, [name, size]] of ids) {
    const r = await page.evaluate((n) => window.convert(n), name);
    const raw = path.join(RAW, `${id}.glb`);
    fs.writeFileSync(raw, Buffer.from(r.glb, 'base64'));
    const doc = await io.read(raw);
    await doc.transform(
      dedup(), prune(), weld(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const out = path.join(OUT, `${id}.glb`);
    await io.write(out, doc);
    console.log(`${id} ${name} h=${r.height.toFixed(2)} bones=${r.report.bones} ${(fs.statSync(out).size / 1e6).toFixed(2)}MB`, JSON.stringify(r.report.meshes), JSON.stringify(r.report.mats));
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
