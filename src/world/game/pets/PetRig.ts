// Procedural pet rig: generated skeleton + skinned body + shell fur.
//
// Geometry: a body lofted along the spine with per-ring radius profile,
// neck, head (with muzzle), tapered legs and a tail chain — all one
// BufferGeometry skinned with smooth 2-bone weights. Eyes, nose, ears and
// paws are rigid children of their bones.
//
// Fur: N shell layers share geometry + skeleton; each pushes the skinned
// surface out along the normal, alpha-tests a strand noise, darkens roots
// and droops slightly. Coat colour comes from a UV-mapped pattern canvas
// (tabby stripes, saddle, socks…) drawn per pet.
//
// Animation is procedural: gait cycle, spring tail, breathing, ear
// twitches, head look-at and blended poses (stand, sit, loaf, sleep, belly).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp, rng } from '../../engine/math';

export interface PetSpec {
  name: string;
  seed: number;
  kind: 'cat' | 'dog';
  /** body length (hips→chest), m */
  len: number;
  /** body radius at hips / belly / chest */
  rHip: number;
  rBelly: number;
  rChest: number;
  legLen: number;
  legR: number;
  head: number;
  muzzle: number;
  tailLen: number;
  tailR: number;
  fur: number;
  furShells: number;
  earKind: 'pointy' | 'floppy';
  eye: number;
  coat: (g: CanvasRenderingContext2D, size: number) => void;
}

export type Pose = 'stand' | 'sit' | 'loaf' | 'sleep' | 'belly' | 'stretch';

const SHELLS_MAX = 18;

// ---------- fur shell material ----------

