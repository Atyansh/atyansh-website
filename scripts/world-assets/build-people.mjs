#!/usr/bin/env node
/**
 * The Block — people build (Quaternius Universal Base Characters, CC0).
 *
 * The free UBC pack ships realistic base bodies (male/female, two skin tones)
 * on the same skeleton as the Universal Animation Library — but no clothes.
 * This script tailors garments directly from each body:
 *
 *   1. classify every body vertex by the bones that drive it (torso, upper
 *      arm, forearm, pelvis, thigh, calf, foot) and its bind-pose position
 *   2. per garment, take the triangles fully inside its region, push them
 *      out along the normal (fabric thickness), and close the open edges
 *      with a hem strip back to the body, so cuffs read as real fabric
 *   3. keep the garments skinned to the same joints (they deform with the
 *      body) and remove skin triangles that are always covered (torso,
 *      hips, feet) so nothing pokes through in motion
 *
 * Output (public/world/assets/characters/):
 *   person_m.glb / person_f.glb — body (light + dark skin textures), eyes,
 *     brows, and garments: shirt_short, shirt_long, jacket, pants, shorts,
 *     shoes — each its own skinned mesh, toggled/tinted at runtime
 *   hair.glb — hairstyles in model space (attached to the head bone)
 */

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = '.cache/world-src/ubc/Universal Base Characters[Standard]';
const OUT = 'public/world/assets/characters';

// Region classification: joint name → region
const REGION = (j) => {
  if (/^spine_|^clavicle/.test(j)) return 'torso';
  if (/^neck/.test(j)) return 'neck';
  if (/^upperarm/.test(j)) return 'upperarm';
  if (/^lowerarm/.test(j)) return 'forearm';
  if (/^hand|^thumb|^index|^middle|^ring|^pinky/.test(j)) return 'hand';
  if (j === 'pelvis') return 'pelvis';
  if (/^thigh/.test(j)) return 'thigh';
  if (/^calf/.test(j)) return 'calf';
  if (/^foot|^ball/.test(j)) return 'foot';
  if (/^Head|^head/.test(j)) return 'head';
  return 'other';
};

/**
 * Garment specs. `take(v)` decides vertex membership from region weights and
 * bind-pose geometry; `off` is fabric offset (m).
 */
function garments(meta) {
  const { pelvisY, neckY, shoulderX, elbowX, wristX, kneeY, ankleY } = meta;
  const w = (v, ...rs) => rs.reduce((a, r) => a + (v.region[r] ?? 0), 0);
  const upperTorso = (v) => v.p[1] > pelvisY + 0.02 && v.p[1] < neckY - 0.075 && (v.region.neck ?? 0) < 0.3;
  return {
    shirt_short: { off: 0.022, smooth: 14, take: (v) => (w(v, 'torso', 'pelvis') > 0.5 && upperTorso(v)) || (w(v, 'upperarm', 'torso') > 0.6 && Math.abs(v.p[0]) < shoulderX + (elbowX - shoulderX) * 0.45 && v.p[1] > pelvisY + 0.25) },
    shirt_long: { off: 0.024, smooth: 14, take: (v) => (w(v, 'torso', 'pelvis') > 0.5 && upperTorso(v)) || (w(v, 'upperarm', 'forearm', 'torso') > 0.6 && Math.abs(v.p[0]) < wristX - 0.03 && v.p[1] > pelvisY + 0.25) },
    jacket: { off: 0.038, smooth: 18, take: (v) => (w(v, 'torso', 'pelvis') > 0.4 && v.p[1] > pelvisY - 0.12 && v.p[1] < neckY - 0.01) || (w(v, 'upperarm', 'forearm', 'torso') > 0.6 && Math.abs(v.p[0]) < wristX - 0.02 && v.p[1] > pelvisY + 0.2) },
    pants: { off: 0.026, smooth: 20, take: (v) => w(v, 'pelvis', 'thigh', 'calf') > 0.5 && v.p[1] < pelvisY + 0.1 && v.p[1] > ankleY + 0.005 },
    shorts: { off: 0.026, smooth: 16, take: (v) => w(v, 'pelvis', 'thigh') > 0.5 && v.p[1] < pelvisY + 0.1 && v.p[1] > kneeY + 0.1 },
    // feet are covered (and cut) by this region; the visible shoes are modelled sneakers
    shoes: { off: 0.0, hidden: true, take: (v) => w(v, 'foot', 'calf') > 0.5 && v.p[1] < ankleY + 0.035 },
  };
}

