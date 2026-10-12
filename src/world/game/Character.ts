// Skinned humanoid (Quaternius UAL mannequin) + animation controller.
// Shared by the player and NPCs.
//
// Two layers:
//  - Locomotion: Idle/Walk/Jog/Sprint (or CrouchIdle/CrouchWalk) always
//    playing; weights follow ground speed and playback is stride-synced:
//    every moving clip advances by the same normalised phase, at a rate of
//    speed / blended-stride-length — so feet don't slide at any speed.
//  - Override: one full-body action (jump, sit, kneel, throw, mantle…) that
//    cross-fades over locomotion and back.
//
// Each clip's natural ground speed is measured at load from the foot bones
// (median foot velocity while in ground contact), not hand-tuned.

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, damp } from '../engine/math';

const LOCO = ['Idle', 'Walk', 'Jog', 'Sprint'] as const;
const CROUCH = ['CrouchIdle', 'CrouchWalk'] as const;
type LocoName = (typeof LOCO)[number] | (typeof CROUCH)[number];

/** How a person (UBC body) is dressed */
export interface Look {
  skin: 'light' | 'dark';
  top: 'shirt_short' | 'shirt_long' | 'jacket';
  bottom: 'pants' | 'shorts';
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  hair: string | null;
  hairColor: string;
  beard?: boolean;
}

export interface OverrideOptions {
  fade?: number;
  loop?: boolean;
  timeScale?: number;
  /** start offset as a fraction of the clip */
  from?: number;
  /** stop (and fire onDone) at this fraction instead of the clip end */
  to?: number;
  onDone?: () => void;
  /** keep holding the last frame instead of fading back to locomotion */
  hold?: boolean;
}

let _fabric: THREE.CanvasTexture | null = null;
let _fabricN: THREE.CanvasTexture | null = null;
/** Subtle woven-fabric albedo variation (tinted by material colour) */
function fabricTexture(): THREE.CanvasTexture {
  if (_fabric) return _fabric;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 200 + Math.floor(Math.random() * 55);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  _fabric = new THREE.CanvasTexture(c);
  _fabric.colorSpace = THREE.SRGBColorSpace;
  _fabric.wrapS = _fabric.wrapT = THREE.RepeatWrapping;
  _fabric.repeat.set(6, 6);
  return _fabric;
}
/** Twill weave normal map */
function fabricNormal(): THREE.CanvasTexture {
  if (_fabricN) return _fabricN;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ph = ((x + y) % 8) / 8; // diagonal twill
    const nx = Math.sin(ph * Math.PI * 2) * 0.35;
    const ny = Math.cos(((x * 3) % 16) / 16 * Math.PI * 2) * 0.12;
    const i = (y * S + x) * 4;
    img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
    img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _fabricN = new THREE.CanvasTexture(c);
  _fabricN.wrapS = _fabricN.wrapT = THREE.RepeatWrapping;
  _fabricN.repeat.set(24, 24);
  return _fabricN;
}

/** Cache of measured clip ground speeds (shared across instances) */
const speedCache = new Map<string, number>();
const phaseCache = new Map<string, number>();
/** Ground speeds the UAL locomotion clips were authored for (m/s) */
const AUTHORED_SPEED: Record<string, number> = { Walk: 1.35, Jog: 3.7, Sprint: 6.6, CrouchWalk: 0.9 };

export class Character {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private clips = new Map<string, THREE.AnimationClip>();
  readonly bones = new Map<string, THREE.Bone>();
  private locoW: Record<LocoName, number> = { Idle: 1, Walk: 0, Jog: 0, Sprint: 0, CrouchIdle: 0, CrouchWalk: 0 };
  private phase = 0;
  private override: THREE.AnimationAction | null = null;
  private overrideW = 0;
  private overrideFade = 0.2;
  private overrideTarget = 0;
  private overrideOpts: OverrideOptions = {};
  private natural: Record<string, number> = {};
  private phaseOff: Record<string, number> = {};
  readonly materials: THREE.MeshStandardMaterial[] = [];

