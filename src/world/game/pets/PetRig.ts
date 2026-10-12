// Procedural pet rig v2: sculpted SDF anatomy (see sculpt.ts), coats painted
// in 3D per vertex, shell fur with per-region length + combing, glossy eyes
// with real irises, rigid ears/nose/whiskers on bones.
//
// Animation is procedural: gait cycle, spring tail, breathing, ear
// twitches, head look-at and blended poses (stand, sit, loaf, sleep, belly).

import * as THREE from 'three';
import { clamp, damp, rng } from '../../engine/math';
import { sculpt, type Prim } from './sculpt';

export type Pose = 'stand' | 'sit' | 'loaf' | 'sleep' | 'belly' | 'stretch';
export type Tag = 'hips' | 'belly' | 'chest' | 'neck' | 'head' | 'cheek' | 'muzzle' | 'fleg' | 'fpaw' | 'hleg' | 'hpaw' | 'tail';

export interface PetSpec {
  name: string;
  seed: number;
  kind: 'cat' | 'dog';
  len: number;
  rHip: number;
  rBelly: number;
  rChest: number;
  legLen: number;
  legR: number;
  head: number;
  muzzle: number;
  tailLen: number;
  tailR: number;
  /** base fur length (m) */
  fur: number;
  furShells: number;
  earKind: 'pointy' | 'semi';
  /** iris colour */
  eye: number;
  /** coat colour at a rest-space surface point */
  coat: (p: THREE.Vector3, n: THREE.Vector3, tag: Tag, along: number) => THREE.Color;
  /** fur length multiplier per region */
  furLen?: (p: THREE.Vector3, n: THREE.Vector3, tag: Tag) => number;
  earColor: number;
  earInner: number;
  tailCarry?: number;
  whiskers?: boolean;
}

// ---------- noise helpers (shared with specs) ----------
export function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = (t: number) => t * t * (3 - 2 * t);
  let v = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const w = (dx ? u(xf) : 1 - u(xf)) * (dy ? u(yf) : 1 - u(yf)) * (dz ? u(zf) : 1 - u(zf));
    v += w * hash3(xi + dx, yi + dy, zi + dz);
  }
  return v;
}

