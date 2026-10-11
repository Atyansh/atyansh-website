// Third-person spring-arm camera.
//
// - Mouse / right-stick orbit with pitch limits.
// - Boom collision: sphere sweep from the shoulder pivot (Rapier), snapping
//   in fast and easing out slow. Foliage, glass, pets and the player are
//   ignored via collider tags.
// - Floor ride: the camera never sinks below the ground beneath it; aiming
//   along the orbit sight line lets further pitch tilt the view skyward.
// - Sprint FOV kick, landing shake, gentle auto-recenter while moving.
// - Shots: blend to a fixed transform for seats / cabinets / inspect views.

import * as THREE from 'three';
import type { Physics } from '../engine/Physics';
import type RAPIER from '@dimforge/rapier3d-compat';
import { clamp, damp, wrapAngle } from '../engine/math';

export interface Shot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
  /** blend time in seconds */
  blend?: number;
}

const PITCH_MIN = -1.05;
const PITCH_MAX = 0.75;

export class CameraRig {
  yaw = Math.PI;
  pitch = 0.18;
  boom = 4.3;
  /** Interiors pull the camera closer */
  boomTarget = 4.3;
  shoulder = 0.42;
  pivotHeight = 1.5;
  sensitivity = 1;
  invertY = false;
  baseFov = 62;
  private currentBoom = 4.3;
  private fov = 62;
  private shakeT = 0;
  private shakeAmp = 0;
  private lastLook = 0;
  private shot: Shot | null = null;
  private shotBlend = 0;
  private shotFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 62 };
  private freePos = new THREE.Vector3();
  private freeQuat = new THREE.Quaternion();
  ignoreCollider: RAPIER.Collider | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera, private physics: Physics) {}

  look(dx: number, dy: number, dt: number): void {
    const s = 0.0022 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + (this.invertY ? -dy : dy) * s, PITCH_MIN, PITCH_MAX);
    if (Math.abs(dx) + Math.abs(dy) > 0.5) this.lastLook = 0;
    else this.lastLook += dt;
  }

  addShake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  setShot(shot: Shot | null): void {
    this.shotFrom.pos.copy(this.camera.position);
    this.shotFrom.quat.copy(this.camera.quaternion);
    this.shotFrom.fov = this.camera.fov;
    this.shot = shot;
    this.shotBlend = 0;
  }

  get inShot(): boolean {
    return this.shot !== null;
  }

  /** Point the orbit behind a heading (after teleports) */
  snapBehind(facing: number): void {
    this.yaw = facing + Math.PI;
    this.pitch = 0.16;
  }

  update(dt: number, focus: THREE.Vector3, facing: number, speed: number, sprinting: boolean): void {
    // ---- free orbit transform ----
    if (speed > 1.5 && this.lastLook > 1.2) {
      const behind = facing + Math.PI;
      this.yaw += wrapAngle(behind - this.yaw) * (1 - Math.exp(-0.9 * dt * Math.min(1, speed / 5)));
    }
    const pivot = new THREE.Vector3(focus.x, focus.y + this.pivotHeight, focus.z);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    pivot.addScaledVector(right, this.shoulder);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.boom = damp(this.boom, this.boomTarget, 3, dt);
    let len = this.boom;
    const hit = this.physics.sphereCast(pivot, dir, 0.22, this.boom + 0.2, {
      exclude: this.ignoreCollider ?? undefined,
      ignore: ['pet', 'ball', 'player', 'npc'],
      filter: (t) => !t.cameraIgnore,
    });
    if (hit !== null) len = Math.max(0.6, hit - 0.1);
    this.currentBoom = len < this.currentBoom ? len : damp(this.currentBoom, len, 3.5, dt);
    const pos = pivot.clone().addScaledVector(dir, this.currentBoom);
    // Floor ride
    const floor = this.physics.raycast(new THREE.Vector3(pos.x, pivot.y, pos.z), new THREE.Vector3(0, -1, 0), pivot.y - pos.y + 2, {
      ignore: ['pet', 'ball', 'player', 'npc'], filter: (t) => !t.cameraIgnore,
    });
    if (floor) pos.y = Math.max(pos.y, floor.point.y + 0.3);

    // Shake (land impacts)
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 38;
      pos.y += Math.sin(this.shakeT) * this.shakeAmp * 0.08;
      pos.x += Math.sin(this.shakeT * 1.3) * this.shakeAmp * 0.04;
      this.shakeAmp = damp(this.shakeAmp, 0, 7, dt);
    }
    this.freePos.copy(pos);
    const m = new THREE.Matrix4().lookAt(pos, pos.clone().addScaledVector(dir, -10), new THREE.Vector3(0, 1, 0));
    this.freeQuat.setFromRotationMatrix(m);

    this.fov = damp(this.fov, this.baseFov + (sprinting && speed > 6 ? 7 : 0), 4, dt);

    // ---- shot blending ----
    if (this.shot) {
      const b = this.shot.blend ?? 0.6;
      this.shotBlend = Math.min(1, this.shotBlend + dt / b);
      const t = this.shotBlend * this.shotBlend * (3 - 2 * this.shotBlend);
      const sm = new THREE.Matrix4().lookAt(this.shot.position, this.shot.target, new THREE.Vector3(0, 1, 0));
      const sq = new THREE.Quaternion().setFromRotationMatrix(sm);
      this.camera.position.lerpVectors(this.shotFrom.pos, this.shot.position, t);
      this.camera.quaternion.slerpQuaternions(this.shotFrom.quat, sq, t);
      this.camera.fov = THREE.MathUtils.lerp(this.shotFrom.fov, this.shot.fov ?? this.baseFov, t);
    } else if (this.shotBlend > 0) {
      // Blend back from the last shot to the live orbit
      this.shotBlend = Math.max(0, this.shotBlend - dt / 0.5);
      const t = this.shotBlend * this.shotBlend * (3 - 2 * this.shotBlend);
      this.camera.position.lerpVectors(this.freePos, this.shotFrom.pos, t);
      this.camera.quaternion.slerpQuaternions(this.freeQuat, this.shotFrom.quat, t);
      this.camera.fov = this.fov;
    } else {
      this.camera.position.copy(this.freePos);
      this.camera.quaternion.copy(this.freeQuat);
      this.camera.fov = this.fov;
    }
    this.camera.updateProjectionMatrix();
  }

  /** Remember where we were so leaving a shot blends back smoothly */
  releaseShot(): void {
    if (!this.shot) return;
    this.shotFrom.pos.copy(this.camera.position);
    this.shotFrom.quat.copy(this.camera.quaternion);
    this.shot = null;
    this.shotBlend = 1;
  }
}
