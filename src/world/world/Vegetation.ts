// Procedural vegetation: trees, bushes, grass.
//
// Trees: curved trunk + branch tubes (bark PBR) and canopies of alpha-tested
// leaf-cluster cards. Leaf normals point out from the canopy centre so the
// canopy shades as a soft volume, not as flat cards. Each tree variant is an
// InstancedMesh pair; the vertex shader sways leaves with a per-instance
// phase. Grass is an InstancedMesh of tapered blades bending in the wind.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Assets } from '../engine/Assets';
import type { Physics } from '../engine/Physics';
import { rng } from '../engine/math';

export const windUniforms = { time: { value: 0 }, strength: { value: 1 } };

/** Leaf-cluster texture: dozens of small leaves on transparent ground */
function leafTexture(seed: number, hueBase: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 150; i++) {
    const x = 60 + r() * 392;
    const y = 60 + r() * 392;
    // keep leaves roughly inside a round cluster
    if (Math.hypot(x - 256, y - 256) > 210) continue;
    const len = 34 + r() * 30;
    const wid = len * (0.38 + r() * 0.12);
    const ang = r() * Math.PI * 2;
    const l = 0.15 + r() * 0.15;
    const col = new THREE.Color().setHSL(hueBase + (r() - 0.5) * 0.05, 0.38 + r() * 0.18, l);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = `#${col.getHexString()}`;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.quadraticCurveTo(0, -wid, len / 2, 0);
    g.quadraticCurveTo(0, wid, -len / 2, 0);
    g.fill();
    // midrib + edge shading
    g.strokeStyle = `#${col.clone().multiplyScalar(0.7).getHexString()}`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function leafMaterial(tex: THREE.Texture, tint: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: tint });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.time;
    sh.uniforms.uWind = windUniforms.strength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float ph = ip.x * 0.37 + ip.z * 0.21;
        float h = max(transformed.y - 1.2, 0.0);
        float sway = sin(uTime * 1.3 + ph + transformed.x * 0.6) * 0.045 + sin(uTime * 3.1 + ph * 2.0 + transformed.z) * 0.018;
        transformed.x += sway * h * uWind;
        transformed.z += sway * 0.7 * h * uWind;`);
  };
  m.customProgramCacheKey = () => 'leaf-wind';
  return m;
}

/** Card cluster around a point; normals point away from `centre` */
function cards(out: THREE.BufferGeometry[], p: THREE.Vector3, centre: THREE.Vector3, size: number, count: number, r: () => number): void {
  for (let i = 0; i < count; i++) {
    const g = new THREE.PlaneGeometry(size * (0.8 + r() * 0.5), size * (0.8 + r() * 0.5));
    g.rotateX((r() - 0.5) * Math.PI);
    g.rotateY(r() * Math.PI);
    g.rotateZ((r() - 0.5) * 0.8);
    g.translate(p.x + (r() - 0.5) * size * 0.8, p.y + (r() - 0.5) * size * 0.6, p.z + (r() - 0.5) * size * 0.8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).sub(centre).normalize();
      v.y = v.y * 0.7 + 0.3; // bias up: canopies read lit from the sky
      v.normalize();
      nrm.setXYZ(k, v.x, v.y, v.z);
    }
    out.push(g);
  }
}

interface TreeVariant {
  wood: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  height: number;
}

function makeTree(seed: number, kind: 'street' | 'park' | 'round'): TreeVariant {
  const r = rng(seed);
  const woodParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const trunkH = kind === 'park' ? 3.2 + r() * 0.8 : kind === 'round' ? 2.0 : 2.6 + r() * 0.5;
  const lean = new THREE.Vector3((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.3, trunkH * 0.4, lean.z * 0.3),
    new THREE.Vector3(lean.x, trunkH, lean.z),
  ]);
  const trunkR = kind === 'park' ? 0.26 : 0.17;
  const trunk = new THREE.TubeGeometry(trunkCurve, 10, trunkR, 10, false);
  // taper
  const tp = trunk.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const t = y / trunkH;
    const c = trunkCurve.getPoint(Math.min(1, Math.max(0, t)));
    const s = 1 - t * 0.45 + (y < 0.3 ? (0.3 - y) * 0.9 : 0);
    tp.setX(i, c.x + (tp.getX(i) - c.x) * s);
    tp.setZ(i, c.z + (tp.getZ(i) - c.z) * s);
  }
  const uv = trunk.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * trunkH, uv.getY(i) * 1.2);
  woodParts.push(trunk);

  const top = trunkCurve.getPoint(1);
  const crownH = kind === 'park' ? 5.5 : kind === 'round' ? 3.2 : 4.4;
  const crownR = kind === 'park' ? 3.6 : kind === 'round' ? 2.2 : 2.5;
  const centre = top.clone().add(new THREE.Vector3(0, crownH * 0.45, 0));
  const nb = kind === 'park' ? 9 : 6;
  for (let b = 0; b < nb; b++) {
    const ang = (b / nb) * Math.PI * 2 + r() * 0.6;
    const start = trunkCurve.getPoint(0.7 + r() * 0.3);
    const reach = crownR * (0.55 + r() * 0.4);
    const end = new THREE.Vector3(Math.cos(ang) * reach, top.y + crownH * (0.25 + r() * 0.55), Math.sin(ang) * reach).add(new THREE.Vector3(lean.x, 0, lean.z));
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.4 + r() * 0.5, 0));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const br = new THREE.TubeGeometry(curve, 6, trunkR * 0.38, 6, false);
    const bp = br.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      // taper by distance along the branch (approx via distance from start)
      const v = new THREE.Vector3().fromBufferAttribute(bp, i);
      const t = Math.min(1, v.distanceTo(start) / start.distanceTo(end));
      const c = curve.getPoint(t);
      bp.setXYZ(i, c.x + (v.x - c.x) * (1 - t * 0.7), c.y + (v.y - c.y) * (1 - t * 0.7), c.z + (v.z - c.z) * (1 - t * 0.7));
    }
    woodParts.push(br);
    // foliage clusters along the outer half of the branch
    for (let k = 0; k < 4; k++) {
      const p = curve.getPoint(0.45 + k * 0.18);
      cards(leafParts, p, centre, kind === 'park' ? 1.6 : 1.3, 3, r);
    }
  }
  // fill the crown volume
  const fill = kind === 'park' ? 40 : 26;
  for (let i = 0; i < fill; i++) {
    const u = r() * Math.PI * 2;
    const v = Math.acos(2 * r() - 1);
    const rad = Math.cbrt(r()) * 0.9;
    const p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * crownR * rad, Math.cos(v) * crownH * 0.5 * rad, Math.sin(v) * Math.sin(u) * crownR * rad).add(centre);
    cards(leafParts, p, centre, kind === 'park' ? 1.7 : 1.35, 2, r);
  }
  const wood = mergeGeometries(woodParts.map((g) => g.toNonIndexed()), false)!;
  const leaves = mergeGeometries(leafParts.map((g) => g.toNonIndexed()), false)!;
  return { wood, leaves, height: top.y + crownH };
}

export class Vegetation {
  readonly group = new THREE.Group();
  private barkMat: THREE.Material;
  private leafMats: THREE.MeshStandardMaterial[];

  constructor(assets: Assets, private physics: Physics) {
    this.barkMat = assets.pbr('bark_brown_01', { scale: 1.2 });
    this.leafMats = [
      leafMaterial(leafTexture(11, 0.27), 0xffffff),
      leafMaterial(leafTexture(23, 0.22), 0xf2f7e8),
      leafMaterial(leafTexture(37, 0.3), 0xe8f0e0),
    ];
  }

  /** Instance trees at spots; returns trunk positions */
  trees(spots: Array<{ x: number; y: number; z: number; s: number }>, kind: 'street' | 'park' | 'round', variants = 3): void {
    if (!spots.length) return;
    const vs = Array.from({ length: variants }, (_, i) => makeTree(100 + i * 17 + (kind === 'park' ? 500 : 0), kind));
    const buckets: Array<typeof spots> = vs.map(() => []);
    spots.forEach((s, i) => buckets[i % variants].push(s));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    vs.forEach((v, vi) => {
      const list = buckets[vi];
      if (!list.length) return;
      const wood = new THREE.InstancedMesh(v.wood, this.barkMat, list.length);
      const leaves = new THREE.InstancedMesh(v.leaves, this.leafMats[vi % this.leafMats.length], list.length);
      list.forEach((s, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (s.x * 13.1 + s.z * 7.7) % (Math.PI * 2));
        m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
        wood.setMatrixAt(i, m);
        leaves.setMatrixAt(i, m);
        this.physics.cylinder(s.x, s.y + 1.2, s.z, 1.2, (kind === 'park' ? 0.28 : 0.2) * s.s, { kind: 'static', surface: 'wood' });
      });
      wood.castShadow = wood.receiveShadow = true;
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      wood.computeBoundingSphere();
      leaves.computeBoundingSphere();
      this.group.add(wood, leaves);
    });
  }

  /** Hedge / bush clumps from leaf cards (no collision unless asked) */
  bushes(spots: Array<{ x: number; y: number; z: number; s: number }>, collide = true): void {
    const r = rng(999);
    const parts: THREE.BufferGeometry[] = [];
    for (const s of spots) {
      const centre = new THREE.Vector3(s.x, s.y + 0.55 * s.s, s.z);
      for (let i = 0; i < 9; i++) {
        const p = centre.clone().add(new THREE.Vector3((r() - 0.5) * 1.1 * s.s, (r() - 0.3) * 0.7 * s.s, (r() - 0.5) * 1.1 * s.s));
        cards(parts, p, centre.clone().add(new THREE.Vector3(0, -0.4, 0)), 0.95 * s.s, 2, r);
      }
      if (collide) this.physics.cylinder(s.x, s.y + 0.5 * s.s, s.z, 0.5 * s.s, 0.6 * s.s, { kind: 'static', surface: 'grass', cameraIgnore: true });
    }
    if (!parts.length) return;
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
    const mesh = new THREE.Mesh(g, this.leafMats[1]);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Instanced grass blades over the given areas (rect list, with exclusions) */
  grass(areas: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; y: number }>, density: number, exclude: (x: number, z: number) => boolean): void {
    const blade = new THREE.PlaneGeometry(0.022, 1, 1, 3);
    blade.translate(0, 0.5, 0);
    const pos = blade.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * (1 - y * 0.92));
    }
    const nrm = blade.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const r = rng(77);
    const spots: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const a of areas) {
      const n = Math.floor((a.maxX - a.minX) * (a.maxZ - a.minZ) * density);
      for (let i = 0; i < n; i++) {
        const x = a.minX + r() * (a.maxX - a.minX);
        const z = a.minZ + r() * (a.maxZ - a.minZ);
        if (exclude(x, z)) continue;
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.35, r() * Math.PI, (r() - 0.5) * 0.35));
        const h = 0.06 + r() * 0.08; // mowed lawn — pets stay visible
        m.compose(new THREE.Vector3(x, a.y, z), q, new THREE.Vector3(1 + r() * 0.8, h, 1));
        spots.push(m.clone());
      }
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fa04a, roughness: 0.9, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windUniforms.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = position.y;
          vec3 ip = instanceMatrix[3].xyz;
          float w = sin(uTime * 1.8 + ip.x * 0.5 + ip.z * 0.35) * 0.5 + sin(uTime * 4.0 + ip.x * 2.1) * 0.15;
          transformed.x += w * 0.18 * position.y * position.y;
          transformed.z += w * 0.1 * position.y * position.y;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(vec3(0.42, 0.5, 0.3), vec3(1.15, 1.12, 0.85), vH);`);
    };
    mat.customProgramCacheKey = () => 'grass-wind';
    const inst = new THREE.InstancedMesh(blade, mat, spots.length);
    spots.forEach((s, i) => inst.setMatrixAt(i, s));
    inst.receiveShadow = true;
    inst.castShadow = false;
    inst.computeBoundingSphere();
    this.group.add(inst);
  }
}