function buildGarment(prim, verts, idx, spec, doc, buffer) {
  const inSet = verts.map((v) => spec.take(v));
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (inSet[idx[t]] && inSet[idx[t + 1]] && inSet[idx[t + 2]]) tris.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  // boundary edges (used by exactly one kept triangle)
  const edgeCount = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < tris.length; t += 3) {
    for (const [a, b] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]]) {
      const k = key(a, b);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }
  // Taubin-smooth the garment surface (bind pose): drapes over muscle detail
  // without shrinking; boundary (hem) vertices stay put
  const used = [...new Set(tris)];
  const nbr = new Map(used.map((v) => [v, new Set()]));
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    nbr.get(a).add(b).add(c); nbr.get(b).add(a).add(c); nbr.get(c).add(a).add(b);
  }
  const boundary = new Set();
  for (const [k, n] of edgeCount) if (n === 1) for (const v of k.split('_')) boundary.add(+v);
  const sp = new Map(used.map((v) => [v, [...verts[v].p]]));
  // plain Laplacian (shrinks, erasing muscle definition); finalPos then
  // pushes every point back out past the skin → a fabric hull over the body
  for (let it = 0; it < (spec.smooth ?? 0) * 2; it++) {
    const f = 0.5;
    const next = new Map();
    for (const v of used) {
      if (boundary.has(v)) { next.set(v, sp.get(v)); continue; }
      const ns = nbr.get(v);
      const avg = [0, 0, 0];
      for (const u of ns) { const q = sp.get(u); avg[0] += q[0]; avg[1] += q[1]; avg[2] += q[2]; }
      const p = sp.get(v);
      next.set(v, p.map((x, k) => x + f * (avg[k] / ns.size - x)));
    }
    for (const [v, p] of next) sp.set(v, p);
  }
  // final position: smoothed surface pushed out until it clears the skin
  const finalPos = (vi, off) => {
    const v = verts[vi];
    const s = sp.get(vi) ?? v.p;
    const n = v.n;
    const under = (v.p[0] - s[0]) * n[0] + (v.p[1] - s[1]) * n[1] + (v.p[2] - s[2]) * n[2];
    const d = off + Math.max(0, under);
    return [s[0] + n[0] * d, s[1] + n[1] * d, s[2] + n[2] * d];
  };
  // remap used vertices; outer surface = offset copy, hem ring = inner copy
  const map = new Map();
  const P = [], N = [], UV = [], J = [], W = [];
  const push = (vi, off) => {
    const v = verts[vi];
    P.push(...finalPos(vi, off));
    N.push(...v.n); UV.push(...v.uv); J.push(...v.j); W.push(...v.w);
    return P.length / 3 - 1;
  };
  const outer = (vi) => { if (!map.has(vi)) map.set(vi, push(vi, spec.off)); return map.get(vi); };
  const I = [];
  for (let t = 0; t < tris.length; t += 3) I.push(outer(tris[t]), outer(tris[t + 1]), outer(tris[t + 2]));
  // hem: for each boundary edge, a quad from outer surface back to the body
  const innerMap = new Map();
  const inner = (vi) => { if (!innerMap.has(vi)) innerMap.set(vi, push(vi, spec.off * 0.15)); return innerMap.get(vi); };
  for (let t = 0; t < tris.length; t += 3) {
    for (const [a, b] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]]) {
      if (edgeCount.get(key(a, b)) !== 1) continue;
      const oa = outer(a), ob = outer(b), ia = inner(a), ib = inner(b);
      I.push(ob, oa, ia, ob, ia, ib);
    }
  }
  if (!I.length) return null;
  const acc = (arr, type, Ctor = Float32Array) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buffer);
  const p = doc.createPrimitive()
    .setAttribute('POSITION', acc(P, 'VEC3'))
    .setAttribute('NORMAL', acc(N, 'VEC3'))
    .setAttribute('TEXCOORD_0', acc(UV, 'VEC2'))
    .setAttribute('JOINTS_0', acc(J, 'VEC4', Uint16Array))
    .setAttribute('WEIGHTS_0', acc(W, 'VEC4'))
    .setIndices(acc(I, 'SCALAR', Uint32Array));
  return { prim: p, covered: inSet };
}

