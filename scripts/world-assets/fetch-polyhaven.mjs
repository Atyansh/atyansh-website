#!/usr/bin/env node
/**
 * The Block — environment asset build (all Poly Haven, CC0).
 *
 * Downloads sources into .cache/world-src/ph/ (cached; re-runs are offline)
 * and writes optimized runtime assets to public/world/assets/:
 *   props/<id>.glb   meshopt geometry, WebP textures ≤1024, simplified if heavy
 *   tex/<id>_{diff,nor,arm}.webp   PBR sets (ARM = AO/rough/metal, three-native)
 *   sky/<id>.hdr     1k HDR for image-based lighting + sun extraction
 *   sky/<id>_bg.jpg  upper hemisphere of the tonemapped 8k JPG, 4096x1024
 *
 * Usage: node scripts/world-assets/fetch-polyhaven.mjs [models|textures|skies]
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const CACHE = '.cache/world-src/ph';
const OUT = 'public/world/assets';

export const MODELS = [
  // street + exterior
  'street_lamp_01', 'painted_wooden_bench',
  'fire_hydrant', 'metal_trash_can', 'trashbag', 'utility_box_01', 'power_box_01',
  'exterior_aircon_unit', 'modular_fire_escape', 'covered_car', 'concrete_road_barrier', 'rollershutter_door', 'security_light', 'wooden_crate_01', 'plastic_crate_01',
  // park 'wooden_picnic_table', 'concrete_cat_statue',
  'tree_stump_01', 'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'flower_gazania',
  'periwinkle_plant',
  // interiors
  'Sofa_01', 'sofa_02', 'sofa_03', 'ArmChair_01', 'mid_century_lounge_chair', 'modern_arm_chair_01',
  'CoffeeTable_01', 'modern_coffee_table_01', 'side_table_01',
  'bar_chair_round_01', 'Television_01', 'television_02', 'gaming_console',
  'CashRegister_01', 'CoffeeCart_01',
  'desk_lamp_arm_01', 'classic_laptop', 'metal_office_desk', 'modern_ceiling_lamp_01',
  'hanging_industrial_lamp', 'boombox',
  'cassette_player', 'wall_clock', 'WetFloorSign_01', 'ceiling_fan', 'outdoor_table_chair_set_01',
];

// [id, resolution]
export const TEXTURES = [
  ['asphalt_02', '2k'], ['concrete_tiles_02', '2k'], ['brushed_concrete', '1k'],
  ['brick_wall_02', '2k'], ['red_brick_03', '1k'], ['brick_wall_001', '1k'], ['painted_brick', '1k'],
  ['painted_plaster_wall', '1k'], ['white_stucco_02', '1k'], ['concrete_block_wall', '1k'],
  ['corrugated_iron_02', '1k'], ['painted_metal_shutter', '1k'], ['rectangular_facade_tiles', '1k'],
  ['asphalt_floor', '1k'], ['wood_floor', '1k'], ['wood_floor_worn', '1k'], ['old_wood_floor', '1k'],
  ['terrazzo_tiles', '1k'], ['marble_tiles', '1k'], ['floor_tiles_06', '1k'], ['rubber_tiles', '1k'],
  ['plywood', '1k'], ['leafy_grass', '1k'], ['gravel_floor', '1k'], ['park_dirt', '1k'],
  ['bark_brown_01', '1k'],
];

export const SKIES = [
  'kloofendal_48d_partly_cloudy_puresky', 'qwantani_sunset_puresky',
  'qwantani_dusk_2_puresky', 'qwantani_night_puresky',
];

// Geometry budget per prop; heavier meshes are simplified toward it.
// Street furniture repeats dozens of times, so it gets a much tighter budget.
const TRI_BUDGET = 24000;
const BUDGETS = {
  concrete_road_barrier: 700, street_lamp_01: 3500, street_lamp_02: 3000, fire_hydrant: 5000,
  covered_car: 5000, metal_trash_can: 5000, painted_wooden_bench: 1500, modular_street_seating: 6000,
  power_box_01: 5000, utility_box_01: 3000, exterior_aircon_unit: 5000, planter_box_01: 4000,
  wooden_picnic_table: 5000, outdoor_table_chair_set_01: 5000, tree_stump_01: 6000, shrub_01: 8000,
  shrub_02: 8000, shrub_04: 8000, periwinkle_plant: 8000, grass_medium_01: 8000, flower_gazania: 8000,
  potted_plant_01: 14000, potted_plant_02: 14000, gaming_console: 6000, filmstrip_projector_8mm: 8000,
  book_encyclopedia_set_01: 10000, desk_lamp_arm_01: 6000, CoffeeCart_01: 12000, bar_chair_round_01: 6000,
  plastic_crate_01: 5000, ceiling_fan: 6000, mounted_fluorescent_lights: 4000, classic_laptop: 6000,
};

async function api(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!r.ok) throw new Error(`${id}: api ${r.status}`);
  return r.json();
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

function triCount(doc) {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return Math.round(t);
}

async function buildModels(io) {
  fs.mkdirSync(path.join(OUT, 'props'), { recursive: true });
  const report = [];
  for (const id of MODELS) {
    try {
      const files = await api(id);
      const g = files.gltf['1k'].gltf;
      const dir = path.join(CACHE, 'models', id);
      const main = await download(g.url, path.join(dir, path.basename(new URL(g.url).pathname)));
      for (const [rel, inc] of Object.entries(g.include ?? {})) await download(inc.url, path.join(dir, rel));
      const doc = await io.read(main);
      const before = triCount(doc);
      const budget = BUDGETS[id] ?? TRI_BUDGET;
      const ops = [dedup(), weld()];
      if (before > budget) {
        ops.push(simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.01, lockBorder: false }));
      }
      ops.push(
        prune(),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
        quantize(),
        meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
      );
      await doc.transform(...ops);
      const out = path.join(OUT, 'props', `${id}.glb`);
      await io.write(out, doc);
      const line = `${id.padEnd(28)} ${String(before).padStart(7)} → ${String(triCount(doc)).padStart(6)} tris  ${(fs.statSync(out).size / 1e6).toFixed(2)}MB`;
      report.push(line);
      console.log(line);
    } catch (e) {
      console.log(`${id.padEnd(28)} FAILED ${e.message}`);
    }
  }
  return report;
}

async function buildTextures() {
  fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });
  for (const [id, res] of TEXTURES) {
    try {
      const files = await api(id);
      const maps = { diff: files.Diffuse ?? files.diffuse, nor: files.nor_gl, arm: files.arm };
      for (const [k, m] of Object.entries(maps)) {
        const src = m?.[res]?.jpg ?? m?.[res]?.png;
        if (!src) { console.log(`  ${id} missing ${k}`); continue; }
        const f = await download(src.url, path.join(CACHE, 'tex', id, `${k}_${res}.${src.url.split('.').pop()}`));
        await sharp(f).webp({ quality: k === 'nor' ? 90 : 82 }).toFile(path.join(OUT, 'tex', `${id}_${k}.webp`));
      }
      console.log(`tex ${id} (${res})`);
    } catch (e) {
      console.log(`tex ${id} FAILED ${e.message}`);
    }
  }
}

async function buildSkies() {
  fs.mkdirSync(path.join(OUT, 'sky'), { recursive: true });
  for (const id of SKIES) {
    const files = await api(id);
    await download(files.hdri['1k'].hdr.url, path.join(OUT, 'sky', `${id}.hdr`));
    const tm = await download(files.tonemapped.url, path.join(CACHE, 'sky', `${id}_tonemapped.jpg`));
    const meta = await sharp(tm).metadata();
    // Upper hemisphere only — the city hides everything below the horizon
    await sharp(tm, { limitInputPixels: false })
      .extract({ left: 0, top: 0, width: meta.width, height: Math.floor(meta.height / 2) })
      .resize(4096, 1024)
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(OUT, 'sky', `${id}_bg.jpg`));
    console.log(`sky ${id}`);
  }
}

async function main() {
  const which = process.argv[2];
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  if (!which || which === 'skies') await buildSkies();
  if (!which || which === 'textures') await buildTextures();
  if (!which || which === 'models') await buildModels(io);
}

main().catch((e) => { console.error(e); process.exit(1); });
