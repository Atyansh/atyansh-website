// Phone in hand: when the phone UI opens, the character pulls the phone out
// of the right trouser pocket, brings it up in front of the chest, steadies
// it with the left hand and looks down at the screen. Runs as a system
// after the character's animation update, layering arm IK and a head/neck
// tilt over whatever the body is doing, weighted so it eases in and out.

import * as THREE from 'three';
import type { Game } from './Game';
import type { Character } from './Character';
import { LimbIK } from './Climbing';
import { clamp } from '../engine/math';

const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const RAISE = 0.55; // seconds from pocket to chest

export class PhonePose {
  private on = false;
  private t = 0; // seconds since open (or since close, counting down)
  private ch: Character | null = null;
  private armR: LimbIK | null = null;
  private armL: LimbIK | null = null;
  readonly phone: THREE.Mesh;

  constructor(private game: Game) {
    const body = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.35, metalness: 0.6 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9fc8ff, emissiveIntensity: 1.6, roughness: 0.2 });
    // screen on +Z
    const g = new THREE.BoxGeometry(0.072, 0.15, 0.009);
    this.phone = new THREE.Mesh(g, [body, body, body, body, screen, body]);
    this.phone.castShadow = true;
    this.phone.visible = false;
    game.scene.add(this.phone);
  }

  show(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    // opening starts from the pocket; closing reverses from wherever we are
    this.t = on ? 0 : Math.min(this.t, RAISE);
  }

  update(dt: number): void {
    const ch = this.game.player?.character;
    if (!ch) return;
    if (ch !== this.ch) {
      this.ch = ch;
      const b = ch.bones;
      const ik = (s: string) => (b.get(`upperarm_${s}`) && b.get(`lowerarm_${s}`) && b.get(`hand_${s}`) ? new LimbIK(b.get(`upperarm_${s}`)!, b.get(`lowerarm_${s}`)!, b.get(`hand_${s}`)!) : null);
      this.armR = ik('r');
      this.armL = ik('l');
    }
    this.t = this.on ? this.t + dt : Math.max(0, this.t - dt * 1.6);
    // raise: 0 = in pocket, 1 = held in front; w = overall IK weight
    const raise = smooth(this.t / RAISE);
    const w = this.on ? smooth(this.t / 0.18) : smooth(this.t / 0.25);
    if (w <= 0.001 || !this.armR || !ch.root.visible) { this.phone.visible = false; return; }

    const b = ch.bones;
    const pelvis = b.get('pelvis'), chest = b.get('spine_03') ?? b.get('spine_02'), head = b.get('Head'), neck = b.get('neck_01');
    if (!pelvis || !chest || !head) return;
    ch.root.updateMatrixWorld(true);
    const yaw = ch.root.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const up = new THREE.Vector3(0, 1, 0);
    const pel = pelvis.getWorldPosition(new THREE.Vector3());
    const ch3 = chest.getWorldPosition(new THREE.Vector3());
    const scale = ch.root.scale.y;

    // look down first (so the eye point used to aim the phone is final)
    const tilt = -0.6 * raise * w; // negative about `right` = chin down
    const rot = (bone: THREE.Object3D, ang: number) => {
      const q = new THREE.Quaternion().setFromAxisAngle(right, ang);
      const world = bone.getWorldQuaternion(new THREE.Quaternion());
      const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
      bone.quaternion.copy(parent.multiply(q.multiply(world)));
      bone.updateMatrixWorld(true);
    };
    if (neck) rot(neck, tilt * 0.45);
    rot(head, tilt * 0.55);
    const eyes = head.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.08 * scale).addScaledVector(up, 0.04 * scale);

    // phone path: pocket → chest
    const pocket = pel.clone().addScaledVector(right, 0.19 * scale).addScaledVector(up, -0.1 * scale).addScaledVector(fwd, 0.04 * scale);
    const hold = ch3.clone().addScaledVector(fwd, 0.3 * scale).addScaledVector(up, -0.1 * scale).addScaledVector(right, 0.03 * scale);
    const arc = Math.sin(raise * Math.PI) * 0.08 * scale; // swing out from the hip
    const phonePos = pocket.clone().lerp(hold, raise).addScaledVector(fwd, arc).addScaledVector(right, arc * 0.6);

    const blendSolve = (ik: LimbIK, upper: string, lower: string, hand: string, target: THREE.Vector3, pole: THREE.Vector3, weight: number) => {
      const bones = [b.get(upper)!, b.get(lower)!, b.get(hand)!];
      const before = bones.map((x) => x.quaternion.clone());
      ik.solve(target, pole);
      bones.forEach((x, i) => x.quaternion.slerpQuaternions(before[i], x.quaternion.clone(), weight));
      bones[0].updateMatrixWorld(true);
    };
    // right hand grips the lower back of the phone
    const shoulderR = b.get('upperarm_r')!.getWorldPosition(new THREE.Vector3());
    const handTarget = phonePos.clone().addScaledVector(fwd, -0.03 * scale).addScaledVector(up, -0.05 * scale);
    blendSolve(this.armR, 'upperarm_r', 'lowerarm_r', 'hand_r', handTarget,
      shoulderR.clone().addScaledVector(up, -0.6).addScaledVector(right, 0.35).addScaledVector(fwd, -0.2), w);
    // left hand comes in to steady it once it's up
    if (this.armL) {
      const shoulderL = b.get('upperarm_l')!.getWorldPosition(new THREE.Vector3());
      const lt = phonePos.clone().addScaledVector(right, -0.06 * scale).addScaledVector(up, -0.06 * scale).addScaledVector(fwd, -0.03 * scale);
      blendSolve(this.armL, 'upperarm_l', 'lowerarm_l', 'hand_l', lt,
        shoulderL.clone().addScaledVector(up, -0.6).addScaledVector(right, -0.35).addScaledVector(fwd, -0.2), w * smooth((this.t - RAISE * 0.6) / 0.3) * (this.on ? 1 : raise));
    }
    // wrists: palm under the phone, fingers pointing up the screen
    const handR = b.get('hand_r')!;
    const fromHand = handR.getWorldPosition(new THREE.Vector3());

    // the phone itself: screen faces the eyes, upright in the hand
    this.phone.visible = true;
    this.phone.scale.setScalar(scale);
    this.phone.position.copy(raise > 0.02 ? phonePos : fromHand);
    // screen toward the eyes, top of the phone pointing away from the body
    const toEye = eyes.clone().sub(this.phone.position).normalize();
    const top = fwd.clone().addScaledVector(up, 0.6).normalize();
    const facing = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), toEye.clone().negate(), top));
    // in the pocket it's upright against the thigh, screen inward
    const pocketQ = new THREE.Quaternion().setFromAxisAngle(up, yaw - Math.PI / 2);
    this.phone.quaternion.slerpQuaternions(pocketQ, facing, smooth((raise - 0.1) / 0.6));
  }
}