async function buildPerson(io, gender) {
  const file = `${SRC}/Base Characters/Godot - UE/Superhero_${gender === 'm' ? 'Male' : 'Female'}_FullBody.gltf`;
  const doc = await io.read(file);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const jname = joints.map((j) => j.getName());
  const wpos = (n) => joints.find((j) => j.getName() === n).getWorldTranslation();
  const meta = {
    pelvisY: wpos('pelvis')[1],
    neckY: wpos('neck_01')[1],
    shoulderX: Math.abs(wpos('upperarm_l')[0]),
    elbowX: Math.abs(wpos('lowerarm_l')[0]),
    wristX: Math.abs(wpos('hand_l')[0]),
    kneeY: wpos('calf_l')[1],
    ankleY: wpos('foot_l')[1],
  };
  console.log(gender, Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, +v.toFixed(3)])));

  // the body mesh = the one with the most vertices
  const meshes = root.listMeshes();
  const bodyMesh = meshes.reduce((a, b) => (b.listPrimitives()[0].getAttribute('POSITION').getCount() > a.listPrimitives()[0].getAttribute('POSITION').getCount() ? b : a));
  const bodyNode = root.listNodes().find((n) => n.getMesh() === bodyMesh);
  const prim = bodyMesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const verts = [];
  for (let i = 0; i < pos.getCount(); i++) {
    const j = J.getElement(i, []), w = W.getElement(i, []);
    const region = {};
    j.forEach((ji, k) => { const r = REGION(jname[ji]); region[r] = (region[r] ?? 0) + w[k]; });
    verts.push({ p: pos.getElement(i, []), n: nor.getElement(i, []), uv: uv.getElement(i, []), j, w, region });
  }
  const idx = Array.from(prim.getIndices().getArray());

  // ---- slim the superhero build toward everyday proportions ----
  // limbs/torso: pull each vertex's radial offset from its dominant bone
  // segment toward the axis, then soften muscle definition (Laplacian),
  // leaving head, hands and feet untouched
  {
    const segs = {
      upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r',
      thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r',
      spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', pelvis: 'spine_01', clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r',
    };
    const factor = (bone) => /arm/.test(bone) ? (gender === 'm' ? 0.72 : 0.86) : /thigh|calf/.test(bone) ? (gender === 'm' ? 0.84 : 0.9)
      : /spine_03|clavicle/.test(bone) ? (gender === 'm' ? 0.82 : 0.93) : /spine/.test(bone) ? (gender === 'm' ? 0.88 : 0.95) : 0.96;
    const original = verts.map((v) => [...v.p]);
    for (const v of verts) {
      if ((v.region.head ?? 0) + (v.region.hand ?? 0) + (v.region.foot ?? 0) > 0.3) continue;
      let best = -1, bw = 0;
      v.j.forEach((ji, k) => { if (v.w[k] > bw && segs[jname[ji]]) { bw = v.w[k]; best = ji; } });
      if (best < 0) continue;
      const a = wpos(jname[best]), b = wpos(segs[jname[best]]);
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((v.p[0] - a[0]) * ab[0] + (v.p[1] - a[1]) * ab[1] + (v.p[2] - a[2]) * ab[2]) / L2));
      const c = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
      const f = 1 - (1 - factor(jname[best])) * bw;
      v.p = [c[0] + (v.p[0] - c[0]) * f, c[1] + (v.p[1] - c[1]) * f, c[2] + (v.p[2] - c[2]) * f];
    }
    // soften: a few Taubin passes over the slimmed body
    const nb = verts.map(() => new Set());
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
    }
    {
      const byPos = new Map();
      original.forEach((p, i) => { const k = p.map((x) => x.toFixed(5)).join(','); (byPos.get(k) ?? byPos.set(k, []).get(k)).push(i); });
      for (const g of byPos.values()) if (g.length > 1) { const u = new Set(); for (const i of g) for (const n of nb[i]) u.add(n); for (const i of g) nb[i] = u; }
    }
    for (let it = 0; it < 8; it++) {
      const f = it % 2 === 0 ? 0.45 : -0.47;
      const next = verts.map((v, i) => {
        if ((v.region.head ?? 0) + (v.region.hand ?? 0) + (v.region.foot ?? 0) > 0.2 || !nb[i].size) return v.p;
        const avg = [0, 0, 0];
        for (const u of nb[i]) { avg[0] += verts[u].p[0]; avg[1] += verts[u].p[1]; avg[2] += verts[u].p[2]; }
        return v.p.map((x, k) => x + f * (avg[k] / nb[i].size - x));
      });
      next.forEach((p, i) => { verts[i].p = p; });
    }
    // UV-seam duplicates must move together (else cracks): average per original position
    const groups = new Map();
    original.forEach((p, i) => {
      const k = p.map((x) => x.toFixed(5)).join(',');
      (groups.get(k) ?? groups.set(k, []).get(k)).push(i);
    });
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const avg = [0, 0, 0];
      for (const i of g) { avg[0] += verts[i].p[0]; avg[1] += verts[i].p[1]; avg[2] += verts[i].p[2]; }
      for (const i of g) verts[i].p = avg.map((x) => x / g.length);
    }
    // write back into the body mesh
    const arr = new Float32Array(verts.length * 3);
    verts.forEach((v, i) => arr.set(v.p, i * 3));
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(buffer));
    const moved = verts.reduce((m, v, i) => Math.max(m, Math.hypot(v.p[0] - original[i][0], v.p[1] - original[i][1], v.p[2] - original[i][2])), 0);
    console.log(`  slimmed (max move ${(moved * 100).toFixed(1)}cm)`);
  }

  const specs = garments(meta);
  const always = new Set(); // body verts always under some garment (torso, hips, feet)
  for (const [name, spec] of Object.entries(specs)) {
    const g = buildGarment(prim, verts, idx, spec, doc, buffer);
    if (!g) continue;
    if (spec.hidden) {
      g.covered.forEach((c, i) => { if (c) always.add(i); });
      g.prim.dispose();
      continue;
    }
    const mat = doc.createMaterial(`Garment_${name}`).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(false);
    g.prim.setMaterial(mat);
    const mesh = doc.createMesh(`garment_${name}`).addPrimitive(g.prim);
    const node = doc.createNode(`garment_${name}`).setMesh(mesh).setSkin(skin);
    bodyNode.getParentNode()?.addChild(node) ?? root.getDefaultScene().addChild(node);
    // skin covered by the minimum outfit (short shirt + shorts + shoes)
    if (name === 'shirt_short' || name === 'shorts' || name === 'shoes') g.covered.forEach((c, i) => { if (c) always.add(i); });
    console.log(`  ${name}: ${g.prim.getIndices().getCount() / 3} tris`);
  }
  // ---- sneakers: modelled shoes rigidly skinned to each foot ----
  {
    const THREE = await import('three');
    const upperMat = doc.createMaterial('Garment_shoes').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
    const soleMat = doc.createMaterial('Garment_sole').setBaseColorFactor([0.93, 0.92, 0.9, 1]).setRoughnessFactor(0.75).setMetallicFactor(0);
    const mesh = doc.createMesh('garment_shoes');
    for (const side of ['l', 'r']) {
      const fj = jname.indexOf(`foot_${side}`);
      const F = wpos(`foot_${side}`), B = wpos(`ball_${side}`);
      const fwd = new THREE.Vector3(B[0] - F[0], 0, B[2] - F[2]).normalize();
      const L = 0.29 * (gender === 'f' ? 0.92 : 1);
      const heel = new THREE.Vector3(F[0], 0, F[2]).addScaledVector(fwd, -0.075 * (gender === 'f' ? 0.92 : 1));
      // smooth sneaker: a deformed sphere (upper) on a flattened rim (sole)
      const W = 0.1 * (gender === 'f' ? 0.9 : 1);
      const ss = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      const shoeShape = (sx, sy, sz, sole) => {
        const g = new THREE.SphereGeometry(1, 36, 18);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const u = (x + 1) / 2; // 0 heel → 1 toe
          const h = sole ? 0.016 : 0.045 + 0.085 * (1 - ss(0.3, 0.85, u)); // ankle collar high, toe low
          const w = (W / 2) * (0.9 + 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * sz;
          const yy = sole ? y * h : (y > 0 ? y * h : y * 0.004);
          p.setXYZ(i, u * L * sx, yy + (sole ? 0.006 : 0.012), z * w);
        }
        g.computeVertexNormals();
        return g;
      };
      const upper = shoeShape(1, 1, 1, false);
      const sole = shoeShape(1.03, 1, 1.12, true);
      sole.translate(-L * 0.015, 0, 0);
      const place = (g) => {
        // shape space (u,v,w) → model space: u along fwd, v up, w across
        const side3 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
        const m = new THREE.Matrix4().makeBasis(fwd, new THREE.Vector3(0, 1, 0), side3.clone().negate());
        m.setPosition(heel.clone().add(new THREE.Vector3(0, 0.0, 0)));
        g.applyMatrix4(m);
        g.computeVertexNormals();
        return g;
      };
      for (const [g, mat] of [[place(upper), upperMat], [place(sole), soleMat]]) {
        const ng = g.index ? g : g;
        const pos = ng.getAttribute('position'), nor = ng.getAttribute('normal'), uvA = ng.getAttribute('uv');
        const n = pos.count;
        const idxArr = ng.index ? ng.index.array : Uint32Array.from({ length: n }, (_, i) => i);
        const acc = (arr, type, Ctor = Float32Array) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buffer);
        const jj = new Uint16Array(n * 4); const ww = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { jj[i * 4] = fj; ww[i * 4] = 1; }
        const uv = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) { uv[i * 2] = uvA.getX(i) * 4; uv[i * 2 + 1] = uvA.getY(i) * 4; }
        mesh.addPrimitive(doc.createPrimitive()
          .setAttribute('POSITION', acc(pos.array, 'VEC3')).setAttribute('NORMAL', acc(nor.array, 'VEC3'))
          .setAttribute('TEXCOORD_0', acc(uv, 'VEC2')).setAttribute('JOINTS_0', acc(jj, 'VEC4', Uint16Array))
          .setAttribute('WEIGHTS_0', acc(ww, 'VEC4')).setIndices(acc(idxArr, 'SCALAR', Uint32Array)).setMaterial(mat));
      }
    }
    const node = doc.createNode('garment_shoes').setMesh(mesh).setSkin(skin);
    bodyNode.getParentNode()?.addChild(node) ?? root.getDefaultScene().addChild(node);
  }

  // cut always-covered skin (keep a margin: only tris whose 3 verts are covered)
  const kept = [];
  for (let t = 0; t < idx.length; t += 3) if (!(always.has(idx[t]) && always.has(idx[t + 1]) && always.has(idx[t + 2]))) kept.push(idx[t], idx[t + 1], idx[t + 2]);
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(buffer));
  console.log(`  body: ${idx.length / 3} → ${kept.length / 3} tris`);
  bodyMesh.setName('body');
  bodyNode.setName('body');

  // drop unused attribute sets
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    for (const s of p.listSemantics()) if (/^(TEXCOORD_[1-9]|COLOR_\d)$/.test(s)) p.setAttribute(s, null);
  }
  // second skin tone as an extra texture referenced by a dummy material
  const skinTex = (tone) => {
    const dir = `${SRC}/Base Characters/Textures/`;
    const f = gender === 'm' ? (tone === 'light' ? 'T_Superhero_Male_Ligh.png' : 'T_Superhero_Male_Dark.png') : (tone === 'light' ? 'T_Superhero_Female_Light_BaseColor.png' : 'T_Superhero_Female_Dark_BaseColor.png');
    return fs.readFileSync(dir + f);
  };
  const alt = doc.createTexture('skin_light').setImage(skinTex('light')).setMimeType('image/png');
  const altMat = doc.createMaterial('Skin_Light_Alt').setBaseColorTexture(alt);
  // keep it alive: attach to a tiny hidden primitive
  const keepPrim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(9)).setBuffer(buffer)).setMaterial(altMat);
  const keepNode = doc.createNode('skin_light_holder').setMesh(doc.createMesh('skin_light_holder').addPrimitive(keepPrim));
  root.getDefaultScene().addChild(keepNode);

  await doc.transform(
    weld(), dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }),
  );
  // male: uncompressed intermediate (retarget-people.mjs adds the clips and
  // compresses once — quantizing a skinned mesh twice corrupts it)
  if (gender === 'm') {
    const raw = '.cache/world-src/person_m.raw.glb';
    await io.write(raw, doc);
    console.log(`wrote ${raw}`);
    return;
  }
  await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, `person_${gender}.glb`);
  await io.write(out, doc);
  console.log(`wrote ${out} ${(fs.statSync(out).size / 1e6).toFixed(2)}MB`);
}

