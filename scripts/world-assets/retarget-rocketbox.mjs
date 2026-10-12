#!/usr/bin/env node
/**
 * Retarget the game's animation set (mannequin.glb, UAL2 skeleton) onto the
 * Rocketbox Biped skeleton (bones renamed by build-rocketbox.mjs) and write
 * the clips into a skeleton-only GLB shared by every avatar of that gender.
 *
 * Rocketbox binds in an A-pose, the source reference (UAL2 A_TPose) is a
 * T-pose, so first the target is posed to match: walking down the hierarchy,
 * each bone is swung so the direction to its child matches the source.
 * Then per frame and bone:
 *   delta(t) = srcWorld(t) · srcRef⁻¹;  tgtWorld = delta(t) · tgtRef
 *   tgtLocal = parentWorld⁻¹ · tgtWorld
 * Pelvis translation is carried over relative to each rig's hip height.
 *
 *   node scripts/world-assets/retarget-rocketbox.mjs <avatar.glb> <out.glb>
 */

import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder as MD } from 'meshoptimizer';
import { resample, meshopt, quantize, prune } from '@gltf-transform/functions';

const UAL2 = '.cache/world-src/ual2/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb';
const SRC_CLIPS = 'public/world/assets/characters/mannequin.glb';
const [TGT, OUT] = process.argv.slice(2);
const FPS = 30;

await MD.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MD, 'meshopt.encoder': MeshoptEncoder });

async function skeletonDoc(file, keepAnims = false) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  if (!keepAnims) for (const a of root.listAnimations()) a.dispose();
  await doc.transform(prune({ keepLeaves: true }));
  return doc;
}
async function parse(doc) {
  const bytes = await io.writeBinary(doc);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}

const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());

const src = await parse(await skeletonDoc(SRC_CLIPS, true));
const ref = await parse(await io.read(UAL2).then(async (d) => { const r = d.getRoot(); for (const n of r.listNodes()) { n.setMesh(null); n.setSkin(null); } for (const m of r.listMeshes()) m.dispose(); for (const t of r.listTextures()) t.dispose(); await d.transform(prune({ keepLeaves: true })); return d; }));
const tgtDoc = await skeletonDoc(TGT);
const tgt = await parse(tgtDoc);
const S = src.scene;
const T = tgt.scene;

// ---- source reference: UAL2 T-pose on the source skeleton ----
const tpose = ref.animations.find((a) => a.name === 'A_TPose');
const mx = new THREE.AnimationMixer(S);
mx.clipAction(tpose).play();
mx.setTime(0);
S.updateMatrixWorld(true);
const mapped = [];
T.traverse((o) => { if (S.getObjectByName(o.name) && o !== T && o.name !== 'root') mapped.push(o); });
const srcRef = {};
for (const b of mapped) { const s = S.getObjectByName(b.name); srcRef[b.name] = { q: wq(s), p: wp(s) }; }
mx.stopAllAction();
console.log(`mapped ${mapped.length} bones`);