// ---------- fur ----------
let strandTex: THREE.DataTexture | null = null;
function strands(): THREE.DataTexture {
  if (strandTex) return strandTex;
  const N = 256;
  const d = new Uint8Array(N * N * 4);
  const r = rng(99);
  for (let i = 0; i < N * N; i++) {
    const v = Math.floor(Math.pow(r(), 0.7) * 255);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  strandTex = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.magFilter = THREE.NearestFilter;
  strandTex.minFilter = THREE.NearestFilter;
  strandTex.needsUpdate = true;
  return strandTex;
}

function furMaterial(shell: number, shells: number, furLen: number, density: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const frac = shell / shells;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOff = { value: frac * furLen };
    sh.uniforms.uFrac = { value: frac };
    sh.uniforms.uStrands = { value: strands() };
    sh.uniforms.uDensity = { value: density };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uOff; uniform float uFrac;
        attribute float furLen; attribute vec3 rest;
        varying vec3 vRest; varying vec3 vRestN; varying float vFurLen;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vRest = rest; vRestN = normal; vFurLen = furLen;
        // shells along the skinned normal, combed back and down toward the tips
        vec3 comb = normalize(vec3(0.0, -0.55, -1.0));
        transformed += normalize(objectNormal) * uOff * furLen + comb * uOff * furLen * uFrac * 0.6;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFrac; uniform sampler2D uStrands; uniform float uDensity;
        varying vec3 vRest; varying vec3 vRestN; varying float vFurLen;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // triplanar strand mask in rest space (no UVs needed)
        vec3 bw = pow(abs(vRestN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 q = vRest * uDensity;
        float s = texture2D(uStrands, q.yz).r * bw.x + texture2D(uStrands, q.xz).r * bw.y + texture2D(uStrands, q.xy).r * bw.z;
        float thr = uFrac * 1.02 + 0.06;
        if (uFrac > 0.0 && (s < thr || vFurLen < 0.05)) discard;
        diffuseColor.rgb *= mix(0.74, 1.08, uFrac) * (0.92 + 0.16 * s);`);
  };
  m.customProgramCacheKey = () => `fur2-${shell > 0 ? 's' : 'b'}`;
  return m;
}

function irisTexture(color: number, slit: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, `#${col.clone().multiplyScalar(0.55).getHexString()}`);
  grad.addColorStop(0.55, `#${col.getHexString()}`);
  grad.addColorStop(0.9, `#${col.clone().lerp(new THREE.Color(1, 1, 1), 0.25).getHexString()}`);
  grad.addColorStop(1, '#111');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    g.strokeStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.15})`;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke();
  }
  g.fillStyle = '#050505';
  if (slit) { g.beginPath(); g.ellipse(64, 64, 9, 40, 0, 0, 7); g.fill(); }
  else { g.beginPath(); g.arc(64, 64, 30, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class PetRig {
  readonly root = new THREE.Group();
  readonly bones: Record<string, THREE.Bone> = {};
  private skeleton!: THREE.Skeleton;
  readonly spec: PetSpec;
  private phase = 0;
  speed = 0;
  pose: Pose = 'stand';
  private poseW: Record<Pose, number> = { stand: 1, sit: 0, loaf: 0, sleep: 0, belly: 0, stretch: 0 };
  lookTarget: THREE.Vector3 | null = null;
  private gazeYaw = 0;
  private gazePitch = 0;
  private tailVel: number[] = [];
  private tailAng: number[] = [];
  private earT = 0;
  private time = 0;
  /** extra wag excitement 0..1 */
  wag = 0;
  private eyeMeshes: THREE.Object3D[] = [];
  blink = 0;
  /** 0..1: eyes narrowed in contentment (petting) */
  content = 0;

  constructor(spec: PetSpec) {
    this.spec = spec;
    this.build();
  }

  private bone(name: string, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Bone {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    this.bones[name] = b;
    return b;
  }

  private build(): void {
    const s = this.spec;
    const L = s.len;
    const leg = s.legLen;
    // ---- skeleton (pet faces +Z, rest = standing, legs straight down) ----
    const rootB = this.bone('root', this.root, 0, 0, 0);
    const hipH = leg + s.rHip * 0.55;
    const hips = this.bone('hips', rootB, 0, hipH, -L / 2);
    const spine = this.bone('spine', hips, 0, 0.012, L * 0.5);
    const chest = this.bone('chest', spine, 0, 0.008, L * 0.5);
    const neck = this.bone('neck', chest, 0, s.rChest * 0.6, s.rChest * 0.5);
    const head = this.bone('head', neck, 0, s.head * 1.0, s.head * 0.45);
    this.bone('earL', head, -s.head * 0.5, s.head * 0.62, -s.head * 0.12);
    this.bone('earR', head, s.head * 0.5, s.head * 0.62, -s.head * 0.12);
    let tp: THREE.Bone = hips;
    const tseg = s.tailLen / 6;
    for (let i = 0; i < 6; i++) {
      tp = this.bone(`tail${i}`, tp, 0, i === 0 ? s.rHip * 0.45 : 0, -(i === 0 ? s.rHip * 0.85 : tseg));
      this.tailAng.push(0);
      this.tailVel.push(0);
    }
    for (const side of [-1, 1]) {
      const sn = side < 0 ? 'L' : 'R';
      const sh = this.bone(`shoulder${sn}`, chest, side * s.rChest * 0.5, -s.rChest * 0.3, s.rChest * 0.15);
      const up = this.bone(`fupper${sn}`, sh, 0, 0, 0);
      const lo = this.bone(`flower${sn}`, up, 0, -leg * 0.5, 0.0);
      this.bone(`fpaw${sn}`, lo, 0, -(leg * 0.5 - s.rChest * 0.3 - 0.012), 0.0);
      const hp = this.bone(`hip${sn}`, hips, side * s.rHip * 0.55, -s.rHip * 0.25, 0.01);
      const th = this.bone(`thigh${sn}`, hp, 0, 0, 0);
      const shn = this.bone(`shin${sn}`, th, 0, -leg * 0.5, 0.0);
      this.bone(`bpaw${sn}`, shn, 0, -(leg * 0.5 - s.rHip * 0.3 - 0.012), 0.0);
    }
    this.root.updateMatrixWorld(true);
    const boneList = Object.values(this.bones);
    const wp = (n: string) => this.bones[n].getWorldPosition(new THREE.Vector3());

    // ---- anatomy primitives ----
    const P: Prim[] = [];
    const hipP = wp('hips'), spP = wp('spine'), chP = wp('chest'), nkP = wp('neck'), hdP = wp('head');
    const hw = s.head;
    // torso: one long round cone hips→chest plus a belly sag, heavily blended
    P.push({ kind: 'ell', bone: 'hips', tag: 'hips', c: hipP.clone().add(V3(0, -0.004, 0.02)), r: V3(s.rHip * 0.9, s.rHip * 0.98, s.rHip * 1.35), blend: 0.07 });
    P.push({ kind: 'cone', bone: 'spine', tag: 'belly', a: hipP.clone().add(V3(0, -0.004, 0.03)), b: chP.clone().add(V3(0, -0.01, -0.02)), ra: s.rHip * 0.86, rb: s.rChest * 0.84, blend: 0.07 });
    P.push({ kind: 'ell', bone: 'spine', tag: 'belly', c: spP.clone().add(V3(0, -s.rBelly * 0.22, 0)), r: V3(s.rBelly * 0.86, s.rBelly * 0.82, L * 0.3), blend: 0.07 });
    P.push({ kind: 'ell', bone: 'chest', tag: 'chest', c: chP.clone().add(V3(0, -s.rChest * 0.08, 0.005)), r: V3(s.rChest * 0.78, s.rChest * 1.08, s.rChest * 1.0), blend: 0.06 });
    P.push({ kind: 'cone', bone: 'neck', tag: 'neck', a: chP.clone().add(V3(0, s.rChest * 0.35, s.rChest * 0.35)), b: hdP.clone().add(V3(0, -hw * 0.35, -hw * 0.3)), ra: s.rChest * 0.58, rb: hw * 0.62 });
    P.push({ kind: 'ell', bone: 'head', tag: 'head', c: hdP.clone(), r: V3(hw * 0.98, hw * 0.86, hw * 0.9) });
    if (s.kind === 'cat') {
      // broad cheeks low on the face, small rounded muzzle pads under the nose
      P.push({ kind: 'ell', bone: 'head', tag: 'cheek', c: hdP.clone().add(V3(0, -hw * 0.36, hw * 0.28)), r: V3(hw * 0.9, hw * 0.44, hw * 0.56), blend: 0.025 });
      for (const sx of [-1, 1]) P.push({ kind: 'ell', bone: 'head', tag: 'muzzle', c: hdP.clone().add(V3(sx * hw * 0.17, -hw * 0.4, hw * 0.78)), r: V3(hw * 0.22, hw * 0.19, hw * 0.2), blend: 0.015 });
      P.push({ kind: 'ell', bone: 'head', tag: 'muzzle', c: hdP.clone().add(V3(0, -hw * 0.56, hw * 0.66)), r: V3(hw * 0.2, hw * 0.13, hw * 0.18), blend: 0.015 });
    } else {
      // dog: defined stop, then a muzzle that projects forward
      P.push({ kind: 'ell', bone: 'head', tag: 'cheek', c: hdP.clone().add(V3(0, -hw * 0.3, hw * 0.25)), r: V3(hw * 0.75, hw * 0.48, hw * 0.55), blend: 0.025 });
      P.push({ kind: 'cone', bone: 'head', tag: 'muzzle', a: hdP.clone().add(V3(0, -hw * 0.3, hw * 0.55)), b: hdP.clone().add(V3(0, -hw * 0.36, hw * (0.6 + s.muzzle * 0.55))), ra: hw * 0.4, rb: hw * 0.3, blend: 0.014 });
    }
    for (const sn of ['L', 'R']) {
      const sh = wp(`fupper${sn}`), el = wp(`flower${sn}`), fp = wp(`fpaw${sn}`);
      P.push({ kind: 'cone', bone: `fupper${sn}`, tag: 'fleg', a: sh.clone().add(V3(0, s.legR * 1.2, -0.005)), b: el, ra: s.legR * 1.6, rb: s.legR * 0.98, blend: 0.025 });
      P.push({ kind: 'cone', bone: `flower${sn}`, tag: 'fleg', a: el, b: fp.clone().add(V3(0, s.legR * 0.5, 0)), ra: s.legR * 0.98, rb: s.legR * 0.78, blend: 0.012 });
      P.push({ kind: 'ell', bone: `fpaw${sn}`, tag: 'fpaw', c: fp.clone().add(V3(0, s.legR * 0.15, s.legR * 0.55)), r: V3(s.legR * 1.12, s.legR * 0.72, s.legR * 1.45), blend: 0.012 });
      const hp = wp(`thigh${sn}`), kn = wp(`shin${sn}`), bp = wp(`bpaw${sn}`);
      P.push({ kind: 'cone', bone: `thigh${sn}`, tag: 'hleg', a: hp.clone().add(V3(0, s.rHip * 0.25, -0.01)), b: kn, ra: s.rHip * 0.58, rb: s.legR * 1.1, blend: 0.03 });
      P.push({ kind: 'cone', bone: `shin${sn}`, tag: 'hleg', a: kn, b: bp.clone().add(V3(0, s.legR * 0.5, 0)), ra: s.legR * 1.05, rb: s.legR * 0.8, blend: 0.012 });
      P.push({ kind: 'ell', bone: `bpaw${sn}`, tag: 'hpaw', c: bp.clone().add(V3(0, s.legR * 0.15, s.legR * 0.5)), r: V3(s.legR * 1.1, s.legR * 0.72, s.legR * 1.5), blend: 0.012 });
    }
    for (let i = 0; i < 6; i++) {
      const a = wp(`tail${i}`);
      const b = i < 5 ? wp(`tail${i + 1}`) : a.clone().add(V3(0, 0, -tseg * 0.9));
      P.push({ kind: 'cone', bone: `tail${i}`, tag: 'tail', a, b, ra: s.tailR * (1 - (i / 6) * 0.45), rb: s.tailR * (1 - ((i + 1) / 6) * 0.45), blend: 0.015 });
    }
    const { geometry, nearest } = sculpt(P, (n) => boneList.indexOf(this.bones[n]), s.kind === 'dog' ? 0.0055 : 0.006, 0.03);

    // ---- per-vertex coat, fur length, rest attrs ----
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const nor = geometry.attributes.normal as THREE.BufferAttribute;
    const cnt = pos.count;
    const col = new Float32Array(cnt * 3);
    const fl = new Float32Array(cnt);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const tailBase = wp('tail0');
    for (let i = 0; i < cnt; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      const tag = (nearest[i].tag ?? 'belly') as Tag;
      const along = tag === 'tail' ? clamp((tailBase.z - p.z) / s.tailLen, 0, 1) : 0;
      const c = s.coat(p, n, tag, along);
      col.set([c.r, c.g, c.b], i * 3);
      fl[i] = s.furLen ? s.furLen(p, n, tag) : 1;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geometry.setAttribute('furLen', new THREE.BufferAttribute(fl, 1));
    geometry.setAttribute('rest', new THREE.BufferAttribute((pos.array as Float32Array).slice(), 3));
    geometry.computeBoundingSphere();

    this.skeleton = new THREE.Skeleton(boneList);
    const shells = s.furShells;
    for (let i = 0; i <= shells; i++) {
      const m = new THREE.SkinnedMesh(geometry, furMaterial(i, shells, s.fur, s.kind === 'dog' ? 110 : 190));
      m.bind(this.skeleton);
      m.castShadow = i === 0;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.root.add(m);
    }

    // ---- eyes: dark eyeball + textured iris disc + glossy cornea ----
    const headB = this.bones.head;
    const iris = irisTexture(s.eye, s.kind === 'cat');
    const ball = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.3 });
    const cornea = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 });
    const er = hw * (s.kind === 'cat' ? 0.21 : 0.23);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(er * 0.9, 16, 12), ball));
      // iris as a shallow dome on the front of the eyeball (visible, catches light)
      const dome = new THREE.SphereGeometry(er, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3.2);
      dome.rotateX(Math.PI / 2);
      const duv = dome.attributes.uv as THREE.BufferAttribute;
      const dpos = dome.attributes.position as THREE.BufferAttribute;
      const rim = er * Math.sin(Math.PI / 3.2);
      for (let k = 0; k < duv.count; k++) duv.setXY(k, 0.5 + (dpos.getX(k) / rim) * 0.5, 0.5 + (dpos.getY(k) / rim) * 0.5);
      const disc = new THREE.Mesh(dome, new THREE.MeshStandardMaterial({ map: iris, roughness: 0.15, emissive: 0xffffff, emissiveMap: iris, emissiveIntensity: 0.05 }));
      eye.add(disc);
      const cor = new THREE.Mesh(new THREE.SphereGeometry(er * 1.02, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), cornea);
      cor.rotation.x = Math.PI / 2;
      eye.add(cor);
      // eyes sit forward, angled slightly outward
      // dark rim (eyeliner) — most of a face's read comes from this
      const rimG = new THREE.TorusGeometry(er * 0.98, er * 0.11, 6, 24);
      const rimM = new THREE.Mesh(rimG, new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.6 }));
      rimM.position.z = er * 0.38;
      eye.add(rimM);
      eye.position.set(side * hw * 0.38, hw * 0.06, hw * (s.kind === 'cat' ? 0.76 : 0.72));
      eye.rotation.y = side * (s.kind === 'cat' ? 0.22 : 0.3);
      headB.add(eye);
      this.eyeMeshes.push(eye);
    }
    // ---- nose ----
    if (s.kind === 'dog') {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(hw * 0.17, 14, 10), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.22 }));
      nose.scale.set(1.25, 0.85, 0.8);
      nose.position.set(0, -hw * 0.3, hw * (0.6 + s.muzzle * 0.55) + hw * 0.27);
      headB.add(nose);
    } else {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.11, hw * 0.12, 3), new THREE.MeshStandardMaterial({ color: 0xc98a86, roughness: 0.45 }));
      nose.rotation.x = Math.PI / 2 + 0.2;
      nose.rotation.z = Math.PI;
      nose.position.set(0, -hw * 0.26, hw * 0.93);
      headB.add(nose);
    }
    // ---- ears ----
    const earMat = new THREE.MeshStandardMaterial({ color: s.earColor, roughness: 0.85, side: THREE.DoubleSide });
    const innerMat = new THREE.MeshStandardMaterial({ color: s.earInner, roughness: 0.8, side: THREE.DoubleSide });
    for (const sn of ['L', 'R']) {
      const side = sn === 'L' ? -1 : 1;
      const eb = this.bones[`ear${sn}`];
      const group = new THREE.Group();
      if (s.earKind === 'pointy') {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.5, hw * 0.95, 4, 1), earMat);
        ear.scale.set(1, 1, 0.42);
        ear.position.y = hw * 0.32;
        ear.rotation.y = Math.PI / 4;
        group.add(ear);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.34, hw * 0.7, 3), innerMat);
        inner.scale.set(1, 1, 0.3);
        inner.position.set(0, hw * 0.27, hw * 0.1);
        group.add(inner);
        group.position.y = -hw * 0.12;
        group.rotation.z = -side * 0.28;
        group.rotation.x = -0.1;
      } else {
        // semi-erect, tips folding forward (Chorkie)
        const w = hw * 0.72, h = hw * 1.2, fold = 0.52;
        const shape = (inset: number) => {
          const g = new THREE.BufferGeometry();
          const pts = [V3(-w / 2 + inset, inset, 0), V3(w / 2 - inset, inset, 0), V3(-w * 0.18, h * fold, 0), V3(w * 0.2, h * fold, 0), V3(0.0, h - inset, 0)];
          // fold the tip forward around y = h*fold
          const tip = pts[4];
          const ang = 1.15;
          const dy = tip.y - h * fold;
          pts[4] = V3(tip.x, h * fold + Math.cos(ang) * dy, Math.sin(ang) * dy);
          const arr: number[] = [];
          for (const [a, b, c] of [[0, 1, 3], [0, 3, 2], [2, 3, 4]]) arr.push(...pts[a].toArray(), ...pts[b].toArray(), ...pts[c].toArray());
          g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
          g.computeVertexNormals();
          return g;
        };
        const outer = new THREE.Mesh(shape(0), earMat);
        const inner = new THREE.Mesh(shape(hw * 0.08), innerMat);
        inner.position.z = 0.003;
        group.add(outer, inner);
        group.position.set(side * hw * 0.08, hw * 0.05, 0);
        group.rotation.set(-0.25, side * 0.45, -side * 0.55);
        // scruffy fringe on the ear edge
        const fr = new THREE.Mesh(new THREE.SphereGeometry(hw * 0.12, 8, 6), earMat);
        fr.scale.set(1.4, 0.7, 0.6);
        fr.position.set(side * -w * 0.25, h * 0.15, 0);
        group.add(fr);
      }
      group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      eb.add(group);
    }
    // ---- whiskers ----
    if (s.whiskers) {
      const wpts: number[] = [];
      const base = V3(0, -hw * 0.4, hw * 0.92);
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
        const o = base.clone().add(V3(side * hw * 0.22, -k * hw * 0.04, 0));
        wpts.push(...o.toArray(), ...o.clone().add(V3(side * hw * 1.4, (1.5 - k) * hw * 0.12, -hw * 0.25)).toArray());
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wpts, 3));
      headB.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.7 })));
    }
    for (const b of boneList) b.userData.rest = b.quaternion.clone();
  }

  setPose(p: Pose): void {
    this.pose = p;
  }

  /** Procedural animation; speed in m/s */
  update(dt: number): void {
    this.time += dt;
    const s = this.spec;
    for (const k of Object.keys(this.poseW) as Pose[]) this.poseW[k] = damp(this.poseW[k], k === this.pose ? 1 : 0, 5, dt);
    const w = this.poseW;
    const B = this.bones;
    const moving = clamp(this.speed / 0.5, 0, 1) * w.stand;
    const run = clamp((this.speed - 1.0) / 1.5, 0, 1);
    const stride = s.legLen * 1.7;
    this.phase = (this.phase + (this.speed / Math.max(0.05, stride)) * dt) % 1;
    const breathe = Math.sin(this.time * (w.sleep > 0.5 ? 1.5 : 3.0)) * 0.025;
    const lieW = Math.max(w.loaf, w.sleep);

    // ---- body chain (pitch up = negative X rotation, since +Z is forward) ----
    const E = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
    const sitPitch = -Math.min(0.78, Math.asin(clamp((s.legLen + s.rChest * 0.5 - s.rHip * 0.5) / s.len, 0, 0.95)) * 1.35);
    const hipsQ = E(sitPitch * w.sit + w.stretch * 0.22, w.sleep * 0.5, w.belly * Math.PI * 0.92);
    const spineQ = E(-w.sit * 0.12 + breathe + Math.sin(this.phase * Math.PI * 4) * 0.025 * moving, w.sleep * 0.65, 0);
    const chestQ = E(-w.sit * 0.1 - w.stretch * 0.4, w.sleep * 0.65, 0);
    B.hips.quaternion.copy(hipsQ);
    B.spine.quaternion.copy(spineQ);
    B.chest.quaternion.copy(chestQ);
    const Qh = hipsQ.clone();
    const Qc = hipsQ.clone().multiply(spineQ).multiply(chestQ);

    // ---- legs from desired directions (pet frame) ----
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
    const blend = (pairs: Array<[number, THREE.Vector3]>) => {
      const out = new THREE.Vector3();
      for (const [wt, v] of pairs) out.addScaledVector(v, wt);
      return out.lengthSq() < 1e-6 ? new THREE.Vector3(0, -1, 0) : out.normalize();
    };
    const DOWN = new THREE.Vector3(0, -1, 0);
    const aim = (bone: string, parentQ: THREE.Quaternion, dir: THREE.Vector3) => {
      const local = dir.clone().applyQuaternion(parentQ.clone().invert()).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(DOWN, local);
      B[bone].quaternion.copy(q);
      return parentQ.clone().multiply(q);
    };
    const offs: Record<string, number> = { L: 0.0, R: 0.5 };
    for (const sn of ['L', 'R']) {
      const fph = (this.phase + offs[sn] + 0.25 + run * 0.25) % 1;
      const hph = (this.phase + offs[sn]) % 1;
      const fsw = Math.sin(fph * Math.PI * 2) * (0.5 + run * 0.3) * moving;
      const hsw = Math.sin(hph * Math.PI * 2) * (0.5 + run * 0.3) * moving;
      const flift = Math.max(0, Math.sin(fph * Math.PI * 2 + 1.3)) * moving;
      const hlift = Math.max(0, Math.sin(hph * Math.PI * 2 + 1.3)) * moving;
      const swing = (v: THREE.Vector3, a: number) => v.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -a);
      // front: upper, lower
      const fUp = blend([
        [w.stand, swing(V(0, -1, 0.06), fsw)], [w.sit, V(0, -1, 0.08)], [lieW, V(0, -0.25, -1)], [w.belly, V(0, -0.6, -0.4)], [w.stretch, V(0, -0.35, 1)],
      ]);
      const fLo = blend([
        [w.stand, swing(V(0, -1, -0.04 - flift * 0.9), fsw)], [w.sit, V(0, -1, 0.02)], [lieW, V(0, -0.05, 1)], [w.belly, V(0, -0.5, 0.6)], [w.stretch, V(0, -0.2, 1)],
      ]);
      const qf = aim(`fupper${sn}`, Qc, fUp);
      aim(`flower${sn}`, qf, fLo);
      // hind: thigh, shin
      const hTh = blend([
        [w.stand, swing(V(0, -0.82, 0.55), hsw)], [w.sit, V(0, -0.45, 0.9)], [lieW, V(0, -0.3, 0.95)], [w.belly, V(0, -0.5, 0.7)], [w.stretch, V(0, -0.9, -0.35)],
      ]);
      const hSh = blend([
        [w.stand, swing(V(0, -0.85, -0.5 - hlift * 0.6), hsw)], [w.sit, V(0, -0.12, -1)], [lieW, V(0, -0.05, -1)], [w.belly, V(0, -0.6, -0.4)], [w.stretch, V(0, -0.9, -0.3)],
      ]);
      const qt = aim(`thigh${sn}`, Qh, hTh);
      aim(`shin${sn}`, qt, hSh);
      B[`hip${sn}`].quaternion.identity();
      B[`shoulder${sn}`].quaternion.identity();
    }

    // ---- neck / head look-at ----
    let yaw = 0;
    let pitch = 0;
    if (this.lookTarget && w.sleep < 0.5) {
      this.root.updateMatrixWorld(true);
      const hp = B.head.getWorldPosition(new THREE.Vector3());
      const to = this.lookTarget.clone().sub(hp).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()).invert());
      // targets behind the head would flip ±π: look over the nearer shoulder instead
      yaw = to.z < 0 ? Math.sign(to.x || 1) * 1.0 : clamp(Math.atan2(to.x, to.z), -1.0, 1.0);
      pitch = clamp(-Math.atan2(to.y, Math.hypot(to.x, Math.max(0.05, to.z))), -0.6, 0.5);
    }
    // ease the gaze so the head never snaps
    const ease = 1 - Math.exp(-dt * 7);
    this.gazeYaw += (yaw - this.gazeYaw) * ease;
    this.gazePitch += (pitch - this.gazePitch) * ease;
    yaw = this.gazeYaw;
    pitch = this.gazePitch;
    // sitting tilts the body up; the neck and head level the gaze back out
    const sitLevel = -sitPitch;
    B.neck.quaternion.copy(E(w.sit * (0.1 + sitLevel * 0.7) + lieW * 0.25 + w.sleep * 0.5 - w.stretch * 0.3, w.sleep * 0.9 + yaw * 0.35, 0));
    B.head.quaternion.copy(E(pitch * 0.7 + w.sit * sitLevel * 0.35 + w.sleep * 0.4, yaw * 0.65, (w.belly ? Math.sin(this.time * 2) * 0.1 : 0)));

    // ---- tail: spring chain ----
    const swayT = this.time * (1.1 + this.wag * 7);
    const amp = 0.16 + this.wag * 0.55 + moving * 0.1;
    for (let i = 0; i < 6; i++) {
      const curl = w.sleep * 0.45;
      const target = Math.sin(swayT - i * 0.6) * amp * (0.35 + i * 0.12) + curl;
      this.tailVel[i] += (target - this.tailAng[i]) * 40 * dt;
      this.tailVel[i] *= Math.exp(-6 * dt);
      this.tailAng[i] += this.tailVel[i] * dt;
      const base = s.tailCarry ?? (s.kind === 'cat' ? 0.95 : 1.15);
      const lift = i === 0 ? (base * (w.stand + w.sit * 0.2) - (lieW + w.belly) * 0.5 - (s.kind === 'cat' ? 0.35 * moving : 0)) : (s.kind === 'cat' ? -0.12 : -0.05) + w.sit * 0.15;
      B[`tail${i}`].quaternion.copy(E(lift, this.tailAng[i], 0));
    }
    // ---- ears + blink ----
    this.earT -= dt;
    if (this.earT < 0) this.earT = 2 + Math.random() * 5;
    const twitch = this.earT < 0.12 ? 0.35 : 0;
    B.earL.quaternion.copy(E(twitch, 0, s.earKind === 'semi' ? Math.sin(this.time * 3) * 0.08 * moving : 0));
    B.earR.quaternion.copy(E(0, 0, s.earKind === 'semi' ? -Math.sin(this.time * 3 + 1) * 0.08 * moving : -twitch * 0.5));
    this.blink -= dt;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3;
    const closed = w.sleep > 0.5 || this.blink < 0.1;
    const open = closed ? 0.1 : 1 - this.content * 0.75;
    for (const e of this.eyeMeshes) e.scale.y = open;

    // ---- ground contact: lowest paw / belly touches y=0 ----
    B.root.position.y = 0;
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    let low = Infinity;
    const probe = (o: THREE.Object3D, r: number) => {
      const p = o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      low = Math.min(low, p.y - r);
    };
    for (const pw of ['fpawL', 'fpawR', 'bpawL', 'bpawR']) probe(B[pw], s.legR * 0.55);
    if (lieW + w.belly > 0.3) { probe(B.hips, s.rHip * 0.95); probe(B.spine, s.rBelly * 0.95); probe(B.chest, s.rChest * 0.95); }
    if (w.sit > 0.3) probe(B.hips, s.rHip * 0.9);
    B.root.position.y = -low + Math.abs(Math.sin(this.phase * Math.PI * 4)) * 0.008 * moving;
  }
}