  constructor(gltf: GLTF, clipSource: THREE.AnimationClip[] = gltf.animations) {
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // skinned bounds don't follow the pose
        // Per-instance materials so outfits/tints don't leak between characters
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const cloned = mats.map((mm) => {
          const c = (mm as THREE.MeshStandardMaterial).clone();
          this.materials.push(c);
          return c;
        });
        m.material = Array.isArray(m.material) ? cloned : cloned[0];
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    // Clips carry absolute pelvis positions for the rig they were authored
    // on; scale them to this body's hip height so feet stay on the ground
    this.model.updateMatrixWorld(true);
    const pelvis = this.model.getObjectByName('pelvis');
    let pelvisScale = 1;
    const idle = clipSource.find((c) => c.name === 'Idle');
    const track = idle?.tracks.find((t) => t.name === 'pelvis.position');
    if (pelvis && track) {
      // compare rest vs clip pelvis offset in the pelvis' parent space (axis
      // agnostic: some rigs are Z-up under their root bone)
      const rest = pelvis.position.length();
      const clipLen = Math.hypot(track.values[0], track.values[1], track.values[2]);
      if (clipLen > 0.01) pelvisScale = rest / clipLen;
      if (Math.abs(pelvisScale - 1) < 0.02) pelvisScale = 1;
    }
    for (const clip of clipSource) {
      // Root motion is applied by gameplay code, never by the clip
      const c = clip.clone();
      c.tracks = c.tracks.filter((t) => !t.name.startsWith('root.')).map((t) => {
        if (pelvisScale === 1 || t.name !== 'pelvis.position') return t;
        const nt = t.clone();
        for (let i = 0; i < nt.values.length; i++) nt.values[i] *= pelvisScale;
        return nt;
      });
      this.clips.set(c.name, c);
    }
    this.collectParts();
    for (const name of [...LOCO, ...CROUCH]) {
      const a = this.action(name);
      if (!a) continue;
      a.play();
      a.setEffectiveWeight(name === 'Idle' ? 1 : 0);
    }
    for (const name of ['Walk', 'Jog', 'Sprint', 'CrouchWalk']) {
      this.natural[name] = this.measureSpeed(name);
    }
  }

  action(name: string): THREE.AnimationAction | null {
    let a = this.actions.get(name);
    if (a) return a;
    const clip = this.clips.get(name);
    if (!clip) return null;
    a = this.mixer.clipAction(clip);
    this.actions.set(name, a);
    return a;
  }

  hasClip(name: string): boolean {
    return this.clips.has(name);
  }

  clipDuration(name: string): number {
    return this.clips.get(name)?.duration ?? 0;
  }

