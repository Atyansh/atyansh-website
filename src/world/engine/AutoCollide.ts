// Automatic collision for everything visible in a level.
//
// Hand-placed colliders cover the big architecture, but every bench, booth,
// stanchion and shelf deserves to be solid too. When a level is added we walk
// its scene graph, split each mesh into connected parts (so a door frame is
// three posts, not one box across the doorway), and give each part an
// oriented box collider unless:
//   - it is flagged `userData.noCollide` (grass, pickups, beams of light…)
//   - it is tiny, flat (rugs, decals, water), or a thin wire overhead
//   - it is hollow (a frame / arch whose box would plug an opening)
//   - its core already sits inside an existing collider (walls, floors)
//   - it would trap the level's spawn point

import * as THREE from 'three';
import type { Physics } from './Physics';

interface Part { box: THREE.Box3; area: number }
const partCache = new WeakMap<THREE.BufferGeometry, Part[]>();

/** Connected components of a geometry (welded by position), with local AABB + surface area */
export function geometryParts(geo: THREE.BufferGeometry, cache = true): Part[] {
  const cached = cache ? partCache.get(geo) : undefined;
  if (cached) return cached;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return [];
  const n = pos.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  // weld coincident vertices (split normals / uvs)
  const weld = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    const j = weld.get(k);
    if (j === undefined) weld.set(k, i); else union(i, j);
  }
  const index = geo.getIndex();
  const tri = index ? index.count / 3 : n / 3;
  const vi = (t: number, c: number) => (index ? index.getX(t * 3 + c) : t * 3 + c);
  for (let t = 0; t < tri; t++) { union(vi(t, 0), vi(t, 1)); union(vi(t, 1), vi(t, 2)); }
  const parts = new Map<number, Part>();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let p = parts.get(r);
    if (!p) parts.set(r, (p = { box: new THREE.Box3(), area: 0 }));
    p.box.expandByPoint(v.fromBufferAttribute(pos, i));
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(pos, vi(t, 0)); b.fromBufferAttribute(pos, vi(t, 1)); c.fromBufferAttribute(pos, vi(t, 2));
    const area = b.sub(a).cross(c.sub(a)).length() * 0.5;
    parts.get(find(vi(t, 0)))!.area += area;
  }
  const out = [...parts.values()];
  if (cache) partCache.set(geo, out);
  return out;
}

export interface AutoStats { added: number; inside: number; small: number; hollow: number; spawn: number }

/** Give every solid visible part of `root` a box collider. */
export function autoCollide(root: THREE.Object3D, physics: Physics, opts: { avoid?: THREE.Vector3[]; floorY?: number } = {}): AutoStats {
  const stats: AutoStats = { added: 0, inside: 0, small: 0, hollow: 0, spawn: 0 };
  root.updateWorldMatrix(true, true);
  // new colliders must be visible to scene queries
  physics.world.step();
  const R = physics.R;
  const mw = new THREE.Matrix4();
  const im = new THREE.Matrix4();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  const center = new THREE.Vector3(), half = new THREE.Vector3();
  const pending: Array<{ c: THREE.Vector3; h: THREE.Vector3; q: THREE.Quaternion; small: boolean }> = [];

  const consider = (part: Part, m: THREE.Matrix4) => {
    m.decompose(pos, quat, scl);
    const s = part.box.getSize(half).multiply(scl).set(Math.abs(half.x), Math.abs(half.y), Math.abs(half.z));
    const dims = [s.x, s.y, s.z].sort((x, y) => x - y);
    center.copy(part.box.getCenter(center)).applyMatrix4(m);
    const hy = worldHalfY(s, quat);
    // tiny bits, flat decals/rugs/water, overhead wires
    // out of reach (upper storeys): no gameplay value, just broadphase cost
    if (center.y - hy > (opts.floorY ?? 0) + 3.6) { stats.small++; return; }
    if (dims[2] < 0.14 || hy < 0.02 || (dims[1] < 0.035 && center.y - hy > 2.2)) { stats.small++; return; }
    if (dims[0] < 0.004) { stats.small++; return; }
    // hollow: large box with little surface (frames, arches, open shelving shells)
    const surf = 2 * (s.x * s.y + s.y * s.z + s.x * s.z);
    const area = part.area * scl.x * scl.y; // approx under uniform-ish scale
    const vol = s.x * s.y * s.z;
    if (vol > 0.35 && area / surf < 0.28) { stats.hollow++; return; }
    pending.push({ c: center.clone(), h: s.clone().multiplyScalar(0.5), q: quat.clone(), small: dims[2] < 0.7 });
  };

  root.traverse((o) => {
    if (!o.visible) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.noCollide) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.every((mt) => mt.blending === THREE.AdditiveBlending || ((mt as THREE.ShaderMaterial).isShaderMaterial && mt.transparent))) return;
    const pieces = mesh.userData.solids as Array<{ part: Part; m: THREE.Matrix4 }> | undefined;
    if (pieces) {
      for (const pc of pieces) consider(pc.part, mw.multiplyMatrices(mesh.matrixWorld, pc.m));
      return;
    }
    const parts = geometryParts(mesh.geometry);
    if (parts.length > 400) return; // dense scans/foliage: author colliders by hand
    const inst = mesh as unknown as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, im);
        for (const part of parts) consider(part, mw.multiplyMatrices(mesh.matrixWorld, im));
      }
    } else for (const part of parts) consider(part, mesh.matrixWorld);
  });

  const avoid = opts.avoid ?? [];
  const local = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  // biggest first; parts contained in an already-solid part are skipped by the core test
  pending.sort((a, b) => b.h.x * b.h.y * b.h.z - a.h.x * a.h.y * a.h.z);
  for (const p of pending) {
    const core = new R.Cuboid(Math.max(0.005, p.h.x * 0.4), Math.max(0.005, p.h.y * 0.4), Math.max(0.005, p.h.z * 0.4));
    const hit = physics.world.intersectionWithShape(p.c, p.q, core, undefined, undefined, undefined, undefined,
      (c) => { const k = physics.tagOf(c).kind; return k === 'static' || k === 'prop'; });
    if (hit) { stats.inside++; continue; }
    inv.copy(p.q).invert();
    if (avoid.some((a) => {
      local.copy(a).sub(p.c).applyQuaternion(inv);
      return Math.abs(local.x) < p.h.x + 0.3 && Math.abs(local.z) < p.h.z + 0.3 && local.y + 0.9 > -p.h.y && local.y < p.h.y;
    })) { stats.spawn++; continue; }
    physics.box(p.c.x, p.c.y, p.c.z, Math.max(0.01, p.h.x), Math.max(0.01, p.h.y), Math.max(0.01, p.h.z), p.q,
      { kind: 'static', cameraIgnore: p.small, owner: 'auto' });
    stats.added++;
  }
  return stats;
}

function worldHalfY(size: THREE.Vector3, q: THREE.Quaternion): number {
  // half-height of an oriented box's world AABB
  const e = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
  return 0.5 * (Math.abs(e[1]) * size.x + Math.abs(e[5]) * size.y + Math.abs(e[9]) * size.z);
}
