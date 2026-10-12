// Free climbing with full-body IK.
//
// The climber clings to any collider tagged `climbable`. Each frame a ray
// re-finds the surface under the body (so angled walls and boulder facets
// are followed), the body orients to the surface frame (leaning back on
// overhangs), and four two-bone IK limbs reach for real holds: each limb
// has an ideal reach point; it keeps its hold until it drifts too far, then
// moves to the nearest hold around the ideal along a short arc, alternating
// diagonal pairs like a real climber. At the lip of a boulder the climber
// tops out with the ClimbUp animation.

import * as THREE from 'three';
import type { Game } from './Game';
import { clamp } from '../engine/math';

export interface Hold { p: THREE.Vector3; n: THREE.Vector3 }

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

/** Two-bone analytic IK in world space (robust to any bone axis convention) */
export class LimbIK {
  private lenA = 0;
  private lenB = 0;
  constructor(private upper: THREE.Bone, private lower: THREE.Bone, private end: THREE.Bone) {}

  measure(): void {
    this.upper.updateWorldMatrix(true, true);
    const a = this.upper.getWorldPosition(new THREE.Vector3());
    const b = this.lower.getWorldPosition(new THREE.Vector3());
    const c = this.end.getWorldPosition(new THREE.Vector3());
    this.lenA = a.distanceTo(b);
    this.lenB = b.distanceTo(c);
  }

  private rotateBoneTo(bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3): void {
    _q.setFromUnitVectors(from.normalize(), to.normalize());
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    _q2.copy(_q).multiply(world);
    bone.quaternion.copy(parentWorld.invert().multiply(_q2));
    bone.updateWorldMatrix(false, true);
  }

  solve(target: THREE.Vector3, pole: THREE.Vector3): void {
    if (!this.lenA) this.measure();
    const a = this.upper.getWorldPosition(_a.set(0, 0, 0));
    const toT = target.clone().sub(a);
    const d = clamp(toT.length(), Math.abs(this.lenA - this.lenB) + 0.01, this.lenA + this.lenB - 0.005);
    const dir = toT.normalize();
    const t = a.clone().addScaledVector(dir, d);
    const cosA = clamp((this.lenA * this.lenA + d * d - this.lenB * this.lenB) / (2 * this.lenA * d), -1, 1);
    const along = this.lenA * cosA;
    const perp = this.lenA * Math.sqrt(1 - cosA * cosA);
    const poleDir = pole.clone().sub(a);
    poleDir.addScaledVector(dir, -poleDir.dot(dir)).normalize();
    const elbow = a.clone().addScaledVector(dir, along).addScaledVector(poleDir, perp);
    // upper: (b - a) → (elbow - a)
    const b = this.lower.getWorldPosition(_b.set(0, 0, 0));
    this.rotateBoneTo(this.upper, b.clone().sub(a), elbow.clone().sub(a));
    // lower: (c - b') → (t - b')
    const b2 = this.lower.getWorldPosition(_b.set(0, 0, 0));
    const c = this.end.getWorldPosition(_c.set(0, 0, 0));
    this.rotateBoneTo(this.lower, c.clone().sub(b2), t.clone().sub(b2));
  }
}

interface Limb {
  ik: LimbIK;
  side: number; // -1 left, +1 right
  hand: boolean;
  target: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number; // 0..1 move progress (1 = settled)
}

