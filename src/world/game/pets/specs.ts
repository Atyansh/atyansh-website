// BaoBao, HuHu and Chance — proportions and coats from their photos.
// Coats are evaluated per vertex in rest space (pet faces +Z, y up).

import * as THREE from 'three';
import { vnoise, type PetSpec, type Tag } from './PetRig';

const C = (hex: string) => new THREE.Color(hex);
const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Mackerel tabby: dark vertical stripes down the flanks from a dark spine
 * line, ringed legs and tail, dark tail tip, "M" forehead, pale chin/chest.
 */
function tabby(base: string, stripe: string, pale: string, tip: string, stripeFreq: number, strength: number) {
  const B = C(base), S = C(stripe), P = C(pale), T = C(tip);
  return (p: THREE.Vector3, n: THREE.Vector3, tag: Tag, along: number) => {
    const nz = vnoise(p.x * 40, p.y * 40, p.z * 40);
    const fine = vnoise(p.x * 160, p.y * 160, p.z * 160);
    let c = B.clone().multiplyScalar(0.92 + fine * 0.16);
    const dorsal = sstep(0.1, 0.8, n.y);
    const under = sstep(-0.2, -0.75, n.y);
    if (tag === 'hips' || tag === 'belly' || tag === 'chest' || tag === 'neck') {
      // stripes wrap round the body (function of z, wobbled by noise)
      const band = Math.sin(p.z * stripeFreq + nz * 3.2 + Math.abs(p.x) * 6);
      const st = sstep(0.55, 0.85, band) * (1 - under) * strength;
      c = mix(c, S, st);
      c = mix(c, S, sstep(0.82, 0.97, n.y) * 0.85); // spine line
      c = mix(c, P, under * 0.9);
      if (tag === 'chest' || tag === 'neck') c = mix(c, P, sstep(0.2, 0.75, n.z) * sstep(0.1, -0.4, n.y)); // bib
    } else if (tag === 'fleg' || tag === 'hleg') {
      const ring = Math.sin(p.y * stripeFreq * 1.3 + nz * 2);
      c = mix(c, S, sstep(0.45, 0.8, ring) * strength * 0.85 * (n.z < 0.3 ? 1 : 0.6));
      c = mix(c, P, sstep(0.0, -0.8, n.z) * 0.35);
    } else if (tag === 'fpaw' || tag === 'hpaw') {
      c = mix(c, P, 0.25);
    } else if (tag === 'tail') {
      const ring = Math.sin(along * 28 + nz);
      c = mix(c, S, sstep(0.3, 0.7, ring) * strength);
      c = mix(c, T, sstep(0.82, 0.92, along));
    } else if (tag === 'head') {
      // forehead "M" + cheek streaks
      const fore = sstep(0.4, 0.9, n.y) * sstep(0.0, 0.5, n.z);
      const m = Math.abs(Math.sin(p.x * 120)) ;
      c = mix(c, S, fore * sstep(0.55, 0.9, m) * strength);
      c = mix(c, S, dorsal * sstep(0.3, 0.7, Math.sin(p.x * 90 + nz * 2)) * 0.5 * strength);
      const cheekLine = sstep(0.5, 0.85, Math.abs(n.x)) * sstep(0.6, 0.95, Math.sin(p.y * 160 + 1.0));
      c = mix(c, S, cheekLine * 0.7 * strength);
      c = mix(c, P, under * 0.8);
    } else if (tag === 'cheek') {
      c = mix(c, P, sstep(-0.3, -0.8, n.y) * 0.85);
      const cheekLine = sstep(0.55, 0.9, Math.abs(n.x)) * sstep(0.55, 0.95, Math.sin(p.y * 170 + 1.0));
      c = mix(c, S, cheekLine * 0.6 * strength);
    } else if (tag === 'muzzle') {
      c = mix(c, P, 0.55 + sstep(0.0, -0.6, n.y) * 0.4);
    }
    return c;
  };
}

/**
 * Chance (Chorkie): black saddle over the back and the top/back of the neck,
 * rich tan face, legs and underside, light fawn beard/muzzle, black tail.
 */