// ---- pose the target into the source's T-pose (swing each bone to match its child direction) ----
const CHILD = {
  pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
};
for (const s of ['l', 'r']) {
  Object.assign(CHILD, {
    [`clavicle_${s}`]: `upperarm_${s}`, [`upperarm_${s}`]: `lowerarm_${s}`, [`lowerarm_${s}`]: `hand_${s}`, [`hand_${s}`]: `middle_01_${s}`,
    [`thigh_${s}`]: `calf_${s}`, [`calf_${s}`]: `foot_${s}`, [`foot_${s}`]: `ball_${s}`,
  });
  for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) Object.assign(CHILD, { [`${f}_01_${s}`]: `${f}_02_${s}`, [`${f}_02_${s}`]: `${f}_03_${s}` });
}
T.updateMatrixWorld(true);
const bindLocal = Object.fromEntries(mapped.map((b) => [b.name, b.quaternion.clone()]));
// top-down order (traverse order is parent-first)
for (const b of mapped) {
  const c = CHILD[b.name];
  if (!c || b.name === 'pelvis' || !srcRef[c]) continue;
  const tc = T.getObjectByName(c);
  if (!tc) continue;
  T.updateMatrixWorld(true);
  const dT = wp(tc).sub(wp(b)).normalize();
  const dS = srcRef[c].p.clone().sub(srcRef[b.name].p).normalize();
  const swing = new THREE.Quaternion().setFromUnitVectors(dT, dS);
  const world = swing.multiply(wq(b));
  b.quaternion.copy(wq(b.parent).invert().multiply(world));
}
T.updateMatrixWorld(true);
const tgtRef = {};
for (const b of mapped) tgtRef[b.name] = { q: wq(b), p: wp(b) };
const footY = (r) => Math.min(r.foot_l.p.y, r.foot_r.p.y);
const hipScale = (tgtRef.pelvis.p.y - footY(tgtRef)) / (srcRef.pelvis.p.y - footY(srcRef));
console.log(`hip scale ${hipScale.toFixed(3)}`);

// ---- bake ----
const results = [];
for (const clip of src.animations) {
  const mixer = new THREE.AnimationMixer(S);
  mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = new Float32Array(frames);
  const rot = Object.fromEntries(mapped.map((b) => [b.name, new Float32Array(frames * 4)]));
  const pel = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / FPS);
    times[f] = t;
    mixer.setTime(t);
    S.updateMatrixWorld(true);
    for (const b of mapped) {
      const s = S.getObjectByName(b.name);
      const delta = wq(s).multiply(srcRef[b.name].q.clone().invert());
      const desired = delta.multiply(tgtRef[b.name].q);
      b.quaternion.copy(wq(b.parent).invert().multiply(desired));
      if (b.name === 'pelvis') {
        const off = wp(s).sub(srcRef.pelvis.p).multiplyScalar(hipScale);
        b.position.copy(b.parent.worldToLocal(tgtRef.pelvis.p.clone().add(off)));
        pel.set(b.position.toArray(), f * 3);
      }
      b.updateMatrixWorld(true);
      rot[b.name].set(b.quaternion.toArray(), f * 4);
    }
  }
  results.push({ name: clip.name, times, rot, pel });
}
console.log(`retargeted ${results.length} clips`);
void bindLocal;

// ---- write: skeleton + clips ----
const root = tgtDoc.getRoot();
const buffer = root.listBuffers()[0] ?? tgtDoc.createBuffer();
const byName = Object.fromEntries(root.listNodes().map((n) => [n.getName(), n]));
// glTF node names may still carry spaces; three sanitises them the same way
const node = (name) => byName[name] ?? root.listNodes().find((n) => n.getName().replace(/[^A-Za-z0-9_]/g, '_') === name);
for (const r of results) {
  const anim = tgtDoc.createAnimation(r.name);
  const input = tgtDoc.createAccessor().setType('SCALAR').setArray(r.times).setBuffer(buffer);
  for (const [bone, arr] of Object.entries(r.rot)) {
    const n = node(bone);
    if (!n) continue;
    const s = tgtDoc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
      .setOutput(tgtDoc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer));
    anim.addSampler(s).addChannel(tgtDoc.createAnimationChannel().setTargetNode(n).setTargetPath('rotation').setSampler(s));
  }
  const sp = tgtDoc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
    .setOutput(tgtDoc.createAccessor().setType('VEC3').setArray(r.pel).setBuffer(buffer));
  anim.addSampler(sp).addChannel(tgtDoc.createAnimationChannel().setTargetNode(node('pelvis')).setTargetPath('translation').setSampler(sp));
}
await tgtDoc.transform(resample({ tolerance: 1e-4 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUT, tgtDoc);
console.log(`wrote ${OUT} ${(fs.statSync(OUT).size / 1e6).toFixed(2)}MB`);
