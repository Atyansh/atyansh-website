// The pets: BaoBao (shy gray tabby), HuHu (lazy ginger tabby), Chance
// (attention-loving Chorkie). Personalities come from the site's pet pages.
//
//  BaoBao — flees from running or looming players; approach walking or
//           crouched and she'll warm up until you can pet her.
//  HuHu   — naps on the sunny blanket; wake him, then pet him. Wanders to
//           the fountain for a drink now and then.
//  Chance — trots over to greet you, follows you round the park, rolls
//           over for belly rubs, and plays fetch with a real physics ball.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Game } from '../Game';
import type { ParkPOI } from '../../world/Park';
import { PetRig, type PetSpec, type Pose } from './PetRig';
import { SPECS } from './specs';
import { LimbIK } from '../IK';
import { PARK, CURB_H } from '../../world/layout';
import { clamp, dampAngle, rng } from '../../engine/math';

// ---------- brains ----------

type Mood = 'idle' | 'wander' | 'sleep' | 'flee' | 'hide' | 'approach' | 'follow' | 'petted' | 'chase' | 'return' | 'sit' | 'drink' | 'wake';

class Pet {
  readonly rig: PetRig;
  readonly id: string;
  pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  mood: Mood = 'idle';
  timer = 0;
  target = new THREE.Vector3();
  trust = 0;
  awake = true;
  carrying = false;
  label: HTMLDivElement;
  constructor(id: string, spec: PetSpec, start: THREE.Vector3) {
    this.id = id;
    this.rig = new PetRig(spec);
    this.pos.copy(start);
    this.label = document.createElement('div');
    this.label.className = 'pet-tag';
  }
  setPose(p: Pose): void { this.rig.setPose(p); }
}

const TAG_CSS = `
.pet-tag { position: fixed; transform: translate(-50%, -100%); pointer-events: none; text-align: center; opacity: 0; transition: opacity .3s;
  font-family: var(--ui-font); color: #fff; text-shadow: 0 1px 8px rgba(0,0,0,.8); z-index: 9; }
.pet-tag.on { opacity: 1; }
.pet-tag b { display: block; font: 800 18px var(--ui-display); letter-spacing: .06em; }
.pet-tag span { font-size: 12px; color: rgba(255,255,255,.75); }
.pet-tag i { display: block; font-style: normal; font-size: 11px; color: #ffb547; margin-top: 2px; }
`;

export class Pets {
  readonly list: Pet[] = [];
  private poi: ParkPOI;
  private ball: { mesh: THREE.Mesh; body: RAPIER.RigidBody | null; held: boolean; collider: RAPIER.Collider | null };
  private hearts: Array<{ s: THREE.Sprite; v: THREE.Vector3; life: number }> = [];
  private heartTex: THREE.Texture;
  private r = rng(55);
  private throwPending = 0;
  /** Harness: freeze AI (rigs keep animating) */
  frozen = false;
  lookOverride: THREE.Vector3 | null = null;
  private group = new THREE.Group();