function chorkie(p: THREE.Vector3, n: THREE.Vector3, tag: Tag, along: number): THREE.Color {
  const black = C('#1d1916'), brown = C('#3a2a1e'), tan = C('#93602f'), gold = C('#9c6532'), fawn = C('#c2a27a');
  const nz = vnoise(p.x * 55, p.y * 55, p.z * 55);
  const fine = vnoise(p.x * 200, p.y * 200, p.z * 200);
  const grizzle = (c: THREE.Color) => c.clone().multiplyScalar(0.85 + fine * 0.3);
  if (tag === 'tail') return grizzle(mix(black, brown, along * 0.3));
  if (tag === 'fpaw' || tag === 'hpaw') return grizzle(tan);
  if (tag === 'fleg' || tag === 'hleg') {
    // dark fur reaches down the top of the thighs/shoulders
    const high = sstep(0.11, 0.17, p.y);
    return grizzle(mix(tan, black, high * sstep(-0.2, 0.4, n.y + (tag === 'hleg' ? 0.3 : 0)) * 0.9));
  }
  if (tag === 'muzzle') return grizzle(mix(gold, fawn, 0.35 + sstep(0.0, -0.6, n.y) * 0.5));
  if (tag === 'cheek') return grizzle(mix(gold, fawn, sstep(-0.2, -0.8, n.y) * 0.7));
  if (tag === 'head') {
    // golden face, darker crown + around the ears
    const crown = sstep(0.55, 0.95, n.y) * sstep(0.2, -0.4, n.z);
    return grizzle(mix(gold, brown, crown * 0.75 + nz * 0.15));
  }
  // body: saddle by normal (dorsal) with a ragged edge
  const edge = n.y + (nz - 0.5) * 0.35;
  const saddle = sstep(-0.35, -0.05, edge);
  let c = mix(tan, black, saddle);
  if (tag === 'chest' || tag === 'neck') {
    // dark collar/throat with a light beard spilling down the front
    const front = sstep(0.3, 0.85, n.z);
    c = mix(c, black, front * 0.6);
    if (tag === 'neck') c = mix(c, fawn, front * sstep(0.0, -0.5, n.y) * 0.8);
  }
  return grizzle(mix(c, brown, nz * 0.25 * saddle));
}

export const SPECS: Record<string, PetSpec> = {
  baobao: {
    name: 'BaoBao', seed: 1, kind: 'cat', len: 0.26, rHip: 0.072, rBelly: 0.078, rChest: 0.078, legLen: 0.22, legR: 0.021,
    head: 0.062, muzzle: 0.75, tailLen: 0.34, tailR: 0.02, fur: 0.012, furShells: 14, earKind: 'pointy', eye: 0x8a9a3a,
    coat: tabby('#6a645b', '#262320', '#a9a093', '#161412', 60, 0.95),
    furLen: (_p, n, tag) => (tag === 'muzzle' ? 0.35 : tag === 'head' ? (n.z > 0.45 ? 0.2 : 0.6) : tag === 'cheek' ? 0.6 : tag === 'tail' ? 1.1 : 1),
    earColor: 0x7d776d, earInner: 0xd8a8a0, whiskers: true, tailCarry: 0.85,
  },
  huhu: {
    name: 'HuHu', seed: 2, kind: 'cat', len: 0.29, rHip: 0.098, rBelly: 0.112, rChest: 0.092, legLen: 0.2, legR: 0.025,
    head: 0.07, muzzle: 0.72, tailLen: 0.36, tailR: 0.03, fur: 0.017, furShells: 16, earKind: 'pointy', eye: 0x9a9a4a,
    coat: tabby('#cc7a38', '#9a4d1f', '#ecc898', '#a8582a', 46, 0.75),
    furLen: (_p, n, tag) => (tag === 'muzzle' ? 0.35 : tag === 'head' ? (n.z > 0.45 ? 0.2 : 0.55) : tag === 'cheek' ? 0.75 : tag === 'tail' ? 1.7 : tag === 'belly' || tag === 'hips' ? 1.15 : 1),
    earColor: 0xc97a3c, earInner: 0xe8b0a0, whiskers: true, tailCarry: 0.7,
  },
  chance: {
    name: 'Chance', seed: 3, kind: 'dog', len: 0.27, rHip: 0.066, rBelly: 0.066, rChest: 0.08, legLen: 0.21, legR: 0.019,
    head: 0.06, muzzle: 1.25, tailLen: 0.19, tailR: 0.022, fur: 0.024, furShells: 16, earKind: 'semi', eye: 0x4a2a10,
    coat: chorkie,
    // wiry scruff: long beard + brows, shorter on legs/muzzle bridge
    furLen: (p, n, tag) => {
      if (tag === 'muzzle') return n.y < -0.2 ? 1.05 : 0.35;
      if (tag === 'cheek') return 0.75;
      if (tag === 'head') return n.z > 0.5 ? (n.y > 0.35 ? 1.2 : 0.25) : 0.9;
      if (tag === 'fleg' || tag === 'hleg') return 0.75;
      if (tag === 'fpaw' || tag === 'hpaw') return 0.55;
      if (tag === 'tail') return 1.3;
      return 1 + (vnoise(p.x * 30, p.y * 30, p.z * 30) - 0.5) * 0.5;
    },
    earColor: 0x5a3c22, earInner: 0xa8743f, tailCarry: 1.25,
  },
};
