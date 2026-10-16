// Geometry helpers for procedural architecture. Everything carries UVs in
// metres (so PBR `scale` = metres per tile) and is accumulated into Batches:
// one merged mesh per material per level, keeping draw calls low.

import * as THREE from 'three';
import { geometryParts } from '../engine/AutoCollide';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();

/** Box with metre UVs on every face */
export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const sx = ax > 0.5 ? d : w;
    const sy = ay > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  return g;
}

/** Vertical quad facing +Z, origin at its bottom-centre, metre UVs (u0/v0 offsets) */
export function quadGeo(w: number, h: number, u0 = 0, v0 = 0): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * w, v0 + uv.getY(i) * h);
  return g;
}

/** Horizontal quad (floor/roof) facing +Y, centred, metre UVs */
export function floorGeo(w: number, d: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  return g;
}

/** Ensure attribute sets match so mergeGeometries never rejects a pair */
function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) {
    if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  }
  if (!out.attributes.uv) {
    out = out.clone();
    out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

/** Accumulates transformed geometry per material, then merges to meshes */
export class Batches {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private flags = new Map<THREE.Material, { cast: boolean; receive: boolean }>();
  private solids = new Map<THREE.Material, Array<{ part: ReturnType<typeof geometryParts>[number]; m: THREE.Matrix4 }>>();
  /** false = nothing in this batch gets automatic collision (see AutoCollide) */
  solid = true;

  add(mat: THREE.Material, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4, cast = true, receive = true): void {
    if (this.solid && !mat.userData.noCollide) {
      let list = this.solids.get(mat);
      if (!list) this.solids.set(mat, (list = []));
      const m = matrix ? matrix.clone() : new THREE.Matrix4();
      for (const part of geometryParts(geo, false)) list.push({ part, m });
    }
    const g = normalise(geo);
    if (matrix) g.applyMatrix4(matrix);
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
    const f = this.flags.get(mat);
    this.flags.set(mat, { cast: (f?.cast ?? false) || cast, receive: (f?.receive ?? false) || receive });
  }

  /** Convenience: add at a position / Y-rotation */
  put(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, cast = true): void {
    _m.makeRotationY(ry).setPosition(x, y, z);
    this.add(mat, geo, _m, cast);
  }

  build(parent: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const f = this.flags.get(mat)!;
      mesh.castShadow = f.cast;
      mesh.receiveShadow = f.receive;
      mesh.userData.solids = this.solids.get(mat) ?? [];
      parent.add(mesh);
      out.push(mesh);
    }
    this.parts.clear();
    this.solids.clear();
    return out;
  }
}

/** Matrix for a building-local transform: origin (x,z), rotation ry */
export function frame(x: number, y: number, z: number, ry: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
}
