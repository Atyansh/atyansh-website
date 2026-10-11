#!/usr/bin/env node
/**
 * The Block — character asset build.
 *
 * Produces public/world/assets/characters/mannequin.glb: the Quaternius UAL2
 * mannequin (CC0) carrying ONE animation set assembled from both Universal
 * Animation Library packs. UAL1 ships on a Rigify skeleton (DEF-* bones) while
 * UAL2 uses Unreal naming and different bone axes, so UAL1 clips are
 * retargeted here, offline, using world-space rotation deltas:
 *
 *   delta_src(t)  = srcWorld(t) · srcRef⁻¹            (per mapped bone)
 *   tgtWorld(t)   = R · delta_src(t) · R⁻¹ · tgtRef
 *   tgtLocal(t)   = parentWorld(t)⁻¹ · tgtWorld(t)       (top-down)
 *
 * "Ref" is each pack's own A_TPose clip, so rest-pose differences cancel; R
 * aligns the two rigs' world frames (derived from hips/spine axes). Hip
 * translation is transferred scaled by the leg-length ratio.
 *
 * Also writes mannequin_f.glb (female mesh, same skeleton, no clips — it
 * plays the same clips by bone name). Inputs: .cache/world-src/ual{,2}.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const SRC = '.cache/world-src';
const UAL1 = path.join(SRC, 'ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb');
const UAL2 = path.join(SRC, 'ual2/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb');
const UAL2F = path.join(SRC, 'ual2/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb');
const OUT = 'public/world/assets/characters';
const FPS = 30;

// UAL1 clips to retarget (renamed to the in-game names on the right)
const UAL1_CLIPS = {
  Idle_Loop: 'Idle', Walk_Loop: 'Walk', Jog_Fwd_Loop: 'Jog', Sprint_Loop: 'Sprint',
  Jump_Start: 'JumpStart', Jump_Loop: 'JumpLoop', Jump_Land: 'JumpLand',
  Crouch_Idle_Loop: 'CrouchIdle', Crouch_Fwd_Loop: 'CrouchWalk',
  Sitting_Enter: 'SitDown', Sitting_Idle_Loop: 'SitIdle', Sitting_Exit: 'StandUp',
  Sitting_Talking_Loop: 'SitTalk', Interact: 'Interact', PickUp_Table: 'PickUp',
  Fixing_Kneeling: 'Kneel', Roll: 'Roll', Dance_Loop: 'Dance',
  Idle_Talking_Loop: 'Talk', Walk_Formal_Loop: 'WalkFormal', Push_Loop: 'Push',
};
// UAL2 clips kept as-is (native skeleton)
const UAL2_CLIPS = {
  ClimbUp_1m_RM: 'Mantle', OverhandThrow: 'Throw', Idle_TalkingPhone_Loop: 'Phone',
  Idle_FoldArms_Loop: 'FoldArms', Idle_Rail_Loop: 'RailLean', Idle_Rail_Call: 'RailCall',
  LayToIdle: 'LayToIdle', Yes: 'Yes', Idle_No_Loop: 'No', Walk_Carry_Loop: 'WalkCarry',
  Consume: 'Drink', Chest_Open: 'Open', Farm_Watering: 'Watering',
};

// Rigify (sanitized by three: dots removed) -> Unreal-style bone names
const BONE_MAP = {
  'DEF-hips': 'pelvis', 'DEF-spine001': 'spine_01', 'DEF-spine002': 'spine_02',
  'DEF-spine003': 'spine_03', 'DEF-neck': 'neck_01', 'DEF-head': 'Head',
};
for (const [s, t] of [['L', 'l'], ['R', 'r']]) {
  Object.assign(BONE_MAP, {
    [`DEF-shoulder${s}`]: `clavicle_${t}`, [`DEF-upper_arm${s}`]: `upperarm_${t}`,
    [`DEF-forearm${s}`]: `lowerarm_${t}`, [`DEF-hand${s}`]: `hand_${t}`,
    [`DEF-thigh${s}`]: `thigh_${t}`, [`DEF-shin${s}`]: `calf_${t}`,
    [`DEF-foot${s}`]: `foot_${t}`, [`DEF-toe${s}`]: `ball_${t}`,
  });
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    for (const n of [1, 2, 3]) BONE_MAP[`DEF-f_${f}0${n}${s}`] = `${f}_0${n}_${t}`;
  }
  for (const n of [1, 2, 3]) BONE_MAP[`DEF-thumb0${n}${s}`] = `thumb_0${n}_${t}`;
}

async function loadGLB(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

function poseAt(scene, clip, t) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(t);
  scene.updateMatrixWorld(true);
  return mixer;
}

const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());

/** Orthonormal basis from a rig's ref pose: X = left->right hip, Y = pelvis->head */
function rigBasis(scene, names) {
  const lh = wp(scene.getObjectByName(names.thighL));
  const rh = wp(scene.getObjectByName(names.thighR));
  const pel = wp(scene.getObjectByName(names.pelvis));
  const head = wp(scene.getObjectByName(names.head));
  const x = rh.clone().sub(lh).normalize();
  const yRaw = head.clone().sub(pel).normalize();
  const z = new THREE.Vector3().crossVectors(x, yRaw).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = await loadGLB(UAL1);
  const tgt = await loadGLB(UAL2);
  const srcScene = src.scene;
  const tgtScene = tgt.scene;
  const clipBy = (g, n) => g.animations.find((a) => a.name === n);

  // Reference poses
  poseAt(srcScene, clipBy(src, 'A_TPose'), 0);
  const srcRef = {};
  for (const s of Object.keys(BONE_MAP)) {
    const o = srcScene.getObjectByName(s);
    if (!o) throw new Error(`missing src bone ${s}`);
    srcRef[s] = { q: wq(o), p: wp(o) };
  }
  const srcBasis = rigBasis(srcScene, { thighL: 'DEF-thighL', thighR: 'DEF-thighR', pelvis: 'DEF-hips', head: 'DEF-head' });
  const srcHipH = srcRef['DEF-hips'].p.y - Math.min(srcRef['DEF-footL'].p.y, srcRef['DEF-footR'].p.y);

  poseAt(tgtScene, clipBy(tgt, 'A_TPose'), 0);
  const tgtBones = [];
  tgtScene.traverse((o) => { if (o.isBone) tgtBones.push(o); }); // traverse = top-down
  const tgtRef = {};
  for (const b of tgtBones) tgtRef[b.name] = { q: wq(b), p: wp(b), lq: b.quaternion.clone(), lp: b.position.clone() };
  const tgtBasis = rigBasis(tgtScene, { thighL: 'thigh_l', thighR: 'thigh_r', pelvis: 'pelvis', head: 'Head' });
  const tgtHipH = tgtRef.pelvis.p.y - Math.min(tgtRef.foot_l.p.y, tgtRef.foot_r.p.y);
  const hipScale = tgtHipH / srcHipH;

  // R maps src-world directions onto tgt-world directions
  const R = tgtBasis.clone().multiply(srcBasis.clone().invert());
  const Rq = new THREE.Quaternion().setFromRotationMatrix(R);
  const RqInv = Rq.clone().invert();
  console.log(`hip heights src ${srcHipH.toFixed(3)} tgt ${tgtHipH.toFixed(3)}; R ≈ ${new THREE.Euler().setFromQuaternion(Rq).toArray().slice(0, 3).map((v) => (v * 57.3).toFixed(0)).join(',')}°`);

  const reverseMap = Object.fromEntries(Object.entries(BONE_MAP).map(([s, t]) => [t, s]));
  const retargeted = [];

  for (const [srcName, outName] of Object.entries(UAL1_CLIPS)) {
    const clip = clipBy(src, srcName);
    if (!clip) { console.warn(`  skip ${srcName} (missing)`); continue; }
    const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
    const times = new Float32Array(frames);
    const rot = {}; // tgt bone -> Float32Array(frames*4)
    for (const b of tgtBones) rot[b.name] = new Float32Array(frames * 4);
    const pelvisPos = new Float32Array(frames * 3);

    for (let f = 0; f < frames; f++) {
      const t = Math.min(clip.duration, f / FPS);
      times[f] = t;
      poseAt(srcScene, clip, t);
      // Top-down solve on the target skeleton
      for (const b of tgtBones) {
        const s = reverseMap[b.name];
        if (s) {
          const sw = wq(srcScene.getObjectByName(s));
          const delta = sw.multiply(srcRef[s].q.clone().invert());
          const deltaT = Rq.clone().multiply(delta).multiply(RqInv);
          const desired = deltaT.multiply(tgtRef[b.name].q);
          const parentQ = b.parent ? wq(b.parent) : new THREE.Quaternion();
          b.quaternion.copy(parentQ.invert().multiply(desired));
        } else {
          b.quaternion.copy(tgtRef[b.name].lq);
        }
        if (b.name === 'pelvis') {
          const sp = wp(srcScene.getObjectByName('DEF-hips')).sub(srcRef['DEF-hips'].p);
          sp.applyQuaternion(Rq).multiplyScalar(hipScale);
          const desiredP = tgtRef.pelvis.p.clone().add(sp);
          b.position.copy(b.parent.worldToLocal(desiredP));
        }
        b.updateMatrixWorld(true);
        rot[b.name].set(b.quaternion.toArray(), f * 4);
        if (b.name === 'pelvis') pelvisPos.set(b.position.toArray(), f * 3);
      }
    }
    retargeted.push({ name: outName, times, rot, pelvisPos });
    process.stdout.write(`  ${outName}(${frames}) `);
  }
  console.log(`\nretargeted ${retargeted.length} clips`);

  // ---- Write via glTF-Transform onto the UAL2 document ----
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(UAL2);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const nodeByName = Object.fromEntries(root.listNodes().map((n) => [n.getName(), n]));

  // Keep only the UAL2 clips we want, renamed
  for (const anim of root.listAnimations()) {
    const keep = UAL2_CLIPS[anim.getName()];
    if (keep) anim.setName(keep);
    else anim.dispose();
  }
  for (const r of retargeted) {
    const anim = doc.createAnimation(r.name);
    const input = doc.createAccessor().setType('SCALAR').setArray(r.times).setBuffer(buffer);
    for (const [bone, arr] of Object.entries(r.rot)) {
      const node = nodeByName[bone];
      if (!node) continue;
      const out = doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(
        doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler));
    }
    const outP = doc.createAccessor().setType('VEC3').setArray(r.pelvisPos).setBuffer(buffer);
    const sP = doc.createAnimationSampler().setInput(input).setOutput(outP).setInterpolation('LINEAR');
    anim.addSampler(sP).addChannel(
      doc.createAnimationChannel().setTargetNode(nodeByName.pelvis).setTargetPath('translation').setSampler(sP));
  }

  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, 'mannequin.glb'), doc);

  // Female mesh: geometry + skeleton only
  const docF = await io.read(UAL2F);
  for (const a of docF.getRoot().listAnimations()) a.dispose();
  await docF.transform(prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, 'mannequin_f.glb'), docF);

  const sz = (f) => (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2);
  console.log(`wrote mannequin.glb ${sz('mannequin.glb')}MB (${doc.getRoot().listAnimations().length} clips), mannequin_f.glb ${sz('mannequin_f.glb')}MB`);
  console.log('clips:', doc.getRoot().listAnimations().map((a) => a.getName()).join(' '));
}

main().catch((e) => { console.error(e); process.exit(1); });
