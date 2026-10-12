#!/usr/bin/env node
/**
 * Retarget the game's animation set (mannequin.glb, UAL2 skeleton) onto the
 * Universal Base Characters skeleton and bake the clips into person_m.glb.
 *
 * Same bone names, different rest orientations (UBC binds in a T-pose with
 * its own bone axes), so local rotations can't be shared. Per bone:
 *   delta(t)   = srcWorld(t) · srcRef⁻¹        (src ref = UAL2 A_TPose)
 *   tgtWorld   = delta(t) · tgtRef             (tgt ref = UBC bind pose)
 *   tgtLocal   = parentWorld⁻¹ · tgtWorld
 * Pelvis translation is carried over relative to each rig's hip height.
 *
 * Run after build-character.mjs and build-people.mjs.
 */

import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder as MD } from 'meshoptimizer';
import { resample, meshopt, quantize } from '@gltf-transform/functions';

const UAL2 = '.cache/world-src/ual2/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb';
const UBC_M = '.cache/world-src/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf';
const SRC_CLIPS = 'public/world/assets/characters/mannequin.glb';
const RAW = '.cache/world-src/person_m.raw.glb';
const OUT = 'public/world/assets/characters/person_m.glb';
const FPS = 30;

await MD.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MD, 'meshopt.encoder': MeshoptEncoder });

/** Skeleton-only GLB bytes (no meshes/images) so three can parse it in Node */
async function skeletonOnly(file) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  return io.writeBinary(doc);
}

async function parse(bytes) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}

const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());

const src = await parse(await skeletonOnly(SRC_CLIPS));
const ref = await parse(await skeletonOnly(UAL2));
const tgt = await parse(await skeletonOnly(UBC_M));
const S = src.scene;
const T = tgt.scene;

// source reference pose: UAL2's A_TPose applied to the source skeleton
const tpose = ref.animations.find((a) => a.name === 'A_TPose');
const mx = new THREE.AnimationMixer(S);
mx.clipAction(tpose).play();
mx.setTime(0);
S.updateMatrixWorld(true);
const bones = [];
T.traverse((o) => { if (o.isBone || /^(pelvis|spine|neck|Head|clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball|thumb|index|middle|ring|pinky|root)/.test(o.name)) bones.push(o); });
const srcRef = {};
for (const b of bones) {
  const s = S.getObjectByName(b.name);
  if (s) srcRef[b.name] = { q: wq(s), p: wp(s) };
}
mx.stopAllAction();
T.updateMatrixWorld(true);
const tgtRef = {};
for (const b of bones) tgtRef[b.name] = { q: wq(b), p: wp(b), lq: b.quaternion.clone() };
const footY = (scene, r) => Math.min(r.foot_l?.p.y ?? 0, r.foot_r?.p.y ?? 0);
const hipScale = (tgtRef.pelvis.p.y - footY(T, tgtRef)) / (srcRef.pelvis.p.y - footY(S, srcRef));
console.log(`hip scale ${hipScale.toFixed(3)}, bones ${bones.length}`);

const results = [];
for (const clip of src.animations) {
  const mixer = new THREE.AnimationMixer(S);
  mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = new Float32Array(frames);
  const rot = Object.fromEntries(bones.map((b) => [b.name, new Float32Array(frames * 4)]));
  const pel = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / FPS);
    times[f] = t;
    mixer.setTime(t);
    S.updateMatrixWorld(true);
    for (const b of bones) {
      const s = S.getObjectByName(b.name);
      if (s && srcRef[b.name]) {
        const delta = wq(s).multiply(srcRef[b.name].q.clone().invert());
        const desired = delta.multiply(tgtRef[b.name].q);
        const parentQ = b.parent ? wq(b.parent) : new THREE.Quaternion();
        b.quaternion.copy(parentQ.invert().multiply(desired));
      } else b.quaternion.copy(tgtRef[b.name].lq);
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

// write into person_m.glb
const doc = await io.read(RAW);
const root = doc.getRoot();
for (const a of root.listAnimations()) a.dispose();
const buffer = root.listBuffers()[0];
const byName = Object.fromEntries(root.listNodes().map((n) => [n.getName(), n]));
for (const r of results) {
  const anim = doc.createAnimation(r.name);
  const input = doc.createAccessor().setType('SCALAR').setArray(r.times).setBuffer(buffer);
  for (const [bone, arr] of Object.entries(r.rot)) {
    const node = byName[bone];
    if (!node) continue;
    const s = doc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
      .setOutput(doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer));
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(s));
  }
  const sp = doc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
    .setOutput(doc.createAccessor().setType('VEC3').setArray(r.pel).setBuffer(buffer));
  anim.addSampler(sp).addChannel(doc.createAnimationChannel().setTargetNode(byName.pelvis).setTargetPath('translation').setSampler(sp));
}
await doc.transform(resample({ tolerance: 1e-4 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUT, doc);
console.log(`wrote ${OUT} ${(fs.statSync(OUT).size / 1e6).toFixed(2)}MB`);
void Document;
