// Third-person movement: camera-relative locomotion with acceleration,
// turn-toward-heading, circle-vs-AABB collision resolve, and curb step-up
// via ground-height sampling.

import * as THREE from 'three';
import type { ColliderRect } from './types';
import { sampleGroundY } from './graybox';

const WALK_SPEED = 2.2;
const RUN_SPEED = 5.2;
const ACCEL = 18;
const DECEL = 22;
const TURN_RATE = 12; // rad/s toward desired heading
const RADIUS = 0.42;  // player capsule radius (XZ)

export class PlayerController {
  position = new THREE.Vector3(0, 0, 0);
  /** Facing angle around Y (0 = +Z) */
  heading = 0;
  speed = 0;
  private groundY = 0;

  constructor(private colliders: ColliderRect[], spawn: THREE.Vector3) {
    this.position.copy(spawn);
    this.groundY = sampleGroundY(spawn.x, spawn.z);
    this.position.y = this.groundY;
  }

  update(
    dt: number,
    move: { x: number; y: number },
    sprinting: boolean,
    cameraYaw: number,
  ): void {
    const wish = Math.hypot(move.x, move.y);
    const targetSpeed = wish > 0 ? (sprinting ? RUN_SPEED : WALK_SPEED) * wish : 0;

    // Accelerate / decelerate toward target speed
    if (targetSpeed > this.speed) {
      this.speed = Math.min(targetSpeed, this.speed + ACCEL * dt);
    } else {
      this.speed = Math.max(targetSpeed, this.speed - DECEL * dt);
    }

    if (wish > 0) {
      // Desired heading is camera-relative: forward = camera forward on XZ
      const desired = Math.atan2(move.x, move.y) + cameraYaw;
      this.heading = dampAngle(this.heading, desired, TURN_RATE, dt);
    }

    if (this.speed > 0.001) {
      const dx = Math.sin(this.heading) * this.speed * dt;
      const dz = Math.cos(this.heading) * this.speed * dt;
      this.moveWithCollision(dx, dz);
    }

    // Ground height (curbs): smooth vertical follow so steps don't pop
    const targetY = sampleGroundY(this.position.x, this.position.z);
    this.groundY += (targetY - this.groundY) * Math.min(1, dt * 14);
    this.position.y = this.groundY;
  }

  private moveWithCollision(dx: number, dz: number): void {
    // Axis-separated move keeps sliding along walls natural
    this.position.x += dx;
    this.resolve('x');
    this.position.z += dz;
    this.resolve('z');
  }

  private resolve(axis: 'x' | 'z'): void {
    for (const c of this.colliders) {
      const nx = clamp(this.position.x, c.minX, c.maxX);
      const nz = clamp(this.position.z, c.minZ, c.maxZ);
      const ddx = this.position.x - nx;
      const ddz = this.position.z - nz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= RADIUS * RADIUS) continue;
      const d = Math.sqrt(Math.max(d2, 1e-8));
      const push = RADIUS - d;
      if (d > 1e-4) {
        this.position.x += (ddx / d) * push;
        this.position.z += (ddz / d) * push;
      } else {
        // Center inside the rect: push out along the smaller penetration axis
        const left = this.position.x - c.minX + RADIUS;
        const right = c.maxX - this.position.x + RADIUS;
        const top = this.position.z - c.minZ + RADIUS;
        const bottom = c.maxZ - this.position.z + RADIUS;
        const m = Math.min(left, right, top, bottom);
        if (m === left) this.position.x = c.minX - RADIUS;
        else if (m === right) this.position.x = c.maxX + RADIUS;
        else if (m === top) this.position.z = c.minZ - RADIUS;
        else this.position.z = c.maxZ + RADIUS;
      }
    }
    void axis;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Shortest-path angular damp toward a target angle */
function dampAngle(current: number, target: number, rate: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const k = 1 - Math.exp(-rate * dt);
  return current + diff * k;
}