let strandTex: THREE.DataTexture | null = null;
function strands(): THREE.DataTexture {
  if (strandTex) return strandTex;
  const N = 256;
  const d = new Uint8Array(N * N * 4);
  const r = rng(99);
  for (let i = 0; i < N * N; i++) {
    const v = Math.floor(Math.pow(r(), 0.8) * 255);
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

function furMaterial(coat: THREE.Texture, shell: number, shells: number, furLen: number, density: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: coat, roughness: 0.92, metalness: 0 });
  const frac = shell / shells;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOff = { value: frac * furLen };
    sh.uniforms.uFrac = { value: frac };
    sh.uniforms.uStrands = { value: strands() };
    sh.uniforms.uDensity = { value: density };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOff;\nuniform float uFrac;\nattribute float furLen;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        transformed += normalize(objectNormal) * uOff * furLen;
        transformed.y -= uOff * furLen * uFrac * 0.35;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFrac;\nuniform sampler2D uStrands;\nuniform float uDensity;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float s = texture2D(uStrands, vMapUv * uDensity).r;
        if (uFrac > 0.0 && s < uFrac * 1.05 + 0.08) discard;
        diffuseColor.rgb *= mix(0.55, 1.08, uFrac);`);
  };
  m.customProgramCacheKey = () => `fur-${shell > 0 ? 'shell' : 'base'}`;
  return m;
}

// ---------- geometry helpers ----------

interface SkinBuild {
  geos: THREE.BufferGeometry[];
}

/** Attach skin attributes: each vertex → (b0,w0),(b1,w1) */
function skin(g: THREE.BufferGeometry, weights: (p: THREE.Vector3, i: number) => [number, number, number, number], fur = 1): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const fl = new Float32Array(ng.attributes.position.count).fill(fur);
  ng.setAttribute('furLen', new THREE.BufferAttribute(fl, 1));
  const pos = ng.attributes.position as THREE.BufferAttribute;
  const si = new Uint16Array(pos.count * 4);
  const sw = new Float32Array(pos.count * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const [a, wa, b, wb] = weights(v, i);
    si[i * 4] = a; si[i * 4 + 1] = b;
    sw[i * 4] = wa; sw[i * 4 + 1] = wb;
  }
  ng.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  ng.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return ng;
}

/** Loft rings along a polyline of centres; uv region u∈[u0,u1] along, v around */
function loft(centres: THREE.Vector3[], radii: Array<[number, number]>, seg: number, u0: number, u1: number, capEnd = true): THREE.BufferGeometry {
  const rings = centres.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < rings; i++) {
    const c = centres[i];
    const dir = (i < rings - 1 ? centres[i + 1].clone().sub(c) : c.clone().sub(centres[i - 1])).normalize();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const [rx, ry] = radii[i];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const p = c.clone().addScaledVector(side, Math.cos(a) * rx).addScaledVector(up, -Math.sin(a) * ry);
      pos.push(p.x, p.y, p.z);
      uv.push(u0 + (u1 - u0) * (i / (rings - 1)), s / seg);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let s = 0; s < seg; s++) {
      const a = i * (seg + 1) + s;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  void capEnd;
  return g;
}

// ---------- the rig ----------

export class PetRig {
  readonly root = new THREE.Group();
  readonly bones: Record<string, THREE.Bone> = {};
  private skeleton!: THREE.Skeleton;
  private meshes: THREE.SkinnedMesh[] = [];
  readonly spec: PetSpec;
  // animation state
  private phase = 0;
  speed = 0;
  pose: Pose = 'stand';
  private poseW: Record<Pose, number> = { stand: 1, sit: 0, loaf: 0, sleep: 0, belly: 0, stretch: 0 };
  lookTarget: THREE.Vector3 | null = null;
  private tailVel: number[] = [];
  private tailAng: number[] = [];
  private earT = 0;
  private time = 0;
  /** extra wag excitement 0..1 */
  wag = 0;
  private eyeMeshes: THREE.Mesh[] = [];
  blink = 0;

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
    // ---- skeleton (pet faces +Z) ----
    const rootB = this.bone('root', this.root, 0, 0, 0);
    const hips = this.bone('hips', rootB, 0, leg + s.rHip * 0.6, -L / 2);
    const spine = this.bone('spine', hips, 0, 0.01, L * 0.5);
    const chest = this.bone('chest', spine, 0, 0.01, L * 0.5);
    const neck = this.bone('neck', chest, 0, s.rChest * 0.55, s.rChest * 0.55);
    const head = this.bone('head', neck, 0, s.head * 0.9, s.head * 0.35);
    this.bone('earL', head, -s.head * 0.55, s.head * 0.7, -s.head * 0.05);
    this.bone('earR', head, s.head * 0.55, s.head * 0.7, -s.head * 0.05);
    let tp: THREE.Bone = hips;
    const tseg = s.tailLen / 6;
    for (let i = 0; i < 6; i++) {
      tp = this.bone(`tail${i}`, tp, 0, i === 0 ? s.rHip * 0.4 : 0, -(i === 0 ? s.rHip * 0.7 : tseg));
      this.tailAng.push(0);
      this.tailVel.push(0);
    }
    for (const side of [-1, 1]) {
      const sn = side < 0 ? 'L' : 'R';
      const sh = this.bone(`shoulder${sn}`, chest, side * s.rChest * 0.55, -s.rChest * 0.35, s.rChest * 0.1);
      const up = this.bone(`fupper${sn}`, sh, 0, 0, 0);
      const lo = this.bone(`flower${sn}`, up, 0, -leg * 0.5, 0.01);
      this.bone(`fpaw${sn}`, lo, 0, -leg * 0.5 + 0.02, 0.02);
      const hp = this.bone(`hip${sn}`, hips, side * s.rHip * 0.55, -s.rHip * 0.25, 0);
      const th = this.bone(`thigh${sn}`, hp, 0, 0, 0);
      const shn = this.bone(`shin${sn}`, th, 0, -leg * 0.52, 0.06);
      this.bone(`bpaw${sn}`, shn, 0, -leg * 0.48 + 0.02, -0.05);
    }
    this.root.updateMatrixWorld(true);
    const boneList = Object.values(this.bones);
    const idxOf = (n: string) => boneList.indexOf(this.bones[n]);
    const wp = (n: string) => this.bones[n].getWorldPosition(new THREE.Vector3());

    // ---- geometry ----
    const geos: THREE.BufferGeometry[] = [];
    // body: tail-root → hips → spine → chest → neck base
    const hipP = wp('hips');
    const chestP = wp('chest');
    const bodyCentres: THREE.Vector3[] = [];
    const bodyRadii: Array<[number, number]> = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const zz = THREE.MathUtils.lerp(hipP.z - s.rHip * 0.85, chestP.z + s.rChest * 0.75, t);
      const yy = THREE.MathUtils.lerp(hipP.y + 0.01, chestP.y + 0.02, t) + Math.sin(t * Math.PI) * 0.01;
      bodyCentres.push(new THREE.Vector3(0, yy, zz));
      const profile = t < 0.5 ? THREE.MathUtils.lerp(s.rHip, s.rBelly, t * 2) : THREE.MathUtils.lerp(s.rBelly, s.rChest, (t - 0.5) * 2);
      const endTaper = Math.sin(Math.min(1, Math.min(t, 1 - t) * 6) * Math.PI / 2) * 0.35 + 0.65;
      bodyRadii.push([profile * endTaper * 0.92, profile * endTaper * (s.kind === 'cat' ? 1.0 : 0.95)]);
    }
    const bodyIdx = [idxOf('hips'), idxOf('spine'), idxOf('chest')];
    const bodyZ = [hipP.z, wp('spine').z, chestP.z];
    geos.push(skin(loft(bodyCentres, bodyRadii, 18, 0, 0.6), (p) => {
      if (p.z <= bodyZ[1]) {
        const t = clamp((p.z - bodyZ[0]) / (bodyZ[1] - bodyZ[0]), 0, 1);
        return [bodyIdx[0], 1 - t, bodyIdx[1], t];
      }
      const t = clamp((p.z - bodyZ[1]) / (bodyZ[2] - bodyZ[1]), 0, 1);
      return [bodyIdx[1], 1 - t, bodyIdx[2], t];
    }));
    // neck
    const neckP = wp('neck');
    const headP = wp('head');
    geos.push(skin(loft([chestP.clone().add(new THREE.Vector3(0, s.rChest * 0.2, s.rChest * 0.3)), neckP, headP.clone().add(new THREE.Vector3(0, -s.head * 0.3, -s.head * 0.2))],
      [[s.rChest * 0.62, s.rChest * 0.66], [s.head * 0.62, s.head * 0.62], [s.head * 0.55, s.head * 0.55]], 14, 0.6, 0.66), (p) => {
      const t = clamp((p.y - chestP.y) / (headP.y - chestP.y), 0, 1);
      return t < 0.5 ? [idxOf('chest'), 1 - t * 2, idxOf('neck'), t * 2] : [idxOf('neck'), 2 - t * 2, idxOf('head'), t * 2 - 1];
    }, 0.8));
    // head: sphere + muzzle
    {
      const hg = new THREE.SphereGeometry(s.head, 20, 16);
      hg.scale(1.05, s.kind === 'cat' ? 0.92 : 0.95, 1.0);
      const uv = hg.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.9 + uv.getX(i) * 0.1, uv.getY(i));
      hg.translate(headP.x, headP.y, headP.z);
      const mz = new THREE.SphereGeometry(s.head * 0.55, 14, 10);
      mz.scale(1.0, 0.75, s.muzzle);
      const muv = mz.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < muv.count; i++) muv.setXY(i, 0.9 + muv.getX(i) * 0.1, 0.05 + muv.getY(i) * 0.3);
      mz.translate(headP.x, headP.y - s.head * 0.32, headP.z + s.head * 0.78);
      geos.push(skin(hg, () => [idxOf('head'), 1, 0, 0], s.kind === 'dog' ? 0.55 : 0.28), skin(mz, () => [idxOf('head'), 1, 0, 0], s.kind === 'dog' ? 0.6 : 0.15));
    }
    // legs
    for (const sn of ['L', 'R']) {
      for (const [a, b, c, u0] of [[`fupper${sn}`, `flower${sn}`, `fpaw${sn}`, 0.75], [`thigh${sn}`, `shin${sn}`, `bpaw${sn}`, 0.82]] as Array<[string, string, string, number]>) {
        const pa = wp(a);
        const pb = wp(b);
        const pc = wp(c);
        const thighBulk = a.startsWith('thigh') ? 1.7 : 1.25;
        const g = loft([pa.clone().add(new THREE.Vector3(0, s.legR * 1.4, 0)), pb, pc.clone().add(new THREE.Vector3(0, s.legR * 0.4, 0))],
          [[s.legR * thighBulk, s.legR * thighBulk * 1.2], [s.legR, s.legR], [s.legR * 0.85, s.legR * 0.85]], 10, u0, u0 + 0.07);
        geos.push(skin(g, (p) => {
          const t = clamp((pa.y - p.y) / (pa.y - pc.y), 0, 1);
          return t < 0.5 ? [idxOf(a), 1 - t, idxOf(b), t] : [idxOf(b), 1, idxOf(c), 0];
        }, s.kind === 'dog' ? 0.7 : 0.4));
      }
    }
    // tail
    {
      const cs: THREE.Vector3[] = [];
      const rs: Array<[number, number]> = [];
      for (let i = 0; i < 6; i++) {
        const p = wp(`tail${i}`);
        cs.push(p);
        const r = s.tailR * (1 - (i / 6) * 0.55);
        rs.push([r, r]);
      }
      const tip = wp('tail5').clone().add(new THREE.Vector3(0, 0, -tseg * 0.8));
      cs.push(tip);
      rs.push([s.tailR * 0.25, s.tailR * 0.25]);
      geos.push(skin(loft(cs, rs, 10, 0.6, 0.75), (p) => {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < 6; i++) {
          const d = p.distanceToSquared(wp(`tail${i}`));
          if (d < bd) { bd = d; best = i; }
        }
        const nb = Math.min(5, best + 1);
        return [idxOf(`tail${best}`), 0.75, idxOf(`tail${nb}`), 0.25];
      }, 1.25));
    }
    const merged = mergeGeometries(geos.map((g) => {
      const keep = g;
      for (const k of Object.keys(keep.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'furLen'].includes(k)) keep.deleteAttribute(k);
      return keep;
    }), false)!;
    // keep each part's smooth normals (recomputing on non-indexed data would facet them)
    merged.computeBoundingSphere();

    // ---- coat texture ----
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    s.coat(cv.getContext('2d')!, 512);
    const coat = new THREE.CanvasTexture(cv);
    coat.colorSpace = THREE.SRGBColorSpace;
    coat.anisotropy = 4;

    // ---- skinned shells ----
    this.skeleton = new THREE.Skeleton(boneList);
    const shells = Math.min(SHELLS_MAX, s.furShells);
    for (let i = 0; i <= shells; i++) {
      const m = new THREE.SkinnedMesh(merged, furMaterial(coat, i, shells, s.fur, s.kind === 'dog' ? 16 : 26));
      m.bind(this.skeleton);
      m.castShadow = i === 0;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.meshes.push(m);
      this.root.add(m);
    }

    // ---- rigid details: eyes, nose, ears, paws ----
    const headB = this.bones.head;
    const eyeMat = new THREE.MeshStandardMaterial({ color: s.eye, roughness: 0.15, metalness: 0.0, emissive: s.eye, emissiveIntensity: 0.15 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s.head * 0.17, 14, 10), eyeMat);
      eye.position.set(side * s.head * 0.4, s.head * 0.14, s.head * 0.86 + s.fur * 0.15);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(s.head * 0.1, 10, 8), pupil);
      pu.scale.set(s.kind === 'cat' ? 0.45 : 1, 1, 0.6);
      pu.position.z = s.head * 0.12;
      eye.add(pu);
      headB.add(eye);
      this.eyeMeshes.push(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(s.head * (s.kind === 'dog' ? 0.17 : 0.1), 12, 8), new THREE.MeshStandardMaterial({ color: s.kind === 'dog' ? 0x111111 : 0xc77a7a, roughness: 0.3 }));
    nose.position.set(0, -s.head * 0.18, s.head * (0.78 + s.muzzle * 0.52));
    headB.add(nose);
    const earMat = new THREE.MeshStandardMaterial({ map: coat, roughness: 0.9, side: THREE.DoubleSide });
    for (const sn of ['L', 'R']) {
      const eb = this.bones[`ear${sn}`];
      let ear: THREE.Mesh;
      if (s.earKind === 'pointy') {
        const g = new THREE.ConeGeometry(s.head * 0.38, s.head * 0.7, 4);
        g.scale(1, 1, 0.45);
        g.translate(0, s.head * 0.3, 0);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.92 + uv.getX(i) * 0.06, 0.6 + uv.getY(i) * 0.3);
        ear = new THREE.Mesh(g, earMat);
        ear.rotation.z = sn === 'L' ? 0.25 : -0.25;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(s.head * 0.22, s.head * 0.45, 3), new THREE.MeshStandardMaterial({ color: 0xe0a8a0, roughness: 0.8 }));
        inner.scale.set(1, 1, 0.3);
        inner.position.set(0, s.head * 0.25, s.head * 0.07);
        ear.add(inner);
      } else {
        const g = new THREE.SphereGeometry(s.head * 0.42, 12, 8);
        g.scale(0.55, 1.1, 0.22);
        g.translate(0, -s.head * 0.25, 0);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.92 + uv.getX(i) * 0.06, 0.62 + uv.getY(i) * 0.3);
        ear = new THREE.Mesh(g, earMat);
        ear.rotation.z = sn === 'L' ? 0.9 : -0.9;
        ear.rotation.x = -0.2;
      }
      ear.castShadow = true;
      eb.add(ear);
    }
    const pawMat = new THREE.MeshStandardMaterial({ map: coat, roughness: 0.9 });
    for (const p of ['fpawL', 'fpawR', 'bpawL', 'bpawR']) {
      const g = new THREE.SphereGeometry(s.legR * 1.02, 10, 8);
      g.scale(1, 0.5, 1.3);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.86 + uv.getX(i) * 0.03, 0.02 + uv.getY(i) * 0.1);
      const paw = new THREE.Mesh(g, pawMat);
      paw.position.set(0, -0.005, s.legR * 0.5);
      paw.castShadow = true;
      this.bones[p].add(paw);
    }
    // remember rest rotations
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
    const sitPitch = -Math.asin(clamp((s.legLen * 0.95 + s.rChest * 0.2 - s.rHip * 0.9) / s.len, 0, 0.9));
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
      yaw = clamp(Math.atan2(to.x, to.z), -1.0, 1.0);
      pitch = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.6, 0.5);
    }
    B.neck.quaternion.copy(E(w.sit * 0.35 + lieW * 0.25 + w.sleep * 0.5 - w.stretch * 0.3, w.sleep * 0.9 + yaw * 0.35, 0));
    B.head.quaternion.copy(E(pitch * 0.7 + w.sleep * 0.4, yaw * 0.65, (w.belly ? Math.sin(this.time * 2) * 0.1 : 0)));

    // ---- tail: spring chain ----
    const swayT = this.time * (1.1 + this.wag * 7);
    const amp = 0.16 + this.wag * 0.55 + moving * 0.1;
    for (let i = 0; i < 6; i++) {
      const curl = w.sleep * 0.45;
      const target = Math.sin(swayT - i * 0.6) * amp * (0.35 + i * 0.12) + curl;
      this.tailVel[i] += (target - this.tailAng[i]) * 40 * dt;
      this.tailVel[i] *= Math.exp(-6 * dt);
      this.tailAng[i] += this.tailVel[i] * dt;
      const base = s.kind === 'cat' ? 0.95 : 1.15;
      const lift = i === 0 ? (base * (w.stand + w.sit * 0.2) - (lieW + w.belly) * 0.5 - (s.kind === 'cat' ? 0.35 * moving : 0)) : (s.kind === 'cat' ? -0.12 : -0.05) + w.sit * 0.15;
      B[`tail${i}`].quaternion.copy(E(lift, this.tailAng[i], 0));
    }
    // ---- ears + blink ----
    this.earT -= dt;
    if (this.earT < 0) this.earT = 2 + Math.random() * 5;
    const twitch = this.earT < 0.12 ? 0.35 : 0;
    B.earL.quaternion.copy(E(twitch, 0, s.earKind === 'floppy' ? Math.sin(this.time * 3) * 0.08 * moving : 0));
    B.earR.quaternion.copy(E(0, 0, s.earKind === 'floppy' ? -Math.sin(this.time * 3 + 1) * 0.08 * moving : -twitch * 0.5));
    this.blink -= dt;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3;
    const closed = w.sleep > 0.5 || this.blink < 0.1;
    for (const e of this.eyeMeshes) e.scale.y = closed ? 0.12 : 1;

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
