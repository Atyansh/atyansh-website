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
import { PARK, CURB_H } from '../../world/layout';
import { clamp, dampAngle, rng } from '../../engine/math';

// ---------- coats ----------

function noise(g: CanvasRenderingContext2D, n: number, dark: number, size: number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${dark})` : `rgba(255,255,255,${dark * 0.6})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
}
const X = (u: number, size: number) => u * size;
const Y = (v: number, size: number) => (1 - v) * size;

function tabby(base: string, stripe: string, belly: string, tip: string, stripeW: number, count: number) {
  return (g: CanvasRenderingContext2D, S: number) => {
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // belly band (v≈0.25 underside)
    const grad = g.createLinearGradient(0, Y(0.42, S), 0, Y(0.08, S));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.35, belly);
    grad.addColorStop(0.65, belly);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, Y(0.42, S), X(0.66, S), Y(0.08, S) - Y(0.42, S));
    // mackerel stripes: from the spine (v=0.75) down both flanks
    g.strokeStyle = stripe;
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const u = 0.03 + (i / count) * 0.55;
      g.lineWidth = stripeW * (0.7 + Math.random() * 0.6);
      for (const [v0, v1] of [[0.75, 0.42], [0.75, 1.08]] as Array<[number, number]>) {
        g.beginPath();
        let x = X(u, S);
        g.moveTo(x, Y(v0, S));
        for (let k = 1; k <= 6; k++) {
          const v = v0 + ((v1 - v0) * k) / 6;
          x += (Math.random() - 0.5) * 8;
          g.lineTo(x, Y(v > 1 ? v - 1 : v, S));
        }
        g.stroke();
      }
    }
    // spine line
    g.fillStyle = stripe;
    g.fillRect(0, Y(0.77, S), X(0.6, S), 10);
    // tail rings + dark tip
    for (let u = 0.61; u < 0.75; u += 0.02) g.fillRect(X(u, S), 0, X(0.009, S), S);
    g.fillStyle = tip;
    g.fillRect(X(0.725, S), 0, X(0.025, S), S);
    // leg rings
    g.fillStyle = stripe;
    for (let u = 0.76; u < 0.9; u += 0.018) g.fillRect(X(u, S), 0, X(0.006, S), S);
    // head: forehead "M" + cheek lines (head region u 0.9..1, top v)
    g.strokeStyle = stripe;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(X(0.92, S), Y(0.8, S)); g.lineTo(X(0.94, S), Y(0.9, S)); g.lineTo(X(0.95, S), Y(0.82, S)); g.lineTo(X(0.96, S), Y(0.9, S)); g.lineTo(X(0.98, S), Y(0.8, S));
    g.stroke();
    // muzzle/chin light
    g.fillStyle = belly;
    g.fillRect(X(0.9, S), Y(0.35, S), X(0.1, S), Y(0.05, S) - Y(0.35, S));
    noise(g, 9000, 0.08, S);
  };
}

function yorkie(g: CanvasRenderingContext2D, S: number): void {
  g.fillStyle = '#b07a45';
  g.fillRect(0, 0, S, S);
  // dark saddle over the back + flanks
  const grad = g.createLinearGradient(0, Y(1.0, S), 0, Y(0.45, S));
  grad.addColorStop(0, '#231d1a');
  grad.addColorStop(0.75, '#2c2420');
  grad.addColorStop(1, 'rgba(44,36,32,0)');
  g.fillStyle = grad;
  g.fillRect(0, Y(1.0, S), X(0.75, S), Y(0.45, S) - Y(1.0, S));
  g.fillStyle = '#2a221e';
  g.fillRect(0, Y(0.62, S), X(0.75, S), Y(0.48, S) - Y(0.62, S));
  // head: tan with darker crown, lighter muzzle
  g.fillStyle = '#8a5c34';
  g.fillRect(X(0.9, S), 0, X(0.1, S), Y(0.75, S));
  g.fillStyle = '#d8b48a';
  g.fillRect(X(0.9, S), Y(0.4, S), X(0.1, S), Y(0.05, S) - Y(0.4, S));
  // ears darker tips
  g.fillStyle = '#4a3020';
  g.fillRect(X(0.92, S), Y(0.92, S), X(0.06, S), Y(0.8, S) - Y(0.92, S));
  // scruff streaks
  for (let i = 0; i < 1600; i++) {
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(20,14,10,0.25)' : 'rgba(220,180,130,0.22)';
    g.lineWidth = 1.5;
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y + 10 + Math.random() * 10); g.stroke();
  }
  noise(g, 6000, 0.06, S);
}

