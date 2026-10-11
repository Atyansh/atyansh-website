// Player controller: Rapier kinematic character controller + state machine.
//
// States
//   move    — ground locomotion (jog default, Shift sprint, Alt walk, C crouch)
//   air     — jump / fall with air control
//   mantle  — scripted climb onto a ledge 0.6–2.0m high (ClimbUp clip)
//   locked  — controlled by an activity (sitting, petting, arcade, climbing…)
//
// Coyote time + jump buffering make jumps feel forgiving; landing impact
// scales the land animation and camera shake.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Physics } from '../engine/Physics';
import type { Input } from '../engine/Input';
import type { Emitter, GameEvents, Surface } from '../engine/Events';
import { Character } from './Character';
import { clamp, damp, dampAngle } from '../engine/math';

const HALF_HEIGHT = 0.55;
const RADIUS = 0.3;
const CENTER = HALF_HEIGHT + RADIUS; // capsule centre above the feet

export const SPEED = { walk: 1.9, jog: 4.6, sprint: 7.4, crouch: 1.5 };
const GRAVITY = 24;
const JUMP_V = 7.6;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.14;

export type PlayerState = 'move' | 'air' | 'mantle' | 'locked';

export class Player {
  readonly character: Character;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  /** Feet position */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  facing = 0;
  state: PlayerState = 'move';
  grounded = true;
  crouching = false;
  groundSurface: Surface = 'concrete';
  private coyote = 0;
  private jumpBuffer = 0;
  private airTime = 0;
  private stepDist = 0;
  private mantleT = 0;
  private mantleFrom = new THREE.Vector3();
  private mantleTo = new THREE.Vector3();
  private mantleDur = 1;
  /** Horizontal speed for the animation layer */
  speed = 0;
  /** Seconds since any movement input (idle throttle, ambient behaviours) */
  idleTime = 0;
  /** Camera shake impulse consumed by the camera rig */
  shake = 0;
  /** When set, gameplay updates are delegated (activities) */
  lockedUpdate: ((dt: number) => void) | null = null;
  /** Lets a level take over the jump button (e.g. grab a climbing wall) */
  jumpInterceptor: (() => boolean) | null = null;

  constructor(private physics: Physics, private events: Emitter<GameEvents>, character: Character, spawn: THREE.Vector3) {
    this.character = character;
    const kc = physics.kinematicCapsule(spawn.x, spawn.y + CENTER, spawn.z, HALF_HEIGHT, RADIUS, { kind: 'player', cameraIgnore: true });
    this.body = kc.body;
    this.collider = kc.collider;
    this.kcc = physics.world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(0.38, 0.22, false);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(70);
    this.position.copy(spawn);
  }

  private filter = (c: RAPIER.Collider) => {
    const k = this.physics.tagOf(c).kind;
    return k !== 'pet' && k !== 'player' && k !== 'ball';
  };

  /** Teleport (level transitions, fast travel) */
  teleport(p: THREE.Vector3, facing?: number): void {
    this.position.copy(p);
    this.body.setTranslation({ x: p.x, y: p.y + CENTER, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + CENTER, z: p.z });
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    if (facing !== undefined) this.facing = facing;
    this.state = 'move';
    this.character.root.position.copy(p);
    this.character.root.rotation.y = this.facing;
  }

  /** Move the capsule by a world delta through the KCC (used by activities too) */
  moveBy(delta: THREE.Vector3, dt: number): void {
    this.kcc.computeColliderMovement(this.collider, { x: delta.x, y: delta.y, z: delta.z }, undefined, undefined, this.filter);
    const m = this.kcc.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.position.set(t.x + m.x, t.y + m.y - CENTER, t.z + m.z);
    this.grounded = this.kcc.computedGrounded();
    if (dt > 0) {
      this.velocity.x = m.x / dt;
      this.velocity.z = m.z / dt;
    }
  }