  constructor(private game: Game, poi: ParkPOI) {
    this.poi = poi;
    const st = document.createElement('style');
    st.textContent = TAG_CSS;
    document.head.appendChild(st);
    const add = (id: string, at: THREE.Vector3) => {
      const p = new Pet(id, SPECS[id], at);
      this.list.push(p);
      this.group.add(p.rig.root);
      game.ui.root.appendChild(p.label);
    };
    add('baobao', poi.hideSpot.clone().add(new THREE.Vector3(1.6, 0, -1.0)));
    add('huhu', poi.sunSpot.clone());
    add('chance', poi.lawn.clone());
    const huhu = this.get('huhu');
    huhu.mood = 'sleep';
    huhu.awake = false;
    // place in the street level's group so they hide with it
    game.levels.get('street')!.group.add(this.group);

    // ball
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8f03a, roughness: 0.6 }));
    ballMesh.castShadow = true;
    ballMesh.position.copy(poi.ballSpawn);
    this.group.add(ballMesh);
    this.ball = { mesh: ballMesh, body: null, held: false, collider: null };
    this.spawnBall(poi.ballSpawn);

    // heart sprite
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ff5a8a';
    g.font = '52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('♥', 32, 36);
    this.heartTex = new THREE.CanvasTexture(c);

    this.registerInteractions();
  }

  get(id: string): Pet { return this.list.find((p) => p.id === id)!; }

  private spawnBall(at: THREE.Vector3, vel?: THREE.Vector3): void {
    const { physics } = this.game;
    if (this.ball.collider) physics.remove(this.ball.collider);
    if (this.ball.body) physics.world.removeRigidBody(this.ball.body);
    const b = physics.dynamicBall(at.x, at.y, at.z, 0.035, { kind: 'ball', cameraIgnore: true });
    if (vel) b.body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
    this.ball.body = b.body;
    this.ball.collider = b.collider;
    this.ball.held = false;
  }

  private despawnBall(): void {
    const { physics } = this.game;
    if (this.ball.collider) physics.remove(this.ball.collider);
    if (this.ball.body) physics.world.removeRigidBody(this.ball.body);
    this.ball.body = null;
    this.ball.collider = null;
  }

  private heartsAt(p: THREE.Vector3, n = 5): void {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.16);
      s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3));
      this.group.add(s);
      this.hearts.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3), life: 1.6 + Math.random() * 0.6 });
    }
  }

  /**
   * Kneel beside the pet and actually pet it: the right arm is IK-driven so
   * the hand strokes along the pet's back (head → hips) — or rubs Chance's
   * belly when he rolls over. The pet settles, half-closes its eyes and
   * leans into the hand.
   */
  private pet(p: Pet, onDone: () => void, belly = false): void {
    const g = this.game;
    const ch = g.player.character;
    const fwdPet = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    // kneel at the pet's side, whichever side the player is on
    const toPlayer = g.player.position.clone().sub(p.pos).setY(0);
    const sideV = new THREE.Vector3(fwdPet.z, 0, -fwdPet.x);
    const side = Math.sign(toPlayer.dot(sideV)) || 1;
    const spot = p.pos.clone().addScaledVector(sideV, side * 0.5).addScaledVector(fwdPet, 0.05);
    spot.y = g.player.position.y;
    const face = Math.atan2(p.pos.x - spot.x, p.pos.z - spot.z);
    g.player.setPosition(spot);
    g.player.facing = face;
    ch.root.position.copy(spot);
    ch.root.rotation.y = face;
    p.mood = 'petted';
    p.timer = 99;
    p.speed = 0;
    p.setPose(belly ? 'belly' : p.rig.spec.kind === 'cat' ? 'loaf' : 'sit');
    ch.play('Kneel', { fade: 0.35, from: 0.18, to: 0.5, timeScale: 0.8, hold: true });
    g.events.emit('sfx', { name: p.rig.spec.kind === 'cat' ? 'purr' : 'happy' });
    const b = ch.bones;
    const arm = b.get('upperarm_r') && b.get('lowerarm_r') && b.get('hand_r') ? new LimbIK(b.get('upperarm_r')!, b.get('lowerarm_r')!, b.get('hand_r')!) : null;
    let t = 0;
    const R = p.rig.bones;
    const back = (u: number) => {
      // u: 0 = behind the head, 1 = hips; slightly above the fur
      const a = R.neck.getWorldPosition(new THREE.Vector3());
      const c = R.hips.getWorldPosition(new THREE.Vector3());
      const pt = a.lerp(c, u);
      pt.y += belly ? 0.02 : p.rig.spec.rChest * 0.9 + p.rig.spec.fur * 0.6;
      return pt;
    };
    g.beginActivity({
      name: 'pet',
      // camera on the far side of the pet, looking back at you and your hand
      shot: { position: p.pos.clone().addScaledVector(sideV, -side * 1.3).addScaledVector(fwdPet, 0.7).add(new THREE.Vector3(0, 0.75, 0)), target: p.pos.clone().addScaledVector(sideV, side * 0.25).add(new THREE.Vector3(0, 0.35, 0)), fov: 50, blend: 0.7, orbit: { yaw: 2.4, pitch: 0.6 } },
      hint: 'E  Stop · Mouse  Look around',
      back: () => { g.endActivity(); onDone(); },
      update: (dt) => {
        t += dt;
        // stroke cycle: slow along the back, quick lift back to the start
        const cyc = (t * (belly ? 0.9 : 0.55)) % 1;
        const u = belly ? 0.35 + Math.sin(t * 5.5) * 0.12 : cyc < 0.8 ? cyc / 0.8 : 1 - (cyc - 0.8) / 0.2;
        const lift = belly ? 0.0 : cyc < 0.8 ? 0 : Math.sin(((cyc - 0.8) / 0.2) * Math.PI) * 0.06;
        const target = back(belly ? u : 0.1 + u * 0.75).add(new THREE.Vector3(0, lift, 0));
        if (arm && t > 0.5) {
          const pole = g.player.position.clone().add(new THREE.Vector3(0, 0.7, 0)).addScaledVector(sideV, side * 0.6);
          ch.root.updateMatrixWorld(true);
          arm.solve(target, pole);
        }
        p.rig.content = Math.min(1, p.rig.content + dt * 1.5);
        // gaze up at the person petting (never at the hand on its back)
        p.rig.lookTarget = (b.get('Head') ?? ch.root).getWorldPosition(new THREE.Vector3());
        p.rig.wag = p.rig.spec.kind === 'dog' ? 1 : 0.15;
        if (Math.floor(t * 1.3) !== Math.floor((t - dt) * 1.3)) this.heartsAt(p.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 1);
        if (t > 4.2 || (t > 0.8 && g.input.pressed('interact'))) {
          g.endActivity();
          onDone();
        }
      },
      end: () => {
        ch.stopOverride(0.45);
        p.rig.content = 0;
        p.mood = 'idle';
        p.timer = 3;
        if (belly) p.setPose('stand');
      },
    });
  }

  private registerInteractions(): void {
    const g = this.game;
    const city = g.levels.get('street')!;
    const pp = (p: Pet) => () => p.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    const bao = this.get('baobao');
    const huhu = this.get('huhu');
    const chance = this.get('chance');
    city.interactables.push(
      {
        id: 'pet:baobao', position: pp(bao), radius: 1.5, verb: () => (bao.trust >= 1 ? 'Pet' : 'Approach slowly…'), label: 'BaoBao',
        enabled: () => bao.mood !== 'flee' && bao.mood !== 'hide',
        onInteract: () => {
          if (bao.trust < 1) { g.ui.toast('BaoBao is shy', 'Walk (Alt) or crouch (C) near her and give her a moment.', '🐾'); return; }
          this.pet(bao, () => {
            if (g.save.setFlag('pet:baobao')) g.ui.toast('BaoBao trusts you', 'Gentle and shy — and now your friend.', '🐱', 'goal');
            g.events.emit('progress', { key: 'pet:baobao' });
          });
        },
      },
      {
        id: 'pet:huhu', position: pp(huhu), radius: 1.5, verb: () => (huhu.awake ? 'Pet' : 'Wake'), label: 'HuHu',
        onInteract: () => {
          if (!huhu.awake) {
            huhu.awake = true;
            huhu.mood = 'wake';
            huhu.timer = 2.4;
            huhu.setPose('stretch');
            g.events.emit('sfx', { name: 'meow' });
            g.ui.toast('HuHu wakes up', 'A big stretch. He looks expectant.', '🐈');
            return;
          }
          this.pet(huhu, () => {
            if (g.save.setFlag('pet:huhu')) g.ui.toast('HuHu is purring', 'Chonky, sun-warm and happy.', '🧡', 'goal');
            g.events.emit('progress', { key: 'pet:huhu' });
          });
        },
      },
      {
        id: 'pet:chance', position: pp(chance), radius: 1.5, verb: 'Belly rub', label: 'Chance',
        enabled: () => !chance.carrying && chance.mood !== 'chase',
        onInteract: () => {
          this.pet(chance, () => {
            g.events.emit('progress', { key: 'pet:chance' });
          }, true);
        },
      },
      {
        id: 'ball', position: () => this.ball.mesh.position.clone(), radius: 1.3, verb: 'Pick up', label: 'the tennis ball',
        enabled: () => !this.ball.held && !chance.carrying && this.ball.body !== null,
        onInteract: () => this.pickUpBall(),
      },
    );
  }

  /** Bend down, close the hand round the ball, straighten up holding it */
  private pickUpBall(): void {
    const g = this.game;
    const ch = g.player.character;
    const bp = this.ball.mesh.position.clone();
    // stand so the right hand comes down onto the ball
    const to = bp.clone().sub(g.player.position).setY(0);
    const face = Math.atan2(to.x, to.z);
    const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const spot = bp.clone().addScaledVector(fwd, -0.42).addScaledVector(right, 0.14);
    spot.y = g.player.position.y;
    if (to.length() < 1.2) g.player.setPosition(spot);
    g.player.facing = face;
    ch.root.rotation.y = face;
    ch.play('PickUp', { fade: 0.15, timeScale: 0.85 });
    let t = 0;
    g.beginActivity({
      name: 'pickup',
      freeCamera: true,
      update: (dt) => {
        t += dt;
        if (!this.ball.held) {
          const hand = this.palm(ch);
          if (t > 0.42 || (hand && hand.distanceTo(this.ball.mesh.position) < 0.12)) {
            this.despawnBall();
            this.ball.held = true;
            g.events.emit('sfx', { name: 'pickup' });
          }
        }
        if (t > 0.95) g.endActivity();
      },
      end: () => {
        ch.stopOverride(0.25);
        if (!this.ball.held) { this.despawnBall(); this.ball.held = true; }
        g.ui.setActivityHint('F / Click  Throw');
      },
    });
  }

  /** Where a held ball sits: cupped between thumb and fingers */
  private palm(ch: { bones: Map<string, THREE.Object3D> }): THREE.Vector3 | null {
    const b = ch.bones;
    const mid = b.get('middle_02_r'), thumb = b.get('thumb_03_r'), hand = b.get('hand_r');
    if (mid && thumb) return mid.getWorldPosition(new THREE.Vector3()).lerp(thumb.getWorldPosition(new THREE.Vector3()), 0.45);
    return hand ? hand.getWorldPosition(new THREE.Vector3()) : null;
  }

  /** Throw the held ball along the camera's view */
  private throwBall(): void {
    const g = this.game;
    const ch = g.player.character;
    ch.play('Throw', { fade: 0.1, timeScale: 1.4 });
    this.throwPending = 0.42;
    g.ui.setActivityHint(null);
  }

  private release(): void {
    const g = this.game;
    const cam = g.renderer.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = Math.max(dir.y, 0) + 0.35;
    dir.normalize();
    const hand = this.palm(g.player.character) ?? g.player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.spawnBall(hand.add(dir.clone().multiplyScalar(0.3)), dir.multiplyScalar(14));
    g.events.emit('sfx', { name: 'throw' });
    const chance = this.get('chance');
    chance.mood = 'chase';
    chance.rig.wag = 1;
  }

  // ---------- per-frame ----------

  update(dt: number): void {
    const g = this.game;
    const onStreet = g.level?.id === 'street';
    if (!onStreet) {
      for (const p of this.list) p.label.classList.remove('on');
      return;
    }
    const player = g.player;
    const ppos = player.position;
    const playerInPark = ppos.x > PARK.minX - 1 && ppos.x < PARK.maxX + 1 && ppos.z > PARK.minZ - 1 && ppos.z < PARK.maxZ + 1;

    // ball
    if (this.ball.held) {
      const hand = this.palm(player.character);
      if (hand) this.ball.mesh.position.copy(hand);
      if (this.throwPending <= 0 && g.state === 'playing' && !g.activity && g.input.pressed('throw')) this.throwBall();
    } else if (this.ball.body) {
      const t = this.ball.body.translation();
      this.ball.mesh.position.set(t.x, t.y, t.z);
      const rot = this.ball.body.rotation();
      this.ball.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      // keep it findable: if it leaves the park, roll it back in
      if (t.y < -5 || t.x < PARK.minX - 12 || t.x > PARK.maxX + 25 || t.z < PARK.minZ - 25 || t.z > PARK.maxZ + 12) this.spawnBall(this.poi.ballSpawn);
    }
    if (this.throwPending > 0) {
      this.throwPending -= dt;
      if (this.throwPending <= 0) this.release();
    }

    const camPos = g.renderer.camera.position;
    for (const p of this.list) {
      p.rig.root.visible = p.pos.distanceTo(camPos) < 50;
      if (!this.frozen) {
        this.think(p, dt, ppos, playerInPark);
        this.move(p, dt);
      }
      p.rig.root.position.copy(p.pos);
      p.rig.root.rotation.y = p.heading;
      p.rig.speed = p.speed;
      if (p.mood !== 'petted') p.rig.lookTarget = this.lookOverride ?? (p.mood === 'sleep' ? null : ppos.clone().add(new THREE.Vector3(0, 1.5, 0)));
      p.rig.update(dt);
      this.label(p, ppos);
    }

    // hearts
    for (const h of this.hearts) {
      h.life -= dt;
      h.s.position.addScaledVector(h.v, dt);
      (h.s.material as THREE.SpriteMaterial).opacity = clamp(h.life, 0, 1);
    }
    this.hearts = this.hearts.filter((h) => {
      if (h.life > 0) return true;
      this.group.remove(h.s);
      return false;
    });
  }

  private label(p: Pet, ppos: THREE.Vector3): void {
    const d = p.pos.distanceTo(ppos);
    const cam = this.game.renderer.camera;
    const sp = p.pos.clone().add(new THREE.Vector3(0, 0.62, 0)).project(cam);
    const visible = d < 7 && sp.z < 1 && Math.abs(sp.x) < 1.1 && Math.abs(sp.y) < 1.1 && !this.game.activity;
    p.label.classList.toggle('on', visible);
    if (!visible) return;
    p.label.style.left = `${(sp.x * 0.5 + 0.5) * window.innerWidth}px`;
    p.label.style.top = `${(-sp.y * 0.5 + 0.5) * window.innerHeight}px`;
    const data = this.game.data.pets?.find((x) => x.name === p.rig.spec.name);
    const age = data?.birthday ? `${new Date().getFullYear() - Number(data.birthday.slice(0, 4))} yrs` : '';
    const status = p.id === 'baobao' ? (p.trust >= 1 ? 'trusts you' : p.mood === 'hide' || p.mood === 'flee' ? 'hiding…' : `shy · ${Math.round(p.trust * 100)}%`)
      : p.id === 'huhu' ? (p.awake ? 'awake' : 'zzz…') : p.carrying ? 'bring it back!' : 'wants to play';
    p.label.innerHTML = `<b>${p.rig.spec.name}</b><span>${data?.breed ?? ''}${age ? ` · ${age}` : ''}</span><i>${status}</i>`;
  }

  private pickWander(p: Pet): void {
    const w = this.poi.wander;
    p.target.copy(w[Math.floor(this.r() * w.length)]);
    p.mood = 'wander';
  }

  private think(p: Pet, dt: number, ppos: THREE.Vector3, playerInPark: boolean): void {
    p.timer -= dt;
    const toPlayer = ppos.clone().sub(p.pos).setY(0);
    const dp = toPlayer.length();
    const player = this.game.player;
    if (p.mood === 'petted') {
      p.speed = 0;
      p.rig.wag = 0.8;
      if (p.timer <= 0) { p.mood = 'idle'; p.timer = 2; if (p.id !== 'chance') p.setPose('sit'); }
      return;
    }
    if (p.id === 'baobao') {
      // Trust is earned slowly and lost fast — even once she's your friend.
      // Sprinting nearby, running up close or landing a jump next to her all
      // spook her; a big scare sends her into hiding.
      const close = dp < 3.0;
      const gentle = (player.crouching || player.speed < 2.2) && close;
      const sprinting = player.speed > 5.2 && dp < 8;
      const rushing = player.speed > 2.5 && dp < 4.5;
      const stomping = !player.grounded && dp < 3.5;
      const before = p.trust;
      if (sprinting) p.trust -= dt * 1.6;
      else if (rushing || stomping) p.trust -= dt * 0.9;
      else if (close && !gentle && player.speed > 0.5) p.trust -= dt * 0.4;
      p.trust = Math.max(0, p.trust);
      const spooked = (sprinting || rushing || stomping) && p.mood !== 'flee' && p.mood !== 'hide';
      if (spooked && (p.trust < 0.75 || sprinting)) {
        p.mood = 'flee';
        p.target.copy(this.poi.hideSpot);
        p.trust = Math.max(0, p.trust - 0.25);
        this.game.events.emit('sfx', { name: 'hiss' });
        if (before >= 1) this.game.ui.toast('BaoBao got spooked', 'She\'s gone to hide. Win her back slowly.', '🐾', 'info');
      }
      if (gentle && p.mood !== 'flee') p.trust = Math.min(1, p.trust + dt * (player.crouching ? 0.33 : 0.18));
      if (p.mood === 'flee') {
        p.setPose('stand');
        if (p.pos.distanceTo(p.target) < 0.5) { p.mood = 'hide'; p.timer = 8; p.setPose('loaf'); }
        return;
      }
      if (p.mood === 'hide') {
        p.speed = 0;
        if (p.timer <= 0 && dp > 4) this.pickWander(p);
        return;
      }
      if (p.trust >= 1 && dp < 4 && dp > 0.9) { p.mood = 'approach'; p.target.copy(ppos); p.setPose('stand'); return; }
      if (p.trust >= 1 && dp <= 0.9) { p.mood = 'sit'; p.setPose('sit'); p.rig.wag = 0.2; return; }
      this.idleCycle(p, ['sit', 'loaf', 'stand'], 5, 9);
      return;
    }
    if (p.id === 'huhu') {
      if (!p.awake) { p.mood = 'sleep'; p.setPose('sleep'); p.speed = 0; return; }
      if (p.mood === 'wake') {
        if (p.timer <= 0) { p.mood = 'sit'; p.setPose('sit'); p.timer = 8; }
        return;
      }
      // wanders to the fountain for a drink, then back to the blanket and naps again
      if (p.mood === 'sit' && p.timer <= 0) {
        p.mood = 'drink';
        p.target.copy(this.poi.fountain).add(new THREE.Vector3(2.6, 0, 0.4));
        p.setPose('stand');
      }
      if (p.mood === 'drink' && p.pos.distanceTo(p.target) < 0.4) {
        p.mood = 'wander';
        p.target.copy(this.poi.sunSpot);
      }
      if (p.mood === 'wander' && p.pos.distanceTo(this.poi.sunSpot) < 0.4) {
        p.awake = false;
        p.mood = 'sleep';
      }
      return;
    }
    // chance
    if (p.mood === 'chase') {
      p.setPose('stand');
      const bp = this.ball.mesh.position;
      p.target.copy(bp);
      const bodyV = this.ball.body?.linvel();
      const still = !bodyV || Math.hypot(bodyV.x, bodyV.y, bodyV.z) < 1.5;
      if (p.pos.distanceTo(new THREE.Vector3(bp.x, p.pos.y, bp.z)) < 0.35 && still && this.ball.body) {
        this.despawnBall();
        p.carrying = true;
        p.mood = 'return';
        this.game.events.emit('sfx', { name: 'bark' });
      }
      return;
    }
    if (p.carrying) {
      const mouth = p.rig.bones.head.getWorldPosition(new THREE.Vector3());
      this.ball.mesh.position.copy(mouth).add(new THREE.Vector3(Math.sin(p.heading) * 0.12, -0.06, Math.cos(p.heading) * 0.12));
      p.target.copy(ppos);
      if (dp < 1.0) {
        p.carrying = false;
        this.spawnBall(p.pos.clone().add(new THREE.Vector3(Math.sin(p.heading) * 0.35, 0.15, Math.cos(p.heading) * 0.35)));
        p.mood = 'sit';
        p.setPose('sit');
        p.rig.wag = 1;
        const n = this.game.save.bump('fetch');
        this.game.events.emit('progress', { key: 'fetch' });
        if (n === 3 && this.game.save.setFlag('pet:chance')) this.game.ui.toast('Good boy, Chance!', 'Three fetches. He could do this all day.', '🐶', 'goal');
        else this.game.ui.toast(`Fetch ×${n}`, 'Chance drops the ball at your feet.', '🎾', 'info');
      }
      return;
    }
    if (playerInPark) {
      p.rig.wag = 0.7;
      if (dp > 2.2) { p.mood = 'follow'; p.target.copy(ppos).addScaledVector(toPlayer.normalize(), -1.4); p.setPose('stand'); }
      else if (p.mood === 'follow') { p.mood = 'sit'; p.setPose('sit'); }
      return;
    }
    p.rig.wag = 0.2;
    if (p.mood === 'follow' || p.mood === 'sit') { p.target.copy(this.poi.gates[0]).add(new THREE.Vector3(-1.5, 0, 1.5)); p.mood = 'wander'; }
    this.idleCycle(p, ['sit', 'stand', 'loaf'], 4, 8);
  }

  private idleCycle(p: Pet, poses: Pose[], min: number, max: number): void {
    if (p.mood === 'wander') {
      p.setPose('stand');
      if (p.pos.distanceTo(p.target) < 0.4) { p.mood = 'idle'; p.timer = min + this.r() * (max - min); p.setPose(poses[Math.floor(this.r() * poses.length)]); }
      return;
    }
    if (p.timer <= 0) this.pickWander(p);
  }

  private move(p: Pet, dt: number): void {
    const moving = ['wander', 'flee', 'approach', 'follow', 'chase', 'return', 'drink'].includes(p.mood) || (p.mood === 'wander');
    const to = p.target.clone().sub(p.pos).setY(0);
    const dist = to.length();
    let want = 0;
    if (moving && dist > 0.25) {
      want = p.mood === 'flee' || p.mood === 'chase' ? 3.6 : p.mood === 'return' || p.mood === 'follow' ? 2.4 : p.mood === 'approach' ? 0.8 : 0.6;
      if (p.id === 'huhu') want *= 0.7;
      if (dist < 1.0) want *= dist;
      const ang = Math.atan2(to.x, to.z);
      // avoid obstacles: probe ahead and steer around
      const ahead = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
      const hit = this.game.physics.raycast(p.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), ahead, 0.7, { ignore: ['pet', 'ball', 'player', 'npc'] });
      const avoid = hit ? 1.4 : 0;
      p.heading = dampAngle(p.heading, ang + avoid, 6, dt);
    }
    p.speed = THREE.MathUtils.damp(p.speed, want, 6, dt);
    p.pos.x += Math.sin(p.heading) * p.speed * dt;
    p.pos.z += Math.cos(p.heading) * p.speed * dt;
    // stay in the park, outside the fountain
    p.pos.x = clamp(p.pos.x, PARK.minX + 0.8, PARK.maxX - 0.8);
    p.pos.z = clamp(p.pos.z, PARK.minZ + 0.8, PARK.maxZ - 0.8);
    const f = this.poi.fountain;
    const fd = Math.hypot(p.pos.x - f.x, p.pos.z - f.z);
    if (fd < 2.7) {
      p.pos.x = f.x + ((p.pos.x - f.x) / fd) * 2.7;
      p.pos.z = f.z + ((p.pos.z - f.z) / fd) * 2.7;
    }
    p.pos.y = CURB_H + 0.01;
  }
}
