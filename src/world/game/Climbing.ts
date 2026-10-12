// Bouldering, hold by hold.
//
// The gym is set with graded problems (V0–V7, colour-coded like a real
// circuit). Each problem has start holds, a line of hand holds, footholds
// and a TOP hold; walls are also scattered with spare holds. You climb one
// limb at a time:
//
//   Mouse / WASD   move the aim cursor over the wall (WASD snaps hold to hold)
//   LMB or Q       reach for the aimed hold with the LEFT hand
//   RMB or E       … with the RIGHT hand
//   Space          reach with whichever hand makes sense; when the hold is
//                  beyond static reach, HOLD to charge a dyno and release
//                  when the meter hits the marker
//   R              chalk up (one hand dips in the bag)
//   C              let go (step off if your feet are on the ground)
//
// Feet place themselves on the best footholds below you (or smear / stand on
// the pad). Grip drains with every second you hang: crimps and slopers burn
// it, jugs let you shake out, overhangs and dangling feet make it worse,
// fresh chalk helps. Run out and you peel off. Match both hands on the TOP
// hold to send; boulders then top out onto the summit. Sends, flashes and
// times are saved.
//
// Pose: arms and legs are two-bone IK onto the actual contact points, hands
// orient to the wall and curl to the hold type, the pelvis hangs between
// hands and feet and swings when you move, the head follows your aim. A
// dedicated camera sits off the wall looking at you and where you're aiming.

import * as THREE from 'three';
import type { Game } from './Game';
import type { Character } from './Character';
import { Hand, LimbIK, setBoneWorldQuat, swingBone, worldPos } from './IK';
import { clamp, damp } from '../engine/math';

export type HoldKind = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'foot';

export interface Hold {
  p: THREE.Vector3;
  n: THREE.Vector3;
  kind: HoldKind;
  size: number;
  /** route index, or -1 for a spare hold */
  route: number;
}

export interface Route {
  id: string;
  grade: number;
  color: number;
  colour: string;
  /** hand holds bottom → top (indices into holds) */
  hands: number[];
  start: [number, number];
  top: number;
  /** boulder id when the problem tops out onto a summit */
  boulder: string | null;
  /** where the start tape is (interaction point) */
  tag: THREE.Vector3;
  tagN: THREE.Vector3;
}

const GRIP: Record<HoldKind, { drain: number; curl: number; thumb: number; label: string }> = {
  jug: { drain: 0.012, curl: 0.95, thumb: 0.55, label: 'jug' },
  pinch: { drain: 0.045, curl: 0.55, thumb: 0.9, label: 'pinch' },
  pocket: { drain: 0.055, curl: 0.7, thumb: 0.2, label: 'pocket' },
  crimp: { drain: 0.07, curl: 0.8, thumb: 0.4, label: 'crimp' },
  sloper: { drain: 0.085, curl: 0.2, thumb: 0.15, label: 'sloper' },
  foot: { drain: 0.12, curl: 0.75, thumb: 0.3, label: 'chip' },
};

/** Reach model (metres, for a ~1.8 m climber) */
const SPAN = 1.5; // max hand-to-hand
const BODY = 2.2; // max hand to feet-centre (static)
const DYNO = 2.85; // … when jumping for it
const DYNO_SPAN = 2.1;

type LimbName = 'lh' | 'rh' | 'lf' | 'rf';
interface Limb {
  name: LimbName;
  hand: boolean;
  side: -1 | 1;
  /** hold index; -1 smear on the wall, -2 on the ground, -3 hanging free */
  hold: number;
  at: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  next: number;
  t: number;
  dur: number;
  ik: LimbIK | null;
}

const HUD_CSS = `
.cl-hud { position: fixed; left: 50%; top: 4vh; transform: translateX(-50%); display: none; flex-direction: column; align-items: center; gap: 8px;
  font-family: var(--ui-font); color: #fff; pointer-events: none; z-index: 30; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.cl-hud.on { display: flex; }
.cl-route { font: 800 22px var(--ui-display); letter-spacing: .06em; text-transform: uppercase; display: flex; gap: 14px; align-items: center; }
.cl-route i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; box-shadow: 0 0 0 2px rgba(255,255,255,.6); }
.cl-route span { font: 600 15px var(--ui-font); opacity: .85; letter-spacing: 0; text-transform: none; }
.cl-grip { width: 260px; height: 8px; border-radius: 8px; background: rgba(255,255,255,.18); overflow: hidden; }
.cl-grip b { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #ff5a4a, #ffc23a 35%, #5ee08f 70%); border-radius: 8px; transform-origin: left; }
.cl-grip.low { animation: cl-pulse .5s infinite alternate; }
@keyframes cl-pulse { to { box-shadow: 0 0 0 3px rgba(255,90,74,.7); } }
.cl-note { font: 600 14px var(--ui-font); min-height: 18px; opacity: .9; }
.cl-dyno { width: 200px; height: 10px; border-radius: 10px; background: rgba(255,255,255,.15); position: relative; display: none; }
.cl-dyno.on { display: block; }
.cl-dyno b { position: absolute; left: 0; top: 0; bottom: 0; background: #fff; border-radius: 10px; }
.cl-dyno i { position: absolute; top: -4px; bottom: -4px; width: 4px; background: #ffc23a; border-radius: 2px; }
`;

