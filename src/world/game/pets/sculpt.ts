// Organic sculpting for the pets: a signed distance field built from
// bone-attached primitives (round cones, ellipsoids) blended with smooth-min,
// meshed with naive Surface Nets. Gives one seamless body with smooth
// SDF-gradient normals, plus per-vertex skin weights from primitive
// distances — so shoulders flow into chests and thighs into hips.

import * as THREE from 'three';

export type Prim =
  | { kind: 'cone'; bone: string; a: THREE.Vector3; b: THREE.Vector3; ra: number; rb: number; tag?: string; blend?: number }
  | { kind: 'ell'; bone: string; c: THREE.Vector3; r: THREE.Vector3; tag?: string; blend?: number };

function sdRoundCone(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number): number {
  // iq's exact round-cone SDF
  const ba = b.clone().sub(a);
  const l2 = ba.lengthSq();
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pa = p.clone().sub(a);
  const y = pa.dot(ba);
  const z = y - l2;
  const xv = pa.clone().multiplyScalar(l2).addScaledVector(ba, -y);
  const x2 = xv.lengthSq();
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

function sdEllipsoid(p: THREE.Vector3, c: THREE.Vector3, r: THREE.Vector3): number {
  const q = p.clone().sub(c);
  const k0 = Math.hypot(q.x / r.x, q.y / r.y, q.z / r.z);
  const k1 = Math.hypot(q.x / (r.x * r.x), q.y / (r.y * r.y), q.z / (r.z * r.z));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r.x, r.y, r.z);
}

export function primDist(p: THREE.Vector3, pr: Prim): number {
  return pr.kind === 'cone' ? sdRoundCone(p, pr.a, pr.b, pr.ra, pr.rb) : sdEllipsoid(p, pr.c, pr.r);
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export interface Sculpted {
  geometry: THREE.BufferGeometry;
  /** nearest primitive per vertex (for colouring / fur length rules) */
  nearest: Prim[];
}

/**
 * Mesh the smooth union of `prims`. `cell` = grid spacing (m).
 * Skin weights: softmax over primitive distances, grouped by bone, top 2.
 */
export function sculpt(prims: Prim[], boneIndex: (name: string) => number, cell: number, k = 0.03): Sculpted {
  // bounds
  const box = new THREE.Box3();
  for (const p of prims) {
    if (p.kind === 'cone') {
      box.expandByPoint(p.a.clone().addScalar(-p.ra - 0.03)).expandByPoint(p.a.clone().addScalar(p.ra + 0.03));
      box.expandByPoint(p.b.clone().addScalar(-p.rb - 0.03)).expandByPoint(p.b.clone().addScalar(p.rb + 0.03));
    } else {
      box.expandByPoint(p.c.clone().sub(p.r).addScalar(-0.03)).expandByPoint(p.c.clone().add(p.r).addScalar(0.03));
    }
  }
  const nx = Math.ceil((box.max.x - box.min.x) / cell) + 1;
  const ny = Math.ceil((box.max.y - box.min.y) / cell) + 1;
  const nz = Math.ceil((box.max.z - box.min.z) / cell) + 1;
  const o = box.min;
  const field = new Float32Array(nx * ny * nz);
  const P = new THREE.Vector3();
  const sdf = (p: THREE.Vector3) => {
    let d = 1e9;
    for (const pr of prims) d = smin(d, primDist(p, pr), pr.blend ?? k);
    return d;
  };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    P.set(o.x + x * cell, o.y + y * cell, o.z + z * cell);
    field[x + nx * (y + ny * z)] = sdf(P);
  }
  const at = (x: number, y: number, z: number) => field[x + nx * (y + ny * z)];

  // ---- surface nets: one vertex per sign-changing cell ----
  const vid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos: number[] = [];
  const cid = (x: number, y: number, z: number) => x + (nx - 1) * (y + (ny - 1) * z);
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const v = corners.map(([a, b, c]) => at(x + a, y + b, z + c));
    let inside = 0;
    for (const s of v) if (s < 0) inside++;
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [i, j] of edges) {
      const a = v[i], b = v[j];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      const ci = corners[i], cj = corners[j];
      sx += ci[0] + (cj[0] - ci[0]) * t;
      sy += ci[1] + (cj[1] - ci[1]) * t;
      sz += ci[2] + (cj[2] - ci[2]) * t;
      n++;
    }
    vid[cid(x, y, z)] = pos.length / 3;
    pos.push(o.x + (x + sx / n) * cell, o.y + (y + sy / n) * cell, o.z + (z + sz / n) * cell);
  }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, b, c, a, c, d);
    else idx.push(a, c, b, a, d, c);
  };
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const s0 = at(x, y, z) < 0;
    if (x < nx - 1 && s0 !== at(x + 1, y, z) < 0) quad(vid[cid(x, y - 1, z - 1)], vid[cid(x, y, z - 1)], vid[cid(x, y, z)], vid[cid(x, y - 1, z)], s0);
    if (y < ny - 1 && s0 !== at(x, y + 1, z) < 0) quad(vid[cid(x - 1, y, z - 1)], vid[cid(x - 1, y, z)], vid[cid(x, y, z)], vid[cid(x, y, z - 1)], s0);
    if (z < nz - 1 && s0 !== at(x, y, z + 1) < 0) quad(vid[cid(x - 1, y - 1, z)], vid[cid(x, y - 1, z)], vid[cid(x, y, z)], vid[cid(x - 1, y, z)], s0);
  }

  // ---- normals from the SDF gradient, weights from primitive distances ----
  const n = pos.length / 3;
  const nor = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const nearest: Prim[] = [];
  const e = cell * 0.5;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    P.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const gx = sdf(tmp.set(P.x + e, P.y, P.z)) - sdf(tmp.set(P.x - e, P.y, P.z));
    const gy = sdf(tmp.set(P.x, P.y + e, P.z)) - sdf(tmp.set(P.x, P.y - e, P.z));
    const gz = sdf(tmp.set(P.x, P.y, P.z + e)) - sdf(tmp.set(P.x, P.y, P.z - e));
    const l = Math.hypot(gx, gy, gz) || 1;
    nor.set([gx / l, gy / l, gz / l], i * 3);
    // weights: softmax(-d/σ) per bone
    const perBone = new Map<string, number>();
    let best: Prim = prims[0];
    let bd = 1e9;
    for (const pr of prims) {
      const d = primDist(P, pr);
      if (d < bd) { bd = d; best = pr; }
      const w = Math.exp(-Math.max(0, d) / 0.012);
      perBone.set(pr.bone, Math.max(perBone.get(pr.bone) ?? 0, w));
    }
    nearest.push(best);
    const top = [...perBone.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    top.forEach(([bone, w], k2) => { skinIndex[i * 4 + k2] = boneIndex(bone); skinWeight[i * 4 + k2] = w / sum; });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setIndex(idx);
  return { geometry: g, nearest };
}