async function buildHair(io) {
  const dir = `${SRC}/Hairstyles/Origin at 0/glTF (Godot)/`;
  const doc = new (await import('@gltf-transform/core')).Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('hair');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.gltf'))) {
    const src = await io.read(dir + f);
    const name = f.replace('.gltf', '');
    for (const srcNode of src.getRoot().listNodes().filter((n) => n.getMesh())) {
      const m = srcNode.getMesh();
      // bake the node's world transform (some styles ship in cm with a node scale)
      const M = srcNode.getWorldMatrix();
      const xf = (x, y, z, w) => [M[0] * x + M[4] * y + M[8] * z + M[12] * w, M[1] * x + M[5] * y + M[9] * z + M[13] * w, M[2] * x + M[6] * y + M[10] * z + M[14] * w];
      const nm = doc.createMesh(name);
      for (const p of m.listPrimitives()) {
        const np = doc.createPrimitive();
        for (const s of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
          const a = p.getAttribute(s);
          if (!a) continue;
          let arr = a.getArray().slice();
          if (s !== 'TEXCOORD_0') {
            arr = new Float32Array(a.getCount() * 3);
            for (let i = 0; i < a.getCount(); i++) {
              const [x, y, z] = a.getElement(i, []);
              let v = xf(x, y, z, s === 'POSITION' ? 1 : 0);
              if (s === 'NORMAL') { const l = Math.hypot(...v) || 1; v = v.map((c) => c / l); }
              arr.set(v, i * 3);
            }
          }
          np.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer));
        }
        np.setIndices(doc.createAccessor().setType('SCALAR').setArray(p.getIndices().getArray().slice()).setBuffer(buffer));
        const sm = p.getMaterial();
        const mat = doc.createMaterial(sm?.getName() ?? 'Hair').setRoughnessFactor(0.7).setMetallicFactor(0).setDoubleSided(true);
        const bc = sm?.getBaseColorTexture();
        if (bc) mat.setBaseColorTexture(doc.createTexture(bc.getName()).setImage(bc.getImage()).setMimeType(bc.getMimeType()));
        const nt = sm?.getNormalTexture();
        if (nt) mat.setNormalTexture(doc.createTexture(nt.getName()).setImage(nt.getImage()).setMimeType(nt.getMimeType()));
        if (sm?.getAlphaMode() && sm.getAlphaMode() !== 'OPAQUE') mat.setAlphaMode(sm.getAlphaMode()).setAlphaCutoff(sm.getAlphaCutoff());
        np.setMaterial(mat);
        nm.addPrimitive(np);
      }
      scene.addChild(doc.createNode(name).setMesh(nm));
    }
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, 'hair.glb');
  await io.write(out, doc);
  console.log(`wrote ${out} ${(fs.statSync(out).size / 1e6).toFixed(2)}MB`);
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });
await buildPerson(io, 'm');
await buildPerson(io, 'f');
await buildHair(io);