  /**
   * Ground speed + phase offset of a looping locomotion clip.
   * Speed: each foot sweeps front→back relative to the body once per cycle;
   * during stance that sweep equals ground travel, so speed ≈ 2·range / T.
   * Phase: the moment the left foot is furthest forward (heel strike), so
   * blended clips plant the same foot at the same time.
   */
  private measureSpeed(name: string): number {
    const cached = speedCache.get(name);
    if (cached) {
      this.phaseOff[name] = phaseCache.get(name) ?? 0;
      return cached;
    }
    const clip = this.clips.get(name);
    if (!clip) return 1;
    const probe = SkeletonUtils.clone(this.model);
    const mixer = new THREE.AnimationMixer(probe);
    mixer.clipAction(clip).play();
    const feet = ['foot_l', 'foot_r'].map((n) => probe.getObjectByName(n)!).filter(Boolean);
    const pelvis = probe.getObjectByName('pelvis')!;
    const N = 72;
    const zs: number[][] = feet.map(() => []);
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * clip.duration);
      probe.updateMatrixWorld(true);
      const pz = pelvis.getWorldPosition(new THREE.Vector3()).z;
      feet.forEach((f, fi) => zs[fi].push(f.getWorldPosition(new THREE.Vector3()).z - pz));
    }
    const range = zs.map((a) => Math.max(...a) - Math.min(...a)).reduce((a, b) => a + b, 0) / zs.length;
    // Foot sweep misses the airborne part of a running stride, so the
    // authored speeds of the known clips win; the measurement covers others
    const v = AUTHORED_SPEED[name] ?? clamp((2 * range) / clip.duration, 0.4, 12);
    const left = zs[0];
    const off = left.indexOf(Math.max(...left)) / N;
    speedCache.set(name, v);
    phaseCache.set(name, off);
    this.phaseOff[name] = off;
    return v;
  }

  /** Model-space offset of a bone in a clip pose (e.g. pelvis while seated) */
  boneOffset(clipName: string, bone: string, t = 0.5): THREE.Vector3 {
    const clip = this.clips.get(clipName);
    const probe = SkeletonUtils.clone(this.model);
    probe.position.set(0, 0, 0);
    probe.rotation.set(0, 0, 0);
    if (clip) {
      const mixer = new THREE.AnimationMixer(probe);
      mixer.clipAction(clip).play();
      mixer.setTime(t * clip.duration);
    }
    probe.updateMatrixWorld(true);
    return probe.getObjectByName(bone)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  }

  naturalSpeed(name: string): number {
    return this.natural[name] ?? 1;
  }

  /** Drive the locomotion layer from ground speed (m/s) */
  locomote(speed: number, crouch: boolean, dt: number): void {
    const target: Record<LocoName, number> = { Idle: 0, Walk: 0, Jog: 0, Sprint: 0, CrouchIdle: 0, CrouchWalk: 0 };
    let rate = 0; // cycles per second for moving clips
    if (crouch) {
      const v = this.natural.CrouchWalk;
      const w = clamp(speed / Math.max(0.3, v * 0.6), 0, 1);
      target.CrouchIdle = 1 - w;
      target.CrouchWalk = w;
      rate = speed / (v * this.clipDuration('CrouchWalk'));
    } else {
      const pts: Array<[LocoName, number]> = [
        ['Idle', 0], ['Walk', this.natural.Walk], ['Jog', this.natural.Jog], ['Sprint', this.natural.Sprint],
      ];
      let i = 0;
      while (i < pts.length - 2 && speed > pts[i + 1][1]) i++;
      const [a, va] = pts[i];
      const [b, vb] = pts[i + 1];
      const t = clamp((speed - va) / Math.max(0.01, vb - va), 0, 1);
      target[a] = 1 - t;
      target[b] = t;
      // Blended stride length → shared cycle rate (Idle contributes Walk's stride)
      const stride = (n: LocoName) => this.natural[n === 'Idle' ? 'Walk' : n] * this.clipDuration(n === 'Idle' ? 'Walk' : n);
      const L = stride(a) * (1 - t) + stride(b) * t;
      rate = speed / Math.max(0.1, L);
    }
    this.phase = (this.phase + rate * dt) % 1;
    for (const n of Object.keys(this.locoW) as LocoName[]) {
      this.locoW[n] = damp(this.locoW[n], target[n], 10, dt);
      const a = this.actions.get(n);
      if (!a) continue;
      a.setEffectiveWeight(this.locoW[n] * (1 - this.overrideW));
      if (n === 'Idle' || n === 'CrouchIdle') a.timeScale = 1;
      else {
        a.timeScale = 0; // phase-driven, aligned on left-foot strike
        a.time = ((this.phase + (this.phaseOff[n] ?? 0)) % 1) * a.getClip().duration;
      }
    }
  }

  /** Play a full-body override; returns the action */
  play(name: string, opts: OverrideOptions = {}): THREE.AnimationAction | null {
    const a = this.action(name);
    if (!a) return null;
    const prev = this.override;
    if (prev && prev !== a) prev.fadeOut(opts.fade ?? 0.2);
    a.reset();
    a.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, opts.loop ? Infinity : 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.timeScale ?? 1;
    a.time = (opts.from ?? 0) * a.getClip().duration;
    a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a) a.fadeIn(opts.fade ?? 0.2);
    this.override = a;
    this.overrideOpts = opts;
    this.overrideTarget = 1;
    this.overrideFade = opts.fade ?? 0.2;
    return a;
  }

  /** Fade the override out and return to locomotion */
  stopOverride(fade = 0.25): void {
    this.overrideTarget = 0;
    this.overrideFade = fade;
  }

  get overrideName(): string | null {
    return this.overrideTarget > 0 && this.override ? this.override.getClip().name : null;
  }

  update(dt: number): void {
    // Override bookkeeping
    const o = this.override;
    if (o && this.overrideTarget > 0 && !this.overrideOpts.loop) {
      const clip = o.getClip();
      const end = (this.overrideOpts.to ?? 1) * clip.duration;
      if (o.time >= end - 1e-3) {
        const done = this.overrideOpts.onDone;
        this.overrideOpts.onDone = undefined;
        if (!this.overrideOpts.hold) this.overrideTarget = 0;
        else o.paused = true;
        done?.();
      }
    }
    const k = this.overrideFade > 0 ? dt / this.overrideFade : 1;
    this.overrideW = this.overrideTarget > this.overrideW
      ? Math.min(this.overrideTarget, this.overrideW + k)
      : Math.max(this.overrideTarget, this.overrideW - k);
    if (o) {
      o.setEffectiveWeight(this.overrideW);
      if (this.overrideW <= 0 && this.overrideTarget === 0) {
        o.stop();
        this.override = null;
      }
    }
    this.mixer.update(dt);
  }

  // ---------------- people (UBC bodies) ----------------

  private garments = new Map<string, THREE.Mesh[]>();
  private bodyMesh: THREE.Mesh | null = null;
  private skinTex: Record<'light' | 'dark', THREE.Texture | null> = { light: null, dark: null };
  private hairMesh: THREE.Object3D | null = null;
  get isPerson(): boolean { return this.bodyMesh !== null; }

  private collectParts(): void {
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (o.name.startsWith('garment_')) {
        // multi-primitive meshes load as name_1, name_2…
        const key = o.name.slice(8).replace(/_\d+$/, '');
        const list = this.garments.get(key) ?? [];
        list.push(m);
        this.garments.set(key, list);
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
          if (mat.name === 'Garment_sole') continue;
          mat.map = fabricTexture();
          mat.normalMap = fabricNormal();
          mat.normalScale.setScalar(0.6);
          mat.roughness = mat.name === 'Garment_shoes' ? 0.55 : 0.9;
        }
      } else if (o.name === 'body') {
        this.bodyMesh = m;
        this.skinTex.dark = (m.material as THREE.MeshStandardMaterial).map;
      } else if (o.name === 'skin_light_holder') {
        this.skinTex.light = (m.material as THREE.MeshStandardMaterial).map;
        m.visible = false;
      }
    });
  }

  /** Dress a person: skin tone, garments + colours, hairstyle */
  dress(look: Look, hairLib?: THREE.Object3D, female = false): void {
    if (!this.bodyMesh) return;
    const bm = this.bodyMesh.material as THREE.MeshStandardMaterial;
    const tex = this.skinTex[look.skin] ?? this.skinTex.dark;
    if (tex && bm.map !== tex) { bm.map = tex; bm.needsUpdate = true; }
    for (const [name, meshes] of this.garments) for (const mesh of meshes) {
      const on = name === look.top || name === look.bottom || name === 'shoes';
      mesh.visible = on;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (mat.name === 'Garment_sole') continue;
        if (name === 'shoes') mat.color.set(look.shoeColor);
        else if (name === look.top) mat.color.set(look.topColor);
        else if (name === look.bottom) mat.color.set(look.bottomColor);
        if (name === 'pants' || name === 'shorts') mat.normalScale.setScalar(0.9);
      }
    }
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /brow/i.test(o.name)) (m.material as THREE.MeshStandardMaterial).color.set(look.hairColor);
    });
    // hair: model-space mesh re-parented to the head bone at its bind pose
    if (this.hairMesh) { this.hairMesh.removeFromParent(); this.hairMesh = null; }
    const head = this.bones.get('Head');
    const skinned = this.bodyMesh as THREE.SkinnedMesh;
    if (look.hair && hairLib && head && skinned.isSkinnedMesh) {
      const src = hairLib.getObjectByName(look.hair);
      if (src) {
        const group = new THREE.Group();
        for (const part of [src, look.beard ? hairLib.getObjectByName('Hair_Beard') : null]) {
          if (!part) continue;
          const h = part.clone(true);
          h.traverse((o) => {
            const mm = o as THREE.Mesh;
            if (!mm.isMesh) return;
            mm.material = (mm.material as THREE.MeshStandardMaterial).clone();
            (mm.material as THREE.MeshStandardMaterial).color.set(look.hairColor);
            mm.castShadow = true;
          });
          group.add(h);
        }
        // hair is authored around the male head; shift for the female head
        if (female) group.position.set(0, -0.05, 0.006);
        // map model space → head bone space using the rest pose (dress runs
        // before the first mixer update, so the skeleton is still at rest)
        this.model.updateMatrixWorld(true);
        const holder = new THREE.Group();
        holder.add(group);
        holder.applyMatrix4(head.matrixWorld.clone().invert().multiply(this.model.matrixWorld));
        head.add(holder);
        this.hairMesh = holder;
      }
    }
  }

  /** Recolour the mannequin (outfits / NPC variety) */
  tint(body: THREE.ColorRepresentation, joints: THREE.ColorRepresentation): void {
    for (const m of this.materials) {
      if (m.name === 'M_Main') m.color.set(body);
      else if (m.name === 'M_Joints') m.color.set(joints);
      m.roughness = 0.55;
    }
  }
}
