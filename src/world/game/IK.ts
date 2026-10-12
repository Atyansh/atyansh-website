// Small IK toolkit for layering procedural poses over animation, in world
// space so it works with any skeleton's bone-axis conventions:
//  - LimbIK: analytic two-bone (arm / leg) with a pole target
//  - setBoneWorldQuat / swingBone: rotate a bone to a world orientation
//  - Hand: orient a hand from (finger direction, palm normal) measured off
//    its own finger bones, and curl the fingers by a given amount
// All functions write bone.quaternion and refresh the bone's world matrix.

import * as THREE from 'three';
import { clamp } from '../engine/math';

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export const worldPos = (o: THREE.Object3D, out = new THREE.Vector3()) => o.getWorldPosition(out);

/** Set a bone's world rotation (keeps its parent) */
export function setBoneWorldQuat(bone: THREE.Object3D, q: THREE.Quaternion): void {
  const parent = bone.parent ? bone.parent.getWorldQuaternion(_q2).invert() : _q2.identity();
  bone.quaternion.copy(parent.multiply(q));
  bone.updateWorldMatrix(false, true);
}

/** Rotate a bone (in world space) so direction `from` becomes `to` */
export function swingBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, weight = 1): void {
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  if (weight < 1) _q.slerp(new THREE.Quaternion(), 1 - weight);
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  setBoneWorldQuat(bone, _q.clone().multiply(world));
}

/** Two-bone analytic IK in world space (robust to any bone axis convention) */
export class LimbIK {
  private lenA = 0;
  private lenB = 0;
  constructor(readonly upper: THREE.Bone, readonly lower: THREE.Bone, readonly end: THREE.Bone) {}

  measure(): void {
    this.upper.updateWorldMatrix(true, true);
    const a = worldPos(this.upper, _a);
    const b = worldPos(this.lower, _b);
    const c = worldPos(this.end, _c);
    this.lenA = a.distanceTo(b);
    this.lenB = b.distanceTo(c);
  }

  get reach(): number {
    if (!this.lenA) this.measure();
    return this.lenA + this.lenB;
  }

  solve(target: THREE.Vector3, pole: THREE.Vector3, weight = 1): void {
    if (!this.lenA) this.measure();
    const before = weight < 1 ? [this.upper.quaternion.clone(), this.lower.quaternion.clone()] : null;
    const a = worldPos(this.upper, new THREE.Vector3());
    const toT = target.clone().sub(a);
    const d = clamp(toT.length(), Math.abs(this.lenA - this.lenB) + 0.01, this.lenA + this.lenB - 0.002);
    const dir = toT.normalize();
    const t = a.clone().addScaledVector(dir, d);
    const cosA = clamp((this.lenA * this.lenA + d * d - this.lenB * this.lenB) / (2 * this.lenA * d), -1, 1);
    const along = this.lenA * cosA;
    const perp = this.lenA * Math.sqrt(1 - cosA * cosA);
    const poleDir = pole.clone().sub(a);
    poleDir.addScaledVector(dir, -poleDir.dot(dir));
    if (poleDir.lengthSq() < 1e-8) poleDir.set(0, -1, 0).addScaledVector(dir, -dir.y);
    poleDir.normalize();
    const elbow = a.clone().addScaledVector(dir, along).addScaledVector(poleDir, perp);
    swingBone(this.upper, worldPos(this.lower, new THREE.Vector3()).sub(a), elbow.clone().sub(a));
    const b2 = worldPos(this.lower, new THREE.Vector3());
    swingBone(this.lower, worldPos(this.end, new THREE.Vector3()).sub(b2), t.clone().sub(b2));
    if (before) {
      this.upper.quaternion.slerpQuaternions(before[0], this.upper.quaternion.clone(), weight);
      this.lower.quaternion.slerpQuaternions(before[1], this.lower.quaternion.clone(), weight);
      this.upper.updateWorldMatrix(false, true);
    }
  }
}

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
const THUMB_SIGN = { l: -1, r: 1 }; // thumb sweeps across the palm (measured on the Rocketbox rig)

/**
 * A hand: orient it by finger direction + palm normal, and pose its fingers.
 * Axes are measured from the bones each time, so it works on any rig with
 * the game's bone names (hand_x, index_01_x, pinky_01_x, …).
 */