const SPECS: Record<string, PetSpec> = {
  baobao: {
    name: 'BaoBao', seed: 1, kind: 'cat', len: 0.36, rHip: 0.085, rBelly: 0.095, rChest: 0.09, legLen: 0.2, legR: 0.026,
    head: 0.068, muzzle: 0.75, tailLen: 0.36, tailR: 0.024, fur: 0.018, furShells: 14, earKind: 'pointy', eye: 0x8fbf5a,
    coat: tabby('#837a6e', '#4a433b', '#c9bfb1', '#2a2622', 8, 15),
  },
  huhu: {
    name: 'HuHu', seed: 2, kind: 'cat', len: 0.4, rHip: 0.115, rBelly: 0.135, rChest: 0.11, legLen: 0.19, legR: 0.032,
    head: 0.078, muzzle: 0.72, tailLen: 0.34, tailR: 0.032, fur: 0.024, furShells: 14, earKind: 'pointy', eye: 0xc9a23a,
    coat: tabby('#d4823c', '#a85e26', '#f2d4a8', '#a85e26', 12, 11),
  },
  chance: {
    name: 'Chance', seed: 3, kind: 'dog', len: 0.32, rHip: 0.08, rBelly: 0.085, rChest: 0.095, legLen: 0.2, legR: 0.026,
    head: 0.072, muzzle: 0.95, tailLen: 0.2, tailR: 0.026, fur: 0.04, furShells: 16, earKind: 'floppy', eye: 0x3a2412,
    coat: yorkie,
  },
};

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

  /** Kneel next to a pet, pet it, hearts */
  private pet(p: Pet, onDone: () => void): void {
    const g = this.game;
    const ch = g.player.character;
    const toPet = p.pos.clone().sub(g.player.position).setY(0);
    const face = Math.atan2(toPet.x, toPet.z);
    const spot = p.pos.clone().addScaledVector(toPet.normalize(), -0.55);
    spot.y = g.player.position.y;
    g.player.setPosition(spot);
    g.player.facing = face;
    ch.root.rotation.y = face;
    p.mood = 'petted';
    p.timer = 3.2;
    ch.play('Kneel', { fade: 0.3, from: 0.15, to: 0.6, timeScale: 0.7, hold: true });
    g.events.emit('sfx', { name: p.rig.spec.kind === 'cat' ? 'purr' : 'happy' });
    let t = 0;
    g.beginActivity({
      name: 'pet',
      shot: { position: spot.clone().add(new THREE.Vector3(Math.sin(face + 1.9) * 1.6, 1.1, Math.cos(face + 1.9) * 1.6)), target: p.pos.clone().add(new THREE.Vector3(0, 0.25, 0)), fov: 48, blend: 0.7 },
      update: (dt) => {
        t += dt;
        if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.heartsAt(p.pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 2);
        if (t > 2.6) {
          g.endActivity();
          onDone();
        }
      },
      end: () => ch.stopOverride(0.4),
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
          chance.setPose('belly');
          this.pet(chance, () => {
            chance.setPose('stand');
            g.events.emit('progress', { key: 'pet:chance' });
          });
        },
      },
      {
        id: 'ball', position: () => this.ball.mesh.position.clone(), radius: 1.3, verb: 'Pick up', label: 'the tennis ball',
        enabled: () => !this.ball.held && !chance.carrying && this.ball.body !== null,
        onInteract: () => {
          this.despawnBall();
          this.ball.held = true;
          g.events.emit('sfx', { name: 'pickup' });
          g.ui.setActivityHint('F / Click  Throw');
        },
      },
    );
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
    const hand = g.player.character.bones.get('hand_r')?.getWorldPosition(new THREE.Vector3()) ?? g.player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
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
      const hand = player.character.bones.get('hand_r');
      if (hand) this.ball.mesh.position.copy(hand.getWorldPosition(new THREE.Vector3()));
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
      p.rig.lookTarget = p.mood === 'sleep' ? null : ppos.clone().add(new THREE.Vector3(0, 1.5, 0));
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
      const looming = player.speed > 2.5 && dp < 6;
      const close = dp < 3.0;
      const gentle = (player.crouching || player.speed < 2.2) && close;
      if (p.mood !== 'flee' && p.mood !== 'hide' && p.trust < 1 && (looming || (close && !gentle && player.speed > 0.5))) {
        p.mood = 'flee';
        p.target.copy(this.poi.hideSpot);
        p.trust = Math.max(0, p.trust - 0.3);
        this.game.events.emit('sfx', { name: 'hiss' });
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
