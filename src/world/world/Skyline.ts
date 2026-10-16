// Distant city: instanced towers beyond the playable streets so no
// sightline ends in void. Window UVs scale per instance (a window every
// ~3.5m regardless of tower size); two material families (masonry + glass)
// break up the silhouette. At night a seeded share of windows light up.

import * as THREE from 'three';
import { rng } from '../engine/math';
import type { NightLights } from './NightLights';
import { OUTER_FRONT } from './layout';

/** 8 bays × 16 floors per tile; tile = 28m × 56m */
const TILE_W = 28;
const TILE_H = 56;

function facadeTexture(kind: 'stone' | 'glass', lit: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'glass' ? (lit ? 31 : 32) : lit ? 3 : 2);
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 512);
  } else {
    g.fillStyle = kind === 'glass' ? '#4a5a6c' : '#d8d2c8';
    g.fillRect(0, 0, 256, 512);
  }
  for (let y = 0; y < 512; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      if (lit) {
        if (r() < 0.36) {
          g.fillStyle = r() < 0.7 ? '#ffd39a' : '#d6e6ff';
          if (kind === 'glass') g.fillRect(x + 1, y + 4, 30, 24);
          else g.fillRect(x + 8, y + 9, 16, 17);
        }
      } else if (kind === 'glass') {
        const v = 70 + Math.floor(r() * 50);
        g.fillStyle = `rgb(${v - 10},${v + 10},${v + 34})`;
        g.fillRect(x + 1, y + 4, 30, 24);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 1, y + 4, 30, 3);
      } else {
        const v = 38 + Math.floor(r() * 30);
        g.fillStyle = `rgb(${v},${v + 6},${v + 14})`;
        g.fillRect(x + 8, y + 9, 16, 17);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function towerMaterial(kind: 'stone' | 'glass', lights: NightLights): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: facadeTexture(kind, false),
    emissiveMap: facadeTexture(kind, true),
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: kind === 'glass' ? 0.25 : 0.85,
    metalness: kind === 'glass' ? 0.6 : 0.0,
    envMapIntensity: kind === 'glass' ? 1.4 : 0.8,
  });
  // UV = world size / tile size, using the per-instance scale
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float across = abs(normal.x) > 0.5 ? sc.z : sc.x;
        vec2 k = abs(normal.y) > 0.5 ? vec2(0.0) : vec2(across / ${TILE_W.toFixed(1)}, sc.y / ${TILE_H.toFixed(1)});
        #ifdef USE_MAP
          vMapUv = uv * k;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = uv * k;
        #endif
      #endif`);
  };
  m.onBeforeCompile = ((prev) => (sh: Parameters<NonNullable<THREE.Material['onBeforeCompile']>>[0], r: THREE.WebGLRenderer) => {
    prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.42, step(0.5, vUp));');
  })(m.onBeforeCompile);
  m.customProgramCacheKey = () => `tower-${kind}`;
  lights.register(m, 0, 1.3);
  return m;
}

export function buildSkyline(lights: NightLights): THREE.Group {
  const group = new THREE.Group();
  const r = rng(1234);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const lists: Record<'stone' | 'glass', THREE.Matrix4[]> = { stone: [], glass: [] };
  const m = new THREE.Matrix4();
  const placed: Array<{ x: number; z: number; r: number }> = [];
  // Mid ring: a street grid of mid-rise blocks filling the land between the
  // playable streets and the towers, leaving the four road corridors open.
  const roadX = [-55, 55];
  const roadZ = [-40, 40];
  for (let gx = -190; gx <= 190; gx += 26) {
    for (let gz = -170; gz <= 170; gz += 26) {
      const inPlay = Math.abs(gx) < OUTER_FRONT.x + 22 && Math.abs(gz) < OUTER_FRONT.z + 22;
      if (inPlay) continue;
      if (roadX.some((rx) => Math.abs(gx - rx) < 13) || roadZ.some((rz) => Math.abs(gz - rz) < 13)) continue;
      if (Math.hypot(gx / 1.15, gz) > 210) continue;
      const w = 18 + r() * 5;
      const d = 18 + r() * 5;
      const h = 14 + r() * 26;
      placed.push({ x: gx, z: gz, r: Math.max(w, d) / 2 });
      m.compose(new THREE.Vector3(gx, 0, gz), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      lists.stone.push(m.clone());
    }
  }
  for (let ring = 0; ring < 3; ring++) {
    const inner = 215 + ring * 60;
    const count = 22 + ring * 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.1;
      const rad = inner + r() * 45;
      const x = Math.cos(a) * rad * 1.15;
      const z = Math.sin(a) * rad;
      const w = 18 + r() * 24;
      const d = 18 + r() * 24;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r + Math.max(w, d) / 2) * 0.9)) continue;
      placed.push({ x, z, r: Math.max(w, d) / 2 });
      const tall = ring > 0 && r() < 0.35;
      const h = tall ? 90 + r() * 130 : 26 + r() * 50;
      const kind: 'stone' | 'glass' = tall || r() < 0.25 ? 'glass' : 'stone';
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(r() * 2) * 0.05), new THREE.Vector3(w, h, d));
      lists[kind].push(m.clone());
    }
  }
  for (const kind of ['stone', 'glass'] as const) {
    const list = lists[kind];
    const inst = new THREE.InstancedMesh(geo, towerMaterial(kind, lights), list.length);
    const tints = kind === 'stone'
      ? [0x8a5a48, 0xb59a7a, 0x8f8a84, 0x6d6560, 0xa8a090, 0x7c8478, 0x9a6a50]
      : [0x9fb0c4, 0x8496aa, 0xb4c0cc, 0x7a8ea4];
    const col = new THREE.Color();
    list.forEach((s, i) => {
      inst.setMatrixAt(i, s);
      inst.setColorAt(i, col.set(tints[Math.floor(r() * tints.length)]));
    });
    inst.computeBoundingSphere();
    group.add(inst);
  }
  return group;
}