export class Climbing {
  private holds: Hold[] = [];
  active = false;
  private n = new THREE.Vector3(0, 0, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private right = new THREE.Vector3(1, 0, 0);
  private centre = new THREE.Vector3();
  private limbs: Limb[] = [];
  private topping = 0;
  private topFrom = new THREE.Vector3();
  private topTo = new THREE.Vector3();
  private moveAmt = 0;
  /** The press that started the climb must not also end it */
  private grace = 0;
  onTopOut: ((point: THREE.Vector3) => void) | null = null;
  private applyIKNext = false;

  constructor(private game: Game) {}

  setHolds(h: Hold[]): void {
    this.holds = h;
  }

  private ensureLimbs(): void {
    if (this.limbs.length) return;
    const b = this.game.player.character.bones;
    const make = (u: string, l: string, e: string, side: number, hand: boolean): Limb | null => {
      const U = b.get(u); const L = b.get(l); const E = b.get(e);
      if (!U || !L || !E) return null;
      return { ik: new LimbIK(U, L, E), side, hand, target: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1 };
    };
    for (const l of [make('upperarm_l', 'lowerarm_l', 'hand_l', -1, true), make('upperarm_r', 'lowerarm_r', 'hand_r', 1, true),
      make('thigh_l', 'calf_l', 'foot_l', -1, false), make('thigh_r', 'calf_r', 'foot_r', 1, false)]) if (l) this.limbs.push(l);
  }

  /** Climbable surface in front of the player? */
  probe(): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    const p = this.game.player;
    const fwd = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    for (const h of [1.0, 1.5, 0.5]) {
      const hit = this.game.physics.raycast(p.position.clone().add(new THREE.Vector3(0, h, 0)), fwd, 1.1, { exclude: p.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
      if (hit && hit.tag.climbable && hit.normal.y < 0.75) return { point: hit.point, normal: hit.normal };
    }
    return null;
  }

  start(surface: { point: THREE.Vector3; normal: THREE.Vector3 }): void {
    const g = this.game;
    this.ensureLimbs();
    this.active = true;
    this.topping = 0;
    this.grace = 0.2;
    this.frameFrom(surface.normal);
    this.centre.copy(surface.point).addScaledVector(this.n, 0.36);
    if (this.centre.y < g.player.position.y + 1.0) this.centre.y = g.player.position.y + 1.0;
    for (const l of this.limbs) {
      l.target.copy(this.ideal(l));
      l.from.copy(l.target);
      l.to.copy(l.target);
      l.t = 1;
    }
    g.player.character.play('CrouchIdle', { loop: true, fade: 0.2 });
    g.events.emit('sfx', { name: 'grab' });
    g.beginActivity({
      name: 'climb',
      freeCamera: true,
      hint: 'WASD  Climb · Space  Jump off · C  Drop',
      update: (dt) => this.update(dt),
      end: () => { this.active = false; },
    });
    g.rig.boomTarget = 4.8;
  }

  private frameFrom(normal: THREE.Vector3): void {
    this.n.copy(normal).normalize();
    // wall "up": world up projected onto the surface plane
    this.up.set(0, 1, 0).addScaledVector(this.n, -this.n.y);
    if (this.up.lengthSq() < 1e-4) this.up.set(0, 0, 1);
    this.up.normalize();
    this.right.crossVectors(this.up, this.n).normalize();
  }

  private ideal(l: Limb): THREE.Vector3 {
    const reachUp = l.hand ? 0.72 : -0.86;
    const out = l.hand ? 0.32 : 0.2;
    const ideal = this.centre.clone().addScaledVector(this.up, reachUp).addScaledVector(this.right, l.side * out).addScaledVector(this.n, -0.3);
    // nearest hold around the ideal point
    let best: Hold | null = null;
    let bd = 0.38 * 0.38;
    for (const h of this.holds) {
      const d = h.p.distanceToSquared(ideal);
      if (d < bd) { bd = d; best = h; }
    }
    return best ? best.p.clone().addScaledVector(best.n, 0.04) : ideal.addScaledVector(this.n, 0.02);
  }

  private release(jump: boolean): void {
    const g = this.game;
    const p = g.player;
    const out = this.centre.clone().addScaledVector(this.n, 0.45).addScaledVector(this.up, -0.9);
    out.y = Math.max(out.y, p.position.y);
    p.setPosition(out);
    g.endActivity();
    p.facing = Math.atan2(this.n.x, this.n.z);
    if (jump) {
      p.velocity.set(this.n.x * 3.2, 5.5, this.n.z * 3.2);
      p.grounded = false;
    }
    g.rig.boomTarget = g.level.boom ?? 4.3;
    g.events.emit('sfx', { name: 'release' });
  }

  private update(dt: number): void {
    const g = this.game;
    const p = g.player;
    const ch = p.character;
    this.applyIKNext = true;

    // ---- top-out mantle in progress ----
    if (this.topping > 0) {
      this.topping += dt / 1.1;
      const t = clamp(this.topping, 0, 1);
      const up = 1 - Math.pow(1 - clamp(t / 0.7, 0, 1), 2);
      const fw = clamp((t - 0.45) / 0.55, 0, 1);
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(this.topFrom.x, this.topTo.x, fw),
        THREE.MathUtils.lerp(this.topFrom.y, this.topTo.y, up),
        THREE.MathUtils.lerp(this.topFrom.z, this.topTo.z, fw));
      p.setPosition(pos);
      ch.root.position.copy(pos);
      ch.root.quaternion.setFromEuler(new THREE.Euler(0, p.facing, 0));
      if (t >= 1) {
        g.endActivity();
        g.rig.boomTarget = g.level.boom ?? 4.3;
        this.onTopOut?.(this.topTo.clone());
      }
      return;
    }

    const i = g.input;
    this.grace -= dt;
    if (this.grace <= 0 && i.pressed('jump')) return this.release(true);
    if (i.pressed('crouch') || i.pressed('back')) return this.release(false);
    const mv = i.move();
    const speed = i.isDown('sprint') ? 1.45 : 0.95;
    const delta = new THREE.Vector3().addScaledVector(this.up, mv.y * speed * dt).addScaledVector(this.right, mv.x * speed * dt);
    this.moveAmt = Math.hypot(mv.x, mv.y);

    // ---- follow the surface ----
    const next = this.centre.clone().add(delta);
    const hit = g.physics.raycast(next.clone().addScaledVector(this.n, 0.4), this.n.clone().negate(), 1.4, { exclude: p.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
    if (hit && hit.tag.climbable && hit.normal.y < 0.8) {
      const nn = this.n.clone().lerp(hit.normal, 1 - Math.exp(-dt * 10)).normalize();
      this.frameFrom(nn);
      this.centre.copy(hit.point).addScaledVector(this.n, 0.36);
    } else if (mv.y > 0.2) {
      // lost the surface going up: look for a top to mantle onto
      const probe = this.centre.clone().addScaledVector(this.up, 1.2).addScaledVector(this.n, -0.7);
      probe.y += 1.2;
      const down = g.physics.raycast(probe, new THREE.Vector3(0, -1, 0), 2.6, { exclude: p.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
      if (down && down.normal.y > 0.7) {
        this.topping = 0.0001;
        this.topFrom.copy(p.position);
        const flat = new THREE.Vector3(-this.n.x, 0, -this.n.z).normalize();
        this.topTo.copy(down.point).addScaledVector(flat, 0.3);
        p.facing = Math.atan2(flat.x, flat.z);
        ch.play('Mantle', { fade: 0.15, timeScale: ch.clipDuration('Mantle') / 1.1 });
        g.events.emit('sfx', { name: 'mantle' });
        return;
      }
    }
    // reached the ground going down → step off
    const floor = g.physics.raycast(this.centre.clone(), new THREE.Vector3(0, -1, 0), 3, { exclude: p.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
    if (mv.y < -0.2 && floor && floor.distance < 1.0) return this.release(false);

    // ---- body placement + orientation ----
    const root = this.centre.clone().addScaledVector(this.up, -0.92);
    p.setPosition(root);
    ch.root.position.copy(root);
    const basis = new THREE.Matrix4().makeBasis(this.right.clone().negate(), this.up, this.n.clone().negate());
    ch.root.quaternion.setFromRotationMatrix(basis);
    p.facing = Math.atan2(-this.n.x, -this.n.z);

    // ---- limbs: diagonal gait toward holds ----
    const moving = this.limbs.filter((l) => l.t < 1);
    for (const [k, l] of this.limbs.entries()) {
      if (l.t < 1) {
        l.t = Math.min(1, l.t + dt / (l.hand ? 0.28 : 0.34));
        const s = l.t * l.t * (3 - 2 * l.t);
        l.target.lerpVectors(l.from, l.to, s).addScaledVector(this.n, Math.sin(Math.PI * s) * 0.14);
        continue;
      }
      const ideal = this.ideal(l);
      const drift = l.target.distanceTo(ideal);
      // allow one diagonal pair (LH+RF or RH+LF) to move at a time
      const pairBusy = moving.some((m) => m !== l && !(m.hand !== l.hand && m.side !== l.side));
      if (drift > (this.moveAmt > 0.1 ? 0.24 : 0.5) && !pairBusy) {
        l.from.copy(l.target);
        l.to.copy(ideal);
        l.t = 0;
        if (k < 2) g.events.emit('sfx', { name: 'hold' });
      }
    }
  }

  /** Apply IK after the animation mixer (call each frame while active) */
  applyIK(): void {
    if (!this.active || this.topping > 0) return;
    const ch = this.game.player.character;
    ch.root.updateMatrixWorld(true);
    for (const l of this.limbs) {
      // elbows out and down, knees out and toward the wall
      const pole = l.hand
        ? this.centre.clone().addScaledVector(this.right, l.side * 0.9).addScaledVector(this.up, -0.6).addScaledVector(this.n, 0.3)
        : this.centre.clone().addScaledVector(this.right, l.side * 0.6).addScaledVector(this.n, 0.6).addScaledVector(this.up, -0.4);
      l.ik.solve(l.target, pole);
    }
  }
}
