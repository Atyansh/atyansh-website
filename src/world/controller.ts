// Third-person movement: camera-relative locomotion with acceleration,
// turn-toward-heading, circle-vs-AABB collision resolve, and curb step-up
// via ground-height sampling.

import * as THREE from 'three';
import type { ColliderRect } from './types';

const WALK_SPEED = 3.0;
const RUN_SPEED = 6.8;
const ACCEL = 18;
const DECEL = 22;
const TURN_RATE = 12; // rad/s toward desired heading
const RADIUS = 0.42;  // player capsule radius (XZ)
const JUMP_SPEED = 7.2; // m/s up (apex ~1.3m at GRAVITY 20 — comfortably vaults the park fence)
const GRAVITY = 20;     // m/s^2, game-y for a snappy arc

export class PlayerController {
  position = new THREE.Vector3(0, 0, 0);
  /** Facing angle around Y (0 = +Z) */
  heading = 0;
  speed = 0;
  grounded = true;
  private vy = 0;
  private groundY = 0;

  constructor(
    public colliders: ColliderRect[],
    spawn: THREE.Vector3,
    public groundFn: (x: number, z: number) => number,
  ) {
    this.position.copy(spawn);
    this.groundY = this.groundFn(spawn.x, spawn.z);
    this.position.y = this.groundY;
  }

  /** Hard swap for level transitions */
  setLevel(colliders: ColliderRect[], groundFn: (x: number, z: number) => number, x: number, z: number, heading: number): void {
    this.colliders = colliders;
    this.groundFn = groundFn;
    this.position.set(x, groundFn(x, z), z);
    this.groundY = this.position.y;
    this.heading = heading;
    this.speed = 0;
    this.grounded = true;
  }

  update(
    dt: number,
    move: { x: number; y: number },
    sprinting: boolean,
    cameraYaw: number,
    jump = false,
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
      // Desired heading is camera-relative. cameraYaw is the boom direction
      // (pivot -> camera): the view direction is its opposite (+PI), and in
      // this Y-up heading convention screen-right is a NEGATIVE rotation from
      // the view heading — hence -atan2.
      const desired = cameraYaw + Math.PI - Math.atan2(move.x, move.y);
      this.heading = dampAngle(this.heading, desired, TURN_RATE, dt);
    }

    if (this.speed > 0.001) {
      const dx = Math.sin(this.heading) * this.speed * dt;
      const dz = Math.cos(this.heading) * this.speed * dt;
      this.moveWithCollision(dx, dz);
    }

    // Vertical: grounded follows terrain smoothly; airborne integrates
    const targetY = this.groundFn(this.position.x, this.position.z);
    if (this.grounded && jump) {
      this.grounded = false;
      this.vy = JUMP_SPEED;
    }
    if (this.grounded) {
      // Smooth curb step-up so steps don't pop
      this.groundY += (targetY - this.groundY) * Math.min(1, dt * 14);
      this.position.y = this.groundY;
    } else {
      this.vy -= GRAVITY * dt;
      this.position.y += this.vy * dt;
      if (this.vy <= 0 && this.position.y <= targetY) {
        this.position.y = targetY;
        this.groundY = targetY;
        this.vy = 0;
        this.grounded = true;
      }
    }
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
      // Height-limited obstacles (fences) are cleared once feet pass their top
      if (c.top !== undefined && this.position.y >= c.top) continue;
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
