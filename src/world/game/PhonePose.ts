// Phone in hand (GTA-style: you can walk around with it). When the phone
// opens, the right hand pulls it from the trouser pocket and brings it up
// in front of the chest; the left hand comes in to cradle it, fingers wrap
// its edges, thumbs over the screen, and the head tips down to read it.
// Runs as a system after the animation update, so the legs keep walking
// underneath. Everything eases in/out by weight.

import * as THREE from 'three';
import type { Game } from './Game';
import type { Character } from './Character';
import { Hand, LimbIK, setBoneWorldQuat, worldPos } from './IK';
import { clamp } from '../engine/math';

const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const RAISE = 0.55; // seconds from pocket to chest
const W = 0.072, H = 0.152; // phone size

export class PhonePose {
  private on = false;
  private t = 0;
  private ch: Character | null = null;
  private armR: LimbIK | null = null;
  private armL: LimbIK | null = null;
  private handR: Hand | null = null;
  private handL: Hand | null = null;
  readonly phone: THREE.Mesh;

  constructor(private game: Game) {
    const body = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.35, metalness: 0.6 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9fc8ff, emissiveIntensity: 1.6, roughness: 0.2 });
    this.phone = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.009), [body, body, body, body, screen, body]); // screen on +Z
    this.phone.castShadow = true;
    this.phone.visible = false;
    game.scene.add(this.phone);
  }

  show(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
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
      this.handR = b.get('hand_r') ? new Hand(b, ch.rest, 'r') : null;
      this.handL = b.get('hand_l') ? new Hand(b, ch.rest, 'l') : null;
    }
    this.t = this.on ? this.t + dt : Math.max(0, this.t - dt * 1.6);
    const raise = smooth(this.t / RAISE);
    const w = this.on ? smooth(this.t / 0.18) : smooth(this.t / 0.25);
    if (w <= 0.001 || !this.armR || !this.armL || !this.handR?.ok || !this.handL?.ok || !ch.root.visible) { this.phone.visible = false; return; }

    const b = ch.bones;
    const pelvis = b.get('pelvis'), neck = b.get('neck_01'), head = b.get('Head');
    if (!pelvis || !neck || !head) return;
    ch.root.updateMatrixWorld(true);
    const yaw = ch.root.rotation.y;
    const s = ch.root.scale.y;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const up = new THREE.Vector3(0, 1, 0);
    const moving = clamp(this.game.player.speed / 3, 0, 1);

    // ---- look down at it (less while walking: eyes on the street too) ----
    const tilt = (0.55 - moving * 0.2) * raise * w;
    for (const [bone, k] of [[neck, 0.4], [head, 0.6]] as const) {
      const q = new THREE.Quaternion().setFromAxisAngle(right, -tilt * k);
      setBoneWorldQuat(bone, q.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
    }
    const eyes = worldPos(head).addScaledVector(fwd, 0.09 * s).addScaledVector(up, 0.05 * s);

    // ---- where the phone is: pocket → in front of the chest ----
    const pocket = worldPos(pelvis).addScaledVector(right, 0.2 * s).addScaledVector(up, -0.1 * s).addScaledVector(fwd, 0.05 * s);
    // in front of the sternum, close enough that both elbows bend (~0.4 m from each shoulder)
    const chest = worldPos(b.get('upperarm_l')!).add(worldPos(b.get('upperarm_r')!)).multiplyScalar(0.5);
    const hold = chest.addScaledVector(up, -0.24 * s).addScaledVector(fwd, 0.27 * s).addScaledVector(right, 0.02 * s);
    const arc = Math.sin(raise * Math.PI) * 0.1 * s; // swing out past the hip
    const phonePos = pocket.lerp(hold, raise).addScaledVector(fwd, arc).addScaledVector(right, arc * 0.5);
    // phone frame: screen normal toward the eyes, top pointing away from the body
    const n = eyes.clone().sub(phonePos).normalize();
    const lean = up.clone().addScaledVector(fwd, 0.5);
    const top = lean.addScaledVector(n, -lean.dot(n)).normalize();
    const pr = new THREE.Vector3().crossVectors(top, n).normalize(); // phone's right edge
    const held = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(pr, top, n));
    const inPocket = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, up, right)); // upright against the thigh
    this.phone.quaternion.slerpQuaternions(inPocket, held, smooth((raise - 0.1) / 0.6));
    this.phone.position.copy(phonePos);
    this.phone.scale.setScalar(s);
    this.phone.visible = true;
    // the phone's actual axes this frame (mid-raise they differ from `held`)
    const PX = new THREE.Vector3(1, 0, 0).applyQuaternion(this.phone.quaternion);
    const PY = new THREE.Vector3(0, 1, 0).applyQuaternion(this.phone.quaternion);
    const PZ = new THREE.Vector3(0, 0, 1).applyQuaternion(this.phone.quaternion);

    // ---- right hand: palm on the back, fingers up the right edge ----
    const shoulderR = worldPos(b.get('upperarm_r')!);
    const wristR = phonePos.clone().addScaledVector(PY, -0.085 * s).addScaledVector(PZ, -0.03 * s).addScaledVector(PX, 0.02 * s);
    this.armR.solve(wristR, shoulderR.clone().addScaledVector(up, -0.7).addScaledVector(right, 0.3).addScaledVector(fwd, -0.3), w);
    this.handR.orient(PY.clone().addScaledVector(PX, -0.25), PZ, w);
    this.handR.curl(0.45, 0.25, w);

    // ---- left hand cradles once it's up ----
    const wl = w * smooth((this.t - RAISE * 0.5) / 0.35) * (this.on ? 1 : raise);
    if (wl > 0.001) {
      const shoulderL = worldPos(b.get('upperarm_l')!);
      const wristL = phonePos.clone().addScaledVector(PY, -0.09 * s).addScaledVector(PZ, -0.035 * s).addScaledVector(PX, -0.045 * s);
      this.armL.solve(wristL, shoulderL.clone().addScaledVector(up, -0.7).addScaledVector(right, -0.3).addScaledVector(fwd, -0.3), wl);
      this.handL.orient(PY.clone().addScaledVector(PX, 0.35), PZ, wl);
      this.handL.curl(0.5, 0.25, wl);
    }
  }
}