export class Hand {
  readonly hand: THREE.Bone;
  private joints: THREE.Bone[][] = [];
  private bind = new Map<THREE.Bone, THREE.Quaternion>();

  /** `rest`: bind-pose local rotations by bone name (Character.rest) */
  constructor(bones: Map<string, THREE.Bone>, rest: Map<string, THREE.Quaternion>, readonly side: 'l' | 'r') {
    this.hand = bones.get(`hand_${side}`)!;
    for (const f of FINGERS) {
      const chain = [1, 2, 3].map((k) => bones.get(`${f}_0${k}_${side}`)).filter(Boolean) as THREE.Bone[];
      this.joints.push(chain);
      // straight fingers come from the bind pose
      for (const j of chain) this.bind.set(j, (rest.get(j.name) ?? j.quaternion).clone());
    }
  }

  get ok(): boolean {
    return !!this.hand && this.joints[1].length > 0 && this.joints[4].length > 0;
  }

  /** Current finger direction (wrist → knuckles) and palm normal, world space */
  frame(): { fingers: THREE.Vector3; palm: THREE.Vector3; side: THREE.Vector3 } {
    const w = worldPos(this.hand, new THREE.Vector3());
    const idx = worldPos(this.joints[1][0], new THREE.Vector3());
    const pnk = worldPos(this.joints[4][0], new THREE.Vector3());
    const knuckles = idx.clone().add(pnk).multiplyScalar(0.5);
    const fingers = knuckles.sub(w).normalize();
    // index→pinky across the knuckles; palm normal follows the right-hand rule
    const across = pnk.sub(idx).normalize();
    const palm = new THREE.Vector3().crossVectors(fingers, across).normalize();
    if (this.side === 'l') palm.negate();
    const side = new THREE.Vector3().crossVectors(palm, fingers).normalize();
    return { fingers, palm, side };
  }

  /** Rotate the hand so its fingers point along `fingers` and its palm faces `palm` */
  orient(fingers: THREE.Vector3, palm: THREE.Vector3, weight = 1): void {
    const cur = this.frame();
    const basis = (f: THREE.Vector3, p: THREE.Vector3) => {
      const ff = f.clone().normalize();
      const pp = p.clone().addScaledVector(ff, -p.dot(ff)).normalize();
      const ss = new THREE.Vector3().crossVectors(pp, ff);
      return new THREE.Matrix4().makeBasis(ff, pp, ss);
    };
    const from = basis(cur.fingers, cur.palm);
    const to = basis(fingers, palm);
    const r = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
    if (weight < 1) r.slerp(new THREE.Quaternion(), 1 - weight);
    const world = this.hand.getWorldQuaternion(new THREE.Quaternion());
    setBoneWorldQuat(this.hand, r.multiply(world));
  }

  /**
   * Pose the fingers: `curl` 0 = straight, 1 = fist; `thumb` curl separately.
   * Each joint bends about the hand's side axis toward the palm.
   */
  curl(curl: number, thumb = curl * 0.6, weight = 1): void {
    const f = this.frame();
    for (let i = 0; i < this.joints.length; i++) {
      const amt = i === 0 ? thumb : curl;
      for (let k = 0; k < this.joints[i].length; k++) {
        const j = this.joints[i][k];
        const before = j.quaternion.clone();
        j.quaternion.copy(this.bind.get(j)!);
        j.updateWorldMatrix(false, true);
        // bend toward the palm: rotate about the side axis
        const ang = amt * (k === 0 ? 1.1 : 1.35) * (i === 0 ? 0.6 : 1);
        // fingers fold about the knuckle line; the thumb sweeps across the palm
        const axis = i === 0 ? f.palm : f.side;
        const world = j.getWorldQuaternion(new THREE.Quaternion());
        const q = new THREE.Quaternion().setFromAxisAngle(axis, i === 0 ? ang * THUMB_SIGN[this.side] : -ang);
        setBoneWorldQuat(j, q.multiply(world));
        if (weight < 1) { j.quaternion.slerpQuaternions(before, j.quaternion.clone(), weight); j.updateWorldMatrix(false, true); }
      }
    }
  }
}