const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export class Climbing {
  active = false;
  /** fired when a problem is sent (route, seconds, flash) */
  onSend: ((r: Route, secs: number, flash: boolean) => void) | null = null;
  onTopOut: ((point: THREE.Vector3, boulder: string | null) => void) | null = null;

  private limbs: Limb[] = [];
  private ch: Character | null = null;
  private hands: Record<'l' | 'r', Hand | null> = { l: null, r: null };
  private pelvisRest = new THREE.Vector3(0, 0.95, 0);
  private hip = new THREE.Vector3();
  private n = new THREE.Vector3(0, 0, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private right = new THREE.Vector3(1, 0, 0);
  private aim = new THREE.Vector3();
  private aimHold = -1;
  private grip = 1;
  private chalk = 1;
  private chalking = 0;
  private charging = -1; // dyno power while charging (-1 = not)
  private dyno: { t: number; from: THREE.Vector3; to: THREE.Vector3; hand: Limb; hold: number; ok: boolean } | null = null;
  private topping = 0;
  private topFrom = new THREE.Vector3();
  private topTo = new THREE.Vector3();
  private attempt: { route: Route; t: number; moves: number; clean: boolean; started: boolean; flashable: boolean } | null = null;
  private sent = false;
  private grace = 0;
  /** a reach waiting for the feet to step up first */
  private pending: { hand: Limb; hold: number; t: number } | null = null;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private zoom = 3.4;
  private note = '';
  private noteT = 0;
  private hud: HTMLDivElement;
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;

  constructor(private game: Game, readonly holds: Hold[], readonly routes: Route[], private groundY: (p: THREE.Vector3) => number) {
    const st = document.createElement('style');
    st.textContent = HUD_CSS;
    document.head.appendChild(st);
    this.hud = document.createElement('div');
    this.hud.className = 'cl-hud';
    this.hud.innerHTML = '<div class="cl-route"></div><div class="cl-grip"><b></b></div><div class="cl-dyno"><b></b><i></i></div><div class="cl-note"></div>';
    game.ui.root.appendChild(this.hud);
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), this.markerMat);
    this.marker.renderOrder = 998;
    this.marker.visible = false;
    this.marker.userData.noCollide = true;
    game.scene.add(this.marker);
  }

  // ------------------------------------------------------------------ setup

  private bindCharacter(): void {
    const ch = this.game.player.character;
    if (ch === this.ch) return;
    this.ch = ch;
    const b = ch.bones;
    const ik = (u: string, l: string, e: string) => (b.get(u) && b.get(l) && b.get(e) ? new LimbIK(b.get(u)!, b.get(l)!, b.get(e)!) : null);
    const mk = (name: LimbName, hand: boolean, side: -1 | 1, chain: [string, string, string]): Limb => ({
      name, hand, side, hold: -3, at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), next: -3, t: 1, dur: 0.3, ik: ik(...chain),
    });
    this.limbs = [
      mk('lh', true, -1, ['upperarm_l', 'lowerarm_l', 'hand_l']),
      mk('rh', true, 1, ['upperarm_r', 'lowerarm_r', 'hand_r']),
      mk('lf', false, -1, ['thigh_l', 'calf_l', 'foot_l']),
      mk('rf', false, 1, ['thigh_r', 'calf_r', 'foot_r']),
    ];
    this.hands.l = b.get('hand_l') ? new Hand(b, ch.rest, 'l') : null;
    this.hands.r = b.get('hand_r') ? new Hand(b, ch.rest, 'r') : null;
    this.pelvisRest = ch.boneOffset('Idle', 'pelvis', 0);
  }

  private limb(n: LimbName): Limb { return this.limbs.find((l) => l.name === n)!; }
  private get lh(): Limb { return this.limb('lh'); }
  private get rh(): Limb { return this.limb('rh'); }

  /** Where a hand / foot touches a hold */
  private contact(i: number, hand: boolean, side = 0): THREE.Vector3 {
    const h = this.holds[i];
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(h.n, -h.n.y).normalize();
    const along = new THREE.Vector3().crossVectors(up, h.n).normalize();
    return h.p.clone().addScaledVector(h.n, h.size * (hand ? 0.55 : 0.6)).addScaledVector(up, h.size * (hand ? 0.35 : 0.45)).addScaledVector(along, side * 0.05);
  }

  /** Hold the player is looking at to start a climb (route start tape or any wall) */
  probe(): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    const p = this.game.player;
    const fwd = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    for (const h of [1.0, 1.5, 0.5]) {
      const hit = this.game.physics.raycast(p.position.clone().add(new THREE.Vector3(0, h, 0)), fwd, 1.1, { exclude: p.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
      if (hit && hit.tag.climbable && hit.normal.y < 0.75) return { point: hit.point, normal: hit.normal };
    }
    return null;
  }

  /** Start a graded problem from its start holds */
  startRoute(r: Route): void {
    const s = this.game.save;
    const key = `try:${r.id}`;
    const tries = s.data.counters[key] ?? 0;
    s.data.counters[key] = tries + 1;
    s.write();
    this.begin([r.start[0], r.start[1]]);
    this.attempt = { route: r, t: 0, moves: 0, clean: true, started: false, flashable: tries === 0 && !s.flag(`climb:send:${r.id}`) };
    this.say(`${r.colour} V${r.grade} — match the TOP hold`);
  }

  /** Jump onto the wall anywhere: grab the best two holds in reach */
  startFree(surface: { point: THREE.Vector3; normal: THREE.Vector3 }): boolean {
    const base = this.game.player.position;
    const n = surface.normal.clone().setY(0).normalize();
    const side = new THREE.Vector3(-n.z, 0, n.x);
    const cand = this.holds.map((h, i) => ({ h, i })).filter(({ h }) => {
      const d = h.p.clone().sub(base);
      const y = d.y;
      return y > 1.1 && y < 2.15 && Math.abs(d.dot(side)) < 0.9 && d.dot(n) < 0.3 && d.dot(n) > -1.1 && h.n.dot(n) > 0.3;
    });
    if (cand.length < 1) { this.game.ui.toast('Nothing to grab here', 'Look for holds within reach — or start a problem at its coloured tape.', '🧗', 'info'); return false; }
    // pick a left and right hold, both comfortable
    const score = (c: { h: Hold }, s: number) => Math.abs(c.h.p.clone().sub(base).dot(side) - s * 0.3) + Math.abs(c.h.p.y - base.y - 1.75) * 0.7 + (GRIP[c.h.kind].drain * 4);
    const L = [...cand].sort((a, b) => score(a, -1) - score(b, -1))[0];
    const R = [...cand].filter((c) => c.i !== L.i).sort((a, b) => score(a, 1) - score(b, 1))[0] ?? L;
    this.begin([L.i, R.i]);
    this.attempt = null;
    return true;
  }

  private begin(start: [number, number]): void {
    const g = this.game;
    this.bindCharacter();
    if (!this.limbs.every((l) => l.ik)) return;
    this.active = true;
    this.sent = false;
    this.topping = 0;
    this.grip = 1;
    this.chalk = Math.max(this.chalk, 0.6);
    this.charging = -1;
    this.dyno = null;
    this.grace = 0.25;
    const [a, b] = start;
    const same = a === b;
    for (const l of this.limbs) l.t = 1;
    this.lh.hold = a; this.lh.at.copy(this.contact(a, true, same ? -1 : 0));
    this.rh.hold = b; this.rh.at.copy(this.contact(b, true, same ? 1 : 0));
    this.frameFromHands(1);
    // feet start on the ground under you
    const p = g.player.position;
    for (const f of [this.limb('lf'), this.limb('rf')]) {
      f.hold = -2;
      f.at.copy(p).addScaledVector(this.right, f.side * 0.16).addScaledVector(this.n, -0.05);
      f.at.y = this.groundY(f.at);
    }
    this.hip.copy(this.hipTarget());
    this.aim.copy(this.handsMid()).addScaledVector(this.up, 0.6);
    this.camPos.copy(this.hip).addScaledVector(this.n, this.zoom).add(new THREE.Vector3(0, 0.4, 0));
    this.camLook.copy(this.hip);
    g.player.character.play('Idle', { loop: true, fade: 0.2 });
    g.events.emit('sfx', { name: 'grab' });
    g.beginActivity({
      name: 'climb',
      freeCamera: false,
      escape: 'pause',
      hint: 'Mouse  Aim · LMB/Q  Left hand · RMB/E  Right hand · Space  Reach / dyno · R  Chalk · C  Let go',
      update: (dt) => this.update(dt),
      end: () => this.cleanup(),
    });
    g.cameraOverride = (dt, cam) => this.camera(dt, cam);
    this.hud.classList.add('on');
    this.planFeet(true);
  }

  private cleanup(): void {
    const g = this.game;
    this.active = false;
    this.marker.visible = false;
    this.hud.classList.remove('on');
    g.cameraOverride = null;
    g.rig.snapBehind(g.player.facing);
    this.attempt = null;
  }

  // ------------------------------------------------------------------ geometry helpers

  private handsMid(): THREE.Vector3 { return this.lh.at.clone().add(this.rh.at).multiplyScalar(0.5); }
  private feetMid(): THREE.Vector3 { return this.limb('lf').at.clone().add(this.limb('rf').at).multiplyScalar(0.5); }

  private frameFromHands(k: number): void {
    const ns: THREE.Vector3[] = [];
    for (const l of this.limbs) if (l.hold >= 0) ns.push(this.holds[l.hold].n);
    if (!ns.length) return;
    const avg = ns.reduce((a, b) => a.add(b), new THREE.Vector3()).normalize();
    this.n.lerp(avg, k).normalize();
    this.up.set(0, 1, 0).addScaledVector(this.n, -this.n.y);
    if (this.up.lengthSq() < 1e-4) this.up.set(0, 0, 1);
    this.up.normalize();
    this.right.crossVectors(this.up, this.n).normalize();
  }

  /** Where the pelvis wants to hang given the current contacts */
  private hipTarget(): THREE.Vector3 {
    const H = this.handsMid();
    const F = this.feetMid();
    const overhang = Math.max(0, -this.n.y);
    const hip = F.clone().lerp(H, 0.42).addScaledVector(this.n, 0.3 + overhang * 0.25);
    // arms can't be compressed (hips well below the hands)…
    const maxY = H.y - 0.55;
    if (hip.y > maxY) hip.y = maxY;
    // …or over-stretched (hips rise to keep the shoulders in reach)
    const minY = H.y - 1.15;
    if (hip.y < minY) hip.y = minY;
    return hip;
  }

  private reachable(h: number, hand: Limb): 'ok' | 'dyno' | 'no' {
    if (h < 0) return 'no';
    const other = hand === this.lh ? this.rh : this.lh;
    const c = this.contact(h, true);
    const span = c.distanceTo(other.at);
    const body = c.distanceTo(this.feetMid());
    if (c.y < this.feetMid().y + 0.45) return 'no';
    if (span <= SPAN && body <= BODY) return 'ok';
    if (span <= DYNO_SPAN && body <= DYNO && c.y > this.handsMid().y) return 'dyno';
    return 'no';
  }

  /** The hand that should move for a hold (the trailing one / the free side) */
  private sensibleHand(h: number): Limb {
    const c = this.holds[h].p;
    const lat = c.clone().sub(this.handsMid()).dot(this.right);
    if (this.lh.hold === h) return this.rh;
    if (this.rh.hold === h) return this.lh;
    if (Math.abs(lat) > 0.25) return lat < 0 ? this.lh : this.rh;
    return this.lh.at.y < this.rh.at.y ? this.lh : this.rh; // move the lower hand
  }

  // ------------------------------------------------------------------ moves

  private reach(hand: Limb, h: number): void {
    if (hand.t < 1 || this.dyno || this.topping || h < 0) return;
    if (hand.hold === h) return;
    const r = this.reachable(h, hand);
    if (r !== 'ok') {
      // stand up on your feet first if that brings it in reach
      if (this.stepUp(h)) { this.pending = { hand, hold: h, t: 1.2 }; return; }
      if (r === 'no') { this.say('Too far'); this.game.events.emit('sfx', { name: 'tick' }); return; }
      this.say('Out of reach — hold Space to dyno');
      return;
    }
    this.pending = null;
    const other = hand === this.lh ? this.rh : this.lh;
    const match = other.hold === h;
    hand.from.copy(hand.at);
    hand.to.copy(this.contact(h, true, match ? hand.side : 0));
    if (match) other.at.copy(this.contact(h, true, other.side)); // shuffle over to make room
    hand.next = h;
    hand.hold = -3;
    hand.t = 0;
    hand.dur = 0.22 + hand.from.distanceTo(hand.to) * 0.28;
  }

  private landHand(hand: Limb): void {
    hand.hold = hand.next;
    hand.at.copy(hand.to);
    this.game.events.emit('sfx', { name: 'hold' });
    const a = this.attempt;
    if (a) {
      if (!a.started) a.started = true;
      a.moves++;
      const r = a.route;
      if (!r.hands.includes(hand.hold) && a.clean) { a.clean = false; this.say('Off route — this one won\'t count'); }
      if (a.clean && this.lh.hold === r.top && this.rh.hold === r.top) this.send();
      else if (a.clean && hand.hold === r.top) this.say('Match the top!');
    }
    this.planFeet(false);
  }

  /** Move the lower foot up to a higher foothold so `h` comes into reach */
  private stepUp(h: number): boolean {
    const c = this.contact(h, true);
    const feet = [this.limb('lf'), this.limb('rf')].filter((f) => f.t >= 1).sort((a, b) => a.at.y - b.at.y);
    for (const f of feet) {
      const other = f.name === 'lf' ? this.limb('rf') : this.limb('lf');
      let best = -1;
      let bs = Infinity;
      const H = this.handsMid();
      for (let i = 0; i < this.holds.length; i++) {
        const hold = this.holds[i];
        if (i === other.hold || i === this.lh.hold || i === this.rh.hold || hold.n.dot(this.n) < 0.2) continue;
        const rise = hold.p.y - f.at.y;
        if (rise < 0.2 || rise > 0.85 || hold.p.y > H.y - 0.6) continue;
        const lat = Math.abs(hold.p.clone().sub(H).dot(this.right) - f.side * 0.25);
        if (lat > 0.6) continue;
        // useful only if standing on it (the other foot follows) brings the hold in reach
        if (c.distanceTo(hold.p) > BODY + 0.1) continue;
        const sc = lat + Math.abs(rise - 0.5);
        if (sc < bs) { bs = sc; best = i; }
      }
      if (best >= 0) {
        f.from.copy(f.at);
        f.to.copy(this.contact(best, false));
        f.next = best;
        f.t = 0;
        f.dur = 0.35;
        this.say('Stepping up…');
        return true;
      }
    }
    return false;
  }

  /** Put the feet somewhere sensible below the hands */
  private planFeet(force: boolean): void {
    const H = this.handsMid();
    const ground = this.groundY(H);
    for (const f of [this.limb('lf'), this.limb('rf')]) {
      if (f.t < 1) continue;
      const ideal = H.clone().addScaledVector(this.up, -1.45).addScaledVector(this.right, f.side * 0.24).addScaledVector(this.n, 0.02);
      const otherFoot = f.name === 'lf' ? this.limb('rf') : this.limb('lf');
      let best = -1;
      let bd = 0.55;
      for (let i = 0; i < this.holds.length; i++) {
        const h = this.holds[i];
        if (i === otherFoot.hold || i === this.lh.hold || i === this.rh.hold) continue;
        if (h.p.y > H.y - 0.8 || h.n.dot(this.n) < 0.2) continue;
        const d = h.p.distanceTo(ideal) + (h.kind === 'foot' ? -0.05 : 0);
        if (d < bd) { bd = d; best = i; }
      }
      let target: THREE.Vector3;
      let hold: number;
      if (ideal.y - ground < 0.35) { target = ideal.clone(); target.y = ground; hold = -2; }
      else if (best >= 0) { target = this.contact(best, false); hold = best; }
      else {
        // smear: a point on the wall itself
        const hit = this.game.physics.raycast(ideal.clone().addScaledVector(this.n, 0.6), this.n.clone().negate(), 1.2, { ignore: ['player', 'pet', 'ball', 'npc'] });
        if (hit && hit.tag.climbable) { target = hit.point.addScaledVector(this.n, 0.04); hold = -1; }
        else { target = ideal.addScaledVector(this.n, 0.2); hold = -3; }
      }
      if (!force && f.at.distanceTo(target) < 0.18) continue;
      f.from.copy(f.at);
      f.to.copy(target);
      f.next = hold;
      f.t = force ? 1 : 0;
      f.dur = 0.28 + f.from.distanceTo(f.to) * 0.15;
      if (force) { f.at.copy(target); f.hold = hold; }
      if (!force) break; // one foot at a time
    }
  }

  private letGo(fall: boolean): void {
    const g = this.game;
    const p = g.player;
    const out = this.hip.clone().addScaledVector(this.n, 0.25).add(new THREE.Vector3(0, -0.95, 0));
    const ground = this.groundY(out);
    out.y = Math.max(out.y, ground);
    const onGround = this.limbs.filter((l) => !l.hand).every((l) => l.hold === -2);
    if (this.attempt && !this.sent && this.attempt.started) this.say('');
    p.setPosition(out);
    g.endActivity();
    p.facing = Math.atan2(-this.n.x, -this.n.z);
    if (fall && !onGround) {
      p.velocity.set(this.n.x * 1.4, 0.5, this.n.z * 1.4);
      p.grounded = false;
      g.events.emit('sfx', { name: 'release' });
      if (this.attempt && !this.sent) g.ui.toast('Off!', this.grip <= 0 ? 'Pumped out. Shake out on jugs and chalk up next go.' : 'Back to the start tape for another go.', '🧗', 'info');
    }
  }

  private send(): void {
    const a = this.attempt!;
    const r = a.route;
    this.sent = true;
    const flash = a.flashable;
    const s = this.game.save;
    const first = s.setFlag(`climb:send:${r.id}`);
    if (flash) s.setFlag(`climb:flash:${r.id}`);
    const bestKey = `best:${r.id}`;
    const prev = s.data.counters[bestKey];
    const ms = Math.round(a.t * 1000);
    if (!prev || ms < prev) { s.data.counters[bestKey] = ms; s.write(); }
    this.game.events.emit('sfx', { name: 'goal' });
    this.game.ui.toast(`Sent! ${r.colour} V${r.grade}${flash ? ' · FLASH' : ''}`,
      `${fmtTime(a.t)} · ${a.moves} moves${prev && ms < prev ? ' · new best' : first ? '' : ' · repeat'}`, '🧗', 'goal');
    this.game.events.emit('progress', { key: `climb:send:${r.grade}` });
    this.onSend?.(r, a.t, flash);
    if (r.boulder) setTimeout(() => { if (this.active && !this.topping) this.startTopOut(); }, 700);
    else this.say('Sent! C to drop off');
  }

  private startTopOut(): void {
    const g = this.game;
    const H = this.handsMid();
    const probe = H.clone().addScaledVector(this.n, -0.7).add(new THREE.Vector3(0, 1.4, 0));
    const down = g.physics.raycast(probe, new THREE.Vector3(0, -1, 0), 2.6, { exclude: g.player.collider, ignore: ['player', 'pet', 'ball', 'npc'] });
    if (!down || down.normal.y < 0.6) { this.say('Sent! C to drop off'); return; }
    this.topping = 0.0001;
    this.topFrom.copy(g.player.position);
    const flat = new THREE.Vector3(-this.n.x, 0, -this.n.z).normalize();
    this.topTo.copy(down.point).addScaledVector(flat, 0.35);
    g.player.facing = Math.atan2(flat.x, flat.z);
    const ch = g.player.character;
    ch.play('Mantle', { fade: 0.15, timeScale: ch.clipDuration('Mantle') / 1.2 });
    g.events.emit('sfx', { name: 'mantle' });
  }

  private say(t: string): void {
    this.note = t;
    this.noteT = t ? 3 : 0;
  }

  // ------------------------------------------------------------------ per frame

  private update(dt: number): void {
    const g = this.game;
    const p = g.player;
    const ch = p.character;
    if (ch !== this.ch) { this.bindCharacter(); }

    // ---- top-out mantle ----
    if (this.topping > 0) {
      this.topping += dt / 1.2;
      const t = clamp(this.topping, 0, 1);
      const upK = 1 - Math.pow(1 - clamp(t / 0.7, 0, 1), 2);
      const fw = clamp((t - 0.45) / 0.55, 0, 1);
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(this.topFrom.x, this.topTo.x, fw),
        THREE.MathUtils.lerp(this.topFrom.y, this.topTo.y, upK),
        THREE.MathUtils.lerp(this.topFrom.z, this.topTo.z, fw));
      p.setPosition(pos);
      ch.root.position.copy(pos);
      ch.root.quaternion.setFromEuler(new THREE.Euler(0, p.facing, 0));
      if (t >= 1) {
        const r = this.attempt?.route ?? null;
        g.endActivity();
        this.onTopOut?.(this.topTo.clone(), r?.boulder ?? null);
      }
      return;
    }

    const i = g.input;
    this.grace -= dt;
    if (this.attempt?.started && !this.sent) this.attempt.t += dt;

    // ---- aim cursor on the wall ----
    const m = g.mouse;
    const pad = i.padLook;
    const sens = 0.0032 * (g.save.settings.sensitivity ?? 1);
    this.aim.addScaledVector(this.right, (m.dx + pad.x * 500 * dt) * sens).addScaledVector(this.up, -(m.dy + pad.y * 400 * dt) * sens * (g.save.settings.invertY ? -1 : 1));
    // keep the cursor on the wall plane through the hands, within ~2.6 m
    const base = this.handsMid();
    const rel = this.aim.clone().sub(base);
    rel.addScaledVector(this.n, -rel.dot(this.n));
    if (rel.length() > 2.6) rel.setLength(2.6);
    this.aim.copy(base).add(rel);
    // WASD: hop the cursor to the nearest hold that way
    const dir = i.pressedCode('KeyW') ? this.up : i.pressedCode('KeyS') ? this.up.clone().negate() : i.pressedCode('KeyA') ? this.right.clone().negate() : i.pressedCode('KeyD') ? this.right : null;
    if (dir) {
      const from = this.aimHold >= 0 ? this.holds[this.aimHold].p : this.aim;
      let best = -1;
      let bs = Infinity;
      this.holds.forEach((h, k) => {
        if (k === this.aimHold) return;
        const d = h.p.clone().sub(from);
        const along = d.dot(dir);
        if (along < 0.1 || d.length() > 1.6 || h.n.dot(this.n) < 0.2) return;
        const sc = along + (d.length() - along) * 2;
        const onRoute = this.attempt && this.attempt.route.hands.includes(k) ? -0.25 : 0;
        if (sc + onRoute < bs) { bs = sc + onRoute; best = k; }
      });
      if (best >= 0) this.aim.copy(this.holds[best].p);
    }
    // the aimed hold: nearest to the cursor
    this.aimHold = -1;
    let bd = 0.32;
    this.holds.forEach((h, k) => {
      if (h.n.dot(this.n) < 0.1) return;
      const d = h.p.distanceTo(this.aim);
      if (d < bd) { bd = d; this.aimHold = k; }
    });

    // ---- actions ----
    if (this.grace <= 0 && !this.dyno) {
      if (i.pressedCode('KeyC')) return this.letGo(true);
      if (this.sent && !this.attempt?.route.boulder && (i.pressed('jump'))) return this.letGo(true);
      if (this.aimHold >= 0 && !this.chalking) {
        if (i.pressedCode('Mouse0') || i.pressedCode('KeyQ')) this.reach(this.lh, this.aimHold);
        if (i.pressedCode('Mouse2') || i.pressedCode('KeyE')) this.reach(this.rh, this.aimHold);
        const hand = this.sensibleHand(this.aimHold);
        if (i.pressed('jump') && this.charging < 0) {
          const r = this.reachable(this.aimHold, hand);
          if (r === 'ok' || this.stepUp(this.aimHold)) this.reach(hand, this.aimHold);
          else if (r === 'dyno') this.charging = 0; // hold to charge, release to jump
          else { this.say('Too far'); this.game.events.emit('sfx', { name: 'tick' }); }
        }
      }
      if (this.charging >= 0) {
        this.charging += dt / 0.9;
        if (!i.isDown('jump')) {
          // a quick tap isn't a committed jump
          if (this.charging < 0.15) { this.charging = -1; this.say('Hold Space, release on the marker'); }
          else this.releaseDyno();
        }
      }
      if (i.pressedCode('KeyR') && !this.chalking && this.lh.t >= 1 && this.rh.t >= 1) this.chalking = 1.1;
    }

    // ---- limbs in motion ----
    for (const l of this.limbs) {
      if (l.t >= 1) continue;
      l.t = Math.min(1, l.t + dt / l.dur);
      const s = smooth(l.t);
      l.at.lerpVectors(l.from, l.to, s).addScaledVector(this.n, Math.sin(Math.PI * s) * (l.hand ? 0.12 : 0.08));
      if (l.t >= 1) {
        if (l.hand) this.landHand(l);
        else { l.hold = l.next; l.at.copy(l.to); }
      }
    }
    if (this.pending) {
      this.pending.t -= dt;
      const { hand, hold } = this.pending;
      if (this.limbs.every((l) => l.t >= 1)) { this.pending = null; this.reach(hand, hold); }
      else if (this.pending.t <= 0) this.pending = null;
    }
    if (this.dyno) this.updateDyno(dt);
    else if (!this.pending && this.limbs.every((l) => l.t >= 1)) this.planFeet(false);

    // chalking: the hand on the worse hold dips into the bag at the hip
    if (this.chalking > 0) {
      this.chalking -= dt;
      this.chalk = Math.min(1, this.chalk + dt * 1.2);
      if (this.chalking <= 0) { this.chalking = 0; this.say('Fresh chalk'); }
    } else this.chalk = Math.max(0, this.chalk - dt / 70);

    // ---- grip / pump ----
    this.updateGrip(dt);
    if (this.grip <= 0) { this.grip = 0; return this.letGo(true); }

    // ---- body ----
    this.frameFromHands(1 - Math.exp(-dt * 6));
    const target = this.dyno ? this.hip : this.hipTarget();
    // low grip: the body shakes
    if (this.grip < 0.25) target.addScaledVector(this.right, Math.sin(g.time * 37) * (0.25 - this.grip) * 0.05);
    const k = 1 - Math.exp(-dt * (this.dyno ? 30 : 5.5));
    this.hip.lerp(target, k);
    const rootQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.right.clone().negate(), this.up, this.n.clone().negate()));
    const root = this.hip.clone().sub(this.pelvisRest.clone().applyQuaternion(rootQ));
    p.setPosition(root);
    ch.root.position.copy(root);
    ch.root.quaternion.copy(rootQ);
    p.facing = Math.atan2(-this.n.x, -this.n.z);

    this.updateHud(dt);
  }

  private updateGrip(dt: number): void {
    const hands = [this.lh, this.rh];
    const holding = hands.filter((h) => h.hold >= 0);
    const feetOn = this.limbs.filter((l) => !l.hand && (l.hold >= 0 || l.hold === -2)).length;
    const dangling = this.limbs.filter((l) => !l.hand && l.hold === -3).length;
    const overhang = Math.max(0, -this.n.y);
    let drain = 0;
    if (holding.length === 2) drain = (GRIP[this.holds[holding[0].hold].kind].drain + GRIP[this.holds[holding[1].hold].kind].drain) * 0.5;
    else if (holding.length === 1) drain = GRIP[this.holds[holding[0].hold].kind].drain * 2.2;
    else drain = 0.6;
    if (this.chalking) drain *= 1.6;
    drain *= 1 + overhang * 3;
    drain *= feetOn === 2 ? 0.7 : feetOn === 1 ? 0.95 : 1.25 + dangling * 0.2;
    drain *= 1.35 - 0.35 * this.chalk;
    const onGround = this.limbs.filter((l) => !l.hand).every((l) => l.hold === -2);
    const shakeOut = holding.length === 2 && holding.every((h) => this.holds[h.hold].kind === 'jug') && feetOn === 2 && overhang < 0.2;
    if (onGround) this.grip = Math.min(1, this.grip + dt * 0.25);
    else if (shakeOut && this.limbs.every((l) => l.t >= 1)) this.grip = Math.min(1, this.grip + dt * 0.06);
    else this.grip -= drain * dt;
  }

  private releaseDyno(): void {
    const power = this.charging;
    this.charging = -1;
    if (this.aimHold < 0) return;
    const hand = this.sensibleHand(this.aimHold);
    const c = this.contact(this.aimHold, true);
    const need = clamp((c.distanceTo(this.feetMid()) - BODY) / (DYNO - BODY), 0, 1) * 0.75 + 0.2;
    const pw = power % 2 > 1 ? 2 - (power % 2) : power % 2; // ping-pong meter
    const ok = Math.abs(pw - need) < 0.13 + this.chalk * 0.04;
    const to = this.hip.clone().addScaledVector(this.up, Math.min(0.9, c.y - this.handsMid().y));
    this.dyno = { t: 0, from: this.hip.clone(), to, hand, hold: this.aimHold, ok };
    for (const l of this.limbs) { l.from.copy(l.at); l.t = 1; }
    this.game.events.emit('sfx', { name: 'release' });
  }

  private updateDyno(dt: number): void {
    const d = this.dyno!;
    d.t = Math.min(1, d.t + dt / 0.42);
    const s = smooth(d.t);
    this.hip.lerpVectors(d.from, d.to, s).addScaledVector(this.n, Math.sin(Math.PI * s) * 0.15);
    // the jumping hand flies to the hold; the other comes off; feet cut loose
    const c = this.contact(d.hold, true);
    d.hand.at.lerpVectors(d.hand.from, c, smooth(d.t * 1.15));
    const other = d.hand === this.lh ? this.rh : this.lh;
    other.at.copy(other.from).addScaledVector(this.up, s * 0.35).addScaledVector(this.n, s * 0.1);
    for (const f of this.limbs.filter((l) => !l.hand)) f.at.lerpVectors(f.from, f.from.clone().addScaledVector(this.up, 0.35).addScaledVector(this.n, 0.25), s);
    if (d.t < 1) return;
    this.dyno = null;
    if (!d.ok) { this.say('Missed!'); this.grip = 0; return; }
    d.hand.hold = d.hold;
    d.hand.at.copy(c);
    d.hand.next = d.hold;
    this.game.events.emit('sfx', { name: 'hold' });
    this.say('Stuck it!');
    // trailing hand catches the best hold near the new position
    let best = -1;
    let bd = 0.9;
    this.holds.forEach((h, k) => {
      if (k === d.hold || h.n.dot(this.n) < 0.2) return;
      const dd = this.contact(k, true).distanceTo(c.clone().addScaledVector(this.right, other.side * 0.3).addScaledVector(this.up, -0.25));
      if (dd < bd) { bd = dd; best = k; }
    });
    for (const f of this.limbs.filter((l) => !l.hand)) { f.hold = -3; f.at.copy(f.from.clone().addScaledVector(this.up, 0.35).addScaledVector(this.n, 0.25)); }
    other.from.copy(other.at);
    if (best >= 0) { other.to.copy(this.contact(best, true)); other.next = best; other.t = 0; other.dur = 0.25; other.hold = -3; }
    else { other.next = d.hold; other.to.copy(this.contact(d.hold, true, other.side)); other.t = 0; other.dur = 0.3; other.hold = -3; }
    const a = this.attempt;
    if (a) { a.moves++; if (!a.route.hands.includes(d.hold) && a.clean) { a.clean = false; this.say('Off route — this one won\'t count'); } }
  }

  private updateHud(dt: number): void {
    const a = this.attempt;
    const route = this.hud.querySelector('.cl-route') as HTMLElement;
    route.innerHTML = a
      ? `<i style="background:#${a.route.color.toString(16).padStart(6, '0')}"></i>V${a.route.grade} · ${a.route.colour}<span>${fmtTime(a.t)} · ${a.moves} moves${a.clean ? '' : ' · off route'}</span>`
      : 'Free climbing<span>start a problem at its coloured tape</span>';
    const grip = this.hud.querySelector('.cl-grip') as HTMLElement;
    (grip.firstElementChild as HTMLElement).style.transform = `scaleX(${this.grip})`;
    grip.classList.toggle('low', this.grip < 0.25);
    const dy = this.hud.querySelector('.cl-dyno') as HTMLElement;
    dy.classList.toggle('on', this.charging >= 0);
    if (this.charging >= 0 && this.aimHold >= 0) {
      const pw = this.charging % 2 > 1 ? 2 - (this.charging % 2) : this.charging % 2;
      (dy.firstElementChild as HTMLElement).style.width = `${pw * 100}%`;
      const c = this.contact(this.aimHold, true);
      const need = clamp((c.distanceTo(this.feetMid()) - BODY) / (DYNO - BODY), 0, 1) * 0.75 + 0.2;
      (dy.lastElementChild as HTMLElement).style.left = `calc(${need * 100}% - 2px)`;
    }
    this.noteT -= dt;
    const kindNote = this.aimHold >= 0 ? `${GRIP[this.holds[this.aimHold].kind].label}${this.holds[this.aimHold].route < 0 ? ' (spare)' : ''}` : '';
    (this.hud.querySelector('.cl-note') as HTMLElement).textContent = this.noteT > 0 ? this.note : kindNote;

    // hold marker
    if (this.aimHold >= 0) {
      const h = this.holds[this.aimHold];
      const r = this.reachable(this.aimHold, this.sensibleHand(this.aimHold));
      this.markerMat.color.set(r === 'ok' ? 0xffffff : r === 'dyno' ? 0xffc23a : 0xff5a4a);
      this.marker.position.copy(h.p).addScaledVector(h.n, 0.04);
      this.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.n);
      this.marker.scale.setScalar(Math.max(0.8, h.size / 0.1) * (1 + Math.sin(this.game.time * 6) * 0.06));
      this.marker.visible = true;
    } else this.marker.visible = false;
  }

  // ------------------------------------------------------------------ camera

  private camera(dt: number, cam: THREE.PerspectiveCamera): void {
    if (!this.active) return;
    // stand off the wall along its normal, a little above, framing you and your aim
    const focus = this.hip.clone().add(new THREE.Vector3(0, 0.35, 0)).lerp(this.aim, 0.3);
    const lat = this.aim.clone().sub(this.hip).dot(this.right);
    const out = this.n.clone().setY(this.n.y * 0.5).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), clamp(-lat * 0.12, -0.35, 0.35));
    this.zoom = clamp(this.zoom + this.game.input.wheel * 0.25, 2.2, 5.5);
    let dist = this.zoom;
    const hit = this.game.physics.sphereCast(focus, out, 0.25, dist, { ignore: ['player', 'pet', 'ball', 'npc'], filter: (t) => !t.cameraIgnore });
    if (hit !== null) dist = Math.max(1.0, hit - 0.1);
    const want = focus.clone().addScaledVector(out, dist).add(new THREE.Vector3(0, 0.35, 0));
    want.y = Math.max(want.y, this.groundY(want) + 0.5);
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(want, k);
    this.camLook.lerp(focus, 1 - Math.exp(-dt * 7));
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    cam.fov = damp(cam.fov, 58, 4, dt);
  }

  // ------------------------------------------------------------------ pose (after the animation mixer)

  applyIK(): void {
    if (!this.active || this.topping > 0 || !this.ch) return;
    const ch = this.ch;
    ch.root.updateMatrixWorld(true);
    const b = ch.bones;
    for (const l of this.limbs) {
      if (!l.ik) continue;
      let target = l.at;
      // chalking: the free hand goes to the bag at the small of the back
      const chalkHand = this.chalking > 0 && l.hand && l === (GRIP[this.holds[Math.max(0, this.lh.hold)]?.kind ?? 'jug'].drain >= GRIP[this.holds[Math.max(0, this.rh.hold)]?.kind ?? 'jug'].drain ? this.lh : this.rh);
      if (chalkHand) {
        const bag = this.hip.clone().addScaledVector(this.n, 0.18).addScaledVector(this.right, l.side * 0.1).addScaledVector(this.up, -0.05);
        const w = Math.sin(clamp(1 - this.chalking / 1.1, 0, 1) * Math.PI);
        target = l.at.clone().lerp(bag, w);
      }
      const pole = l.hand
        ? this.hip.clone().addScaledVector(this.right, l.side * 0.7).addScaledVector(this.up, -0.4).addScaledVector(this.n, 0.35)
        : this.hip.clone().addScaledVector(this.right, l.side * 0.65).addScaledVector(this.n, 0.55).addScaledVector(this.up, 0.15);
      l.ik.solve(target, pole);
    }
    // hands: palms to the wall, fingers up, curled to the hold
    for (const l of [this.lh, this.rh]) {
      const hand = this.hands[l === this.lh ? 'l' : 'r'];
      if (!hand?.ok) continue;
      const kind = l.hold >= 0 ? this.holds[l.hold].kind : null;
      const hn = l.hold >= 0 ? this.holds[l.hold].n : this.n;
      const fingers = this.up.clone().addScaledVector(hn, -0.35).addScaledVector(this.right, -l.side * 0.15).normalize();
      hand.orient(fingers, hn.clone().negate());
      const g = kind ? GRIP[kind] : { curl: 0.3, thumb: 0.2 };
      hand.curl(l.t < 1 ? 0.15 : g.curl, l.t < 1 ? 0.1 : g.thumb);
    }
    // feet: toes into the wall
    for (const [l, foot, ball] of [[this.limb('lf'), 'foot_l', 'ball_l'], [this.limb('rf'), 'foot_r', 'ball_r']] as const) {
      const fb = b.get(foot), bb = b.get(ball);
      if (!fb || !bb || l.hold === -2) continue;
      const toe = this.n.clone().negate().addScaledVector(this.up, -0.35).normalize();
      swingBone(fb, worldPos(bb).sub(worldPos(fb)), toe, 0.85);
    }
    // head: look where you're aiming
    const head = b.get('Head');
    if (head) {
      const hp = worldPos(head);
      const toAim = this.aim.clone().sub(hp).normalize();
      const face = this.n.clone().negate();
      const q = new THREE.Quaternion().setFromUnitVectors(face, toAim);
      q.slerp(new THREE.Quaternion(), 0.45);
      setBoneWorldQuat(head, q.multiply(head.getWorldQuaternion(new THREE.Quaternion())));
    }
  }
}
