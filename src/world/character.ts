// Player character: Soldier.glb rig (M0 stand-in) with a speed-driven
// idle / walk / run blend. Foot sliding is a defect (brief §4): clip
// timescales are matched to actual ground speed.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Ground speeds (m/s) the Walk/Run clips were authored for; used to scale
// playback so feet track the ground at any blended speed.
const WALK_CLIP_SPEED = 1.6;
const RUN_CLIP_SPEED = 4.4;
// Blend anchors matched to the controller's speeds: full walk by 2.0 m/s,
// blending into run up to 6.8 m/s (jog territory starts just above walk).
const BLEND_WALK_FULL = 2.0;
const BLEND_RUN_FULL = 6.8;
// Airborne: hold the stride near-frozen and lean forward — the rig has no
// jump clip, and a held mid-stride pose reads as a leap.
const AIR_TIMESCALE = 0.12;
const AIR_LEAN = 0.14; // rad

export interface Character {
  root: THREE.Group;
  update(dt: number, speed: number, grounded: boolean): void;
}

export async function loadCharacter(): Promise<Character> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/world/soldier.glb');

  const root = new THREE.Group();
  const model = gltf.scene;
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });
  // The Soldier file's forward is -Z; our controller treats +Z as forward.
  model.rotation.y = Math.PI;
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const byName = new Map(gltf.animations.map((c) => [c.name, c]));
  const idleClip = byName.get('Idle') ?? gltf.animations[0];
  const walkClip = byName.get('Walk') ?? gltf.animations[0];
  const runClip = byName.get('Run') ?? walkClip;

  const idle = mixer.clipAction(idleClip);
  const walk = mixer.clipAction(walkClip);
  const run = mixer.clipAction(runClip);
  for (const a of [idle, walk, run]) {
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
  }
  idle.setEffectiveWeight(1);

  let smoothedSpeed = 0;
  let lean = 0;

  function update(dt: number, speed: number, grounded: boolean): void {
    // Smooth the speed a touch so weight changes never pop
    const k = 1 - Math.exp(-dt * 10);
    smoothedSpeed += (speed - smoothedSpeed) * k;
    const s = smoothedSpeed;

    // Weights: idle below walk speed, walk->run crossfade above
    let wIdle: number;
    let wWalk: number;
    let wRun: number;
    if (s <= 0.1) {
      wIdle = 1; wWalk = 0; wRun = 0;
    } else if (s < BLEND_WALK_FULL) {
      const t = s / BLEND_WALK_FULL;
      wIdle = 1 - t; wWalk = t; wRun = 0;
    } else {
      const t = Math.min(1, (s - BLEND_WALK_FULL) / (BLEND_RUN_FULL - BLEND_WALK_FULL));
      wIdle = 0; wWalk = 1 - t; wRun = t;
    }
    idle.setEffectiveWeight(wIdle);
    walk.setEffectiveWeight(wWalk);
    run.setEffectiveWeight(wRun);

    // Match stride to ground speed: timescale clips relative to authored speeds
    let scale = 1;
    if (s > 0.1) {
      const clipSpeed = wRun > 0
        ? THREE.MathUtils.lerp(WALK_CLIP_SPEED, RUN_CLIP_SPEED, wRun)
        : WALK_CLIP_SPEED;
      scale = THREE.MathUtils.clamp(s / clipSpeed, 0.6, 1.8);
    }
    // Airborne: near-freeze the stride (leap pose) and lean into the jump
    const targetScale = grounded ? scale : AIR_TIMESCALE;
    const targetLean = grounded ? 0 : AIR_LEAN;
    walk.setEffectiveTimeScale(targetScale);
    run.setEffectiveTimeScale(targetScale);
    idle.setEffectiveTimeScale(grounded ? 1 : AIR_TIMESCALE);
    const k2 = 1 - Math.exp(-dt * 12);
    lean += (targetLean - lean) * k2;
    model.rotation.x = lean;

    mixer.update(dt);
  }

  return { root, update };
}