  /** Place without collision (scripted motion: mantles, seats) */
  setPosition(p: THREE.Vector3): void {
    this.position.copy(p);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + CENTER, z: p.z });
  }

  lock(update: ((dt: number) => void) | null = null): void {
    this.state = 'locked';
    this.lockedUpdate = update;
    this.velocity.set(0, 0, 0);
    this.speed = 0;
  }

  unlock(): void {
    this.state = 'move';
    this.lockedUpdate = null;
    this.character.stopOverride(0.3);
  }

  update(dt: number, input: Input, cameraYaw: number, controlsEnabled: boolean): void {
    const mv = controlsEnabled ? input.move() : { x: 0, y: 0 };
    const wish = Math.hypot(mv.x, mv.y);
    if (wish > 0.01 || (controlsEnabled && input.pressed('jump'))) this.idleTime = 0;
    else this.idleTime += dt;

    if (this.state === 'locked') {
      this.lockedUpdate?.(dt);
      this.character.locomote(0, false, dt);
      this.syncVisual(dt);
      return;
    }
    if (this.state === 'mantle') {
      this.updateMantle(dt);
      this.syncVisual(dt);
      return;
    }

    // Crouch toggle
    if (controlsEnabled && input.pressed('crouch')) this.crouching = !this.crouching;
    const sprint = controlsEnabled && input.isDown('sprint') && !this.crouching;
    if (sprint) this.crouching = false;
    const walk = controlsEnabled && input.isDown('walk');
    const top = this.crouching ? SPEED.crouch : sprint ? SPEED.sprint : walk ? SPEED.walk : SPEED.jog;
    const targetSpeed = top * Math.min(1, wish);

    // Camera-relative wish direction (yaw = boom direction; view = yaw + PI)
    const desired = new THREE.Vector3();
    if (wish > 0.01) {
      const ang = cameraYaw + Math.PI - Math.atan2(mv.x, mv.y);
      desired.set(Math.sin(ang), 0, Math.cos(ang));
      this.facing = dampAngle(this.facing, ang, this.grounded ? 11 : 4, dt);
    }
    const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    const targetVel = desired.multiplyScalar(targetSpeed);
    const accel = this.grounded ? (targetSpeed > horiz.length() ? 16 : 20) : 3.5;
    horiz.x = damp(horiz.x, targetVel.x, accel, dt);
    horiz.z = damp(horiz.z, targetVel.z, accel, dt);

    // Jump with coyote time + buffering
    if (controlsEnabled && input.pressed('jump')) this.jumpBuffer = JUMP_BUFFER;
    this.jumpBuffer -= dt;
    this.coyote = this.grounded ? COYOTE : this.coyote - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.jumpInterceptor?.()) {
      this.jumpBuffer = 0;
      return;
    }
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      if (!this.tryMantle()) {
        this.velocity.y = JUMP_V;
        this.grounded = false;
        this.coyote = 0;
        this.crouching = false;
        this.character.play('JumpStart', { from: 0.32, to: 0.62, timeScale: 1.5, fade: 0.08, hold: true });
        this.events.emit('jump', {});
      }
      this.jumpBuffer = 0;
      if (this.state === 'mantle') return;
    } else if (!this.grounded && controlsEnabled && input.isDown('jump') && this.velocity.y < 1.5 && this.airTime > 0.15) {
      // Grab a ledge mid-air
      if (this.tryMantle()) return;
    }

    this.velocity.y -= GRAVITY * dt;
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -2;
    const wasGrounded = this.grounded;
    const fallSpeed = -this.velocity.y;
    this.moveBy(new THREE.Vector3(horiz.x * dt, this.velocity.y * dt, horiz.z * dt), dt);
    this.velocity.y = this.grounded && this.velocity.y < 0 ? -2 : this.velocity.y;
    // Bumped head
    if (!this.grounded && this.velocity.y > 0 && this.kcc.computedMovement().y < this.velocity.y * dt * 0.5) this.velocity.y = 0;

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (!this.grounded) {
      this.airTime += dt;
      if (this.airTime > 0.18 && this.state !== 'air') {
        this.state = 'air';
        this.character.play('JumpLoop', { loop: true, fade: 0.25 });
      }
    } else {
      if (!wasGrounded && this.airTime > 0.12) this.land(fallSpeed);
      this.airTime = 0;
      if (this.state === 'air') this.state = 'move';
      if (this.character.overrideName === 'JumpStart') this.character.stopOverride(0.15);
    }

    // Footsteps every half stride
    if (this.grounded && this.speed > 0.5) {
      this.stepDist += this.speed * dt;
      const strideHalf = this.crouching ? 0.45 : this.speed > 6 ? 1.05 : this.speed > 3 ? 0.85 : 0.6;
      if (this.stepDist > strideHalf) {
        this.stepDist = 0;
        this.groundSurface = this.probeSurface();
        this.events.emit('footstep', { surface: this.groundSurface, intensity: clamp(this.speed / SPEED.sprint, 0.25, 1) * (this.crouching ? 0.4 : 1) });
      }
    }

    this.character.locomote(this.grounded ? this.speed : 0, this.crouching, dt);
    this.syncVisual(dt);
  }

  private land(fallSpeed: number): void {
    const impact = clamp((fallSpeed - 4) / 12, 0, 1);
    this.groundSurface = this.probeSurface();
    this.events.emit('land', { surface: this.groundSurface, impact });
    this.shake = Math.max(this.shake, impact * 0.6);
    if (impact > 0.15) this.character.play('JumpLand', { from: 0.12, to: 0.55, timeScale: 1.4, fade: 0.06 });
    else this.character.stopOverride(0.12);
  }

  probeSurface(): Surface {
    const hit = this.physics.raycast(new THREE.Vector3(this.position.x, this.position.y + 0.3, this.position.z),
      new THREE.Vector3(0, -1, 0), 1.2, { exclude: this.collider, ignore: ['pet', 'ball', 'player'] });
    return hit?.tag.surface ?? 'concrete';
  }

  /** Look for a ledge in front; start a mantle if found */
  tryMantle(): boolean {
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    // Something in front at chest height?
    const chest = this.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    const wall = this.physics.raycast(chest, fwd, 0.85, { exclude: this.collider, ignore: ['pet', 'ball', 'player', 'npc'] });
    const knee = this.physics.raycast(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), fwd, 0.85, { exclude: this.collider, ignore: ['pet', 'ball', 'player', 'npc'] });
    const hitWall = wall ?? knee;
    if (!hitWall || hitWall.normal.y > 0.5) return false;
    // Find the ledge top just beyond the wall face
    const probe = hitWall.point.clone().addScaledVector(fwd, 0.35);
    probe.y = this.position.y + 2.3;
    const down = this.physics.raycast(probe, new THREE.Vector3(0, -1, 0), 2.3, { exclude: this.collider, ignore: ['pet', 'ball', 'player', 'npc'] });
    if (!down || down.normal.y < 0.7) return false;
    const h = down.point.y - this.position.y;
    if (h < 0.55 || h > 2.05) return false;
    // Headroom for the capsule on top
    const head = this.physics.raycast(down.point.clone().add(new THREE.Vector3(0, 0.05, 0)), new THREE.Vector3(0, 1, 0), 1.7, { exclude: this.collider, ignore: ['pet', 'ball', 'player'] });
    if (head) return false;
    this.state = 'mantle';
    this.mantleT = 0;
    this.mantleFrom.copy(this.position);
    this.mantleTo.copy(down.point).addScaledVector(fwd, 0.25);
    this.mantleDur = h < 1.1 ? 0.75 : 1.1;
    this.facing = Math.atan2(-hitWall.normal.x, -hitWall.normal.z);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.character.play('Mantle', { fade: 0.1, timeScale: this.character.clipDuration('Mantle') / this.mantleDur });
    this.events.emit('sfx', { name: 'mantle' });
    return true;
  }

  private updateMantle(dt: number): void {
    this.mantleT += dt / this.mantleDur;
    const t = clamp(this.mantleT, 0, 1);
    // Rise first, then move forward over the lip
    const up = 1 - Math.pow(1 - clamp(t / 0.7, 0, 1), 2);
    const fwd = clamp((t - 0.45) / 0.55, 0, 1);
    const p = new THREE.Vector3(
      THREE.MathUtils.lerp(this.mantleFrom.x, this.mantleTo.x, fwd),
      THREE.MathUtils.lerp(this.mantleFrom.y, this.mantleTo.y, up),
      THREE.MathUtils.lerp(this.mantleFrom.z, this.mantleTo.z, fwd),
    );
    this.setPosition(p);
    this.character.locomote(0, false, dt);
    if (t >= 1) {
      this.state = 'move';
      this.grounded = true;
      this.character.stopOverride(0.2);
    }
  }

  private syncVisual(dt: number): void {
    const r = this.character.root;
    r.position.copy(this.position);
    if (this.state !== 'locked') {
      // upright again after activities that tilt the body (climbing)
      r.rotation.set(0, dampAngle(r.rotation.y, this.facing, 14, dt), 0);
    }
    this.character.update(dt);
  }
}
