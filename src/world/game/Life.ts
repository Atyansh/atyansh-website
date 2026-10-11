// Ambient life: NPCs (mannequins in varied outfits) and pigeons.
//
// NPCs are either stationed (phone call at the bus stop, bench sitter,
// staff behind counters, a couple chatting) or walkers that loop the
// sidewalks on fixed paths, slowing and side-stepping around the player.
// Pigeons peck around the plaza and burst into flight if you run at them.

import * as THREE from 'three';
import type { Game } from './Game';
import { Character } from './Character';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { CURB, CURB_H, PARK } from '../world/layout';
import { clamp, dampAngle, rng } from '../engine/math';

const OUTFITS: Array<[string, string]> = [
  ['#c9573f', '#2d2f36'], ['#3b6ea8', '#e8e2d4'], ['#e0b84a', '#3a2e22'], ['#6b8f5a', '#1e2a22'], ['#8a5aa8', '#f2efe8'],
  ['#d7d2c8', '#1c2030'], ['#2f3440', '#ff9a3c'], ['#b8404f', '#f4e6d0'], ['#3f8f8a', '#202428'], ['#a87a4a', '#2a2420'],
];

interface Npc {
  ch: Character;
  path?: THREE.Vector3[];
  seg: number;
  t: number;
  speed: number;
  pos: THREE.Vector3;
  heading: number;
  pause: number;
  clip?: string;
  wave: number;
}

export class Life {
  private npcs: Npc[] = [];
  private pigeons: Array<{ m: THREE.Group; home: THREE.Vector3; pos: THREE.Vector3; vel: THREE.Vector3; flying: boolean; t: number; peck: number; heading: number }> = [];
  private r = rng(321);

  constructor(private game: Game, female?: GLTF) {
    const street = game.levels.get('street')!.group;
    const add = (pos: THREE.Vector3, heading: number, opts: Partial<Npc> & { clip?: string; group?: THREE.Group }) => {
      // alternate body types; the female mesh shares the skeleton, so it plays the same clips
      const ch = female && this.npcs.length % 2 === 1 ? new Character(female, game.characterGltf.animations) : new Character(game.characterGltf);
      const o = OUTFITS[this.npcs.length % OUTFITS.length];
      ch.tint(o[0], o[1]);
      ch.root.position.copy(pos);
      ch.root.rotation.y = heading;
      const s = 0.94 + this.r() * 0.12;
      ch.root.scale.setScalar(s);
      (opts.group ?? street).add(ch.root);
      if (opts.clip) ch.play(opts.clip, { loop: true, fade: 0 });
      this.npcs.push({ ch, seg: 0, t: 0, speed: 1.25 + this.r() * 0.3, pos: pos.clone(), heading, pause: 0, wave: 0, ...opts });
    };

    // stationed — street
    add(new THREE.Vector3(3.8, CURB_H, CURB.z - 1.0), Math.PI * 0.85, { clip: 'Phone' });
    add(new THREE.Vector3(PARK.minX + 3.6, CURB_H, PARK.maxZ - 4.4), 0.8, { clip: 'SitIdle' });
    add(new THREE.Vector3(-3.4, CURB_H, CURB.z - 3.4), 0.6, { clip: 'Talk' });
    add(new THREE.Vector3(-2.4, CURB_H, CURB.z - 2.8), -2.3, { clip: 'FoldArms' });
    add(new THREE.Vector3(CURB.x - 3.8, CURB_H, CURB.z - 0.9), -0.3, { clip: 'RailLean' });
    // walkers: rectangular loops round the block sidewalk (clockwise/counter)
    const inset = 2.2;
    const loop = (dir: number) => {
      const pts = [
        new THREE.Vector3(-CURB.x + inset, CURB_H, CURB.z - inset), new THREE.Vector3(CURB.x - inset, CURB_H, CURB.z - inset),
        new THREE.Vector3(CURB.x - inset, CURB_H, -CURB.z + inset), new THREE.Vector3(-CURB.x + inset, CURB_H, -CURB.z + inset),
      ];
      return dir > 0 ? pts : pts.reverse();
    };
    for (let i = 0; i < 6; i++) {
      const path = loop(i % 2 ? 1 : -1);
      const seg = i % 4;
      const t = this.r();
      const p = path[seg].clone().lerp(path[(seg + 1) % 4], t);
      add(p, 0, { path, seg, t, clip: undefined });
    }

    // staff in interiors
    const staff = (level: string, x: number, z: number, heading: number, clip: string) => {
      const l = game.levels.get(level);
      if (!l) return;
      add(new THREE.Vector3(x, 0, z), heading, { clip, group: l.group });
    };
    staff('cinema', 9.5, 2 + 5 - 1.1, Math.PI, 'Idle');
    staff('anime', 7 - 2.3, -8 + 2.6 - 1.0, 0, 'Talk');
    staff('records', 7 - 1.9, 10 - 4.5, -Math.PI / 2, 'FoldArms');
    staff('climb', 20 - 4, 23 - 4 - 1.0, Math.PI, 'Idle');

    // pigeons by the bus shelter plaza and park gates
    const pigeon = this.pigeonMesh();
    const flock = (cx: number, cz: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const home = new THREE.Vector3(cx + (this.r() - 0.5) * 3, CURB_H, cz + (this.r() - 0.5) * 2);
        const m = pigeon.clone();
        m.position.copy(home);
        street.add(m);
        this.pigeons.push({ m, home, pos: home.clone(), vel: new THREE.Vector3(), flying: false, t: 0, peck: this.r() * 3, heading: this.r() * Math.PI * 2 });
      }
    };
    flock(8, CURB.z - 2.4, 7);
    flock(PARK.maxX + 2, PARK.minZ + 6, 5);
    flock(-30, -CURB.z + 2.2, 5);
  }

  private pigeonMesh(): THREE.Group {
    const g = new THREE.Group();
    const grey = new THREE.MeshStandardMaterial({ color: 0x8a8e96, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4e58, roughness: 0.6 });
    const sheen = new THREE.MeshStandardMaterial({ color: 0x3f6e64, roughness: 0.35, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), grey);
    body.scale.set(0.85, 0.8, 1.3);
    body.position.y = 0.11;
    g.add(body);
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), sheen);
    neck.position.set(0, 0.18, 0.08);
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), dark);
    head.position.set(0, 0.23, 0.12);
    head.name = 'head';
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.225, 0.165);
    head.add(beak);
    beak.position.set(0, -0.005, 0.045);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.1), dark);
    tail.position.set(0, 0.11, -0.15);
    tail.rotation.x = 0.3;
    g.add(tail);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), dark);
      w.position.set(s * 0.09, 0.14, -0.01);
      w.name = s < 0 ? 'wingL' : 'wingR';
      g.add(w);
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return g;
  }

  update(dt: number, time: number): void {
    const g = this.game;
    const level = g.level?.id;
    const pp = g.player.position;
    for (const n of this.npcs) {
      const parentLevel = n.ch.root.parent === g.levels.get('street')!.group ? 'street' : 'interior';
      if ((parentLevel === 'street') !== (level === 'street')) continue;
      // skinned meshes skip frustum culling; hide distant NPCs outright
      const far = n.ch.root.position.distanceTo(g.renderer.camera.position) > 60;
      n.ch.root.visible = !far;
      if (far && !n.path) continue;
      if (n.path) {
        // walk the loop, yield to the player
        const a = n.path[n.seg];
        const b = n.path[(n.seg + 1) % n.path.length];
        const len = a.distanceTo(b);
        const near = n.pos.distanceTo(pp);
        const sp = near < 1.4 ? 0.2 : near < 2.6 ? n.speed * 0.6 : n.speed;
        n.t += (sp * dt) / len;
        if (n.t >= 1) { n.t = 0; n.seg = (n.seg + 1) % n.path.length; }
        const target = a.clone().lerp(b, n.t);
        // side-step around the player
        const away = target.clone().sub(pp).setY(0);
        if (away.length() < 1.2) target.addScaledVector(away.normalize(), 1.2 - away.length());
        const step = target.clone().sub(n.pos);
        const v = step.length() / Math.max(dt, 1e-3);
        n.pos.copy(target);
        if (step.lengthSq() > 1e-6) n.heading = dampAngle(n.heading, Math.atan2(step.x, step.z), 8, dt);
        n.ch.root.position.copy(n.pos);
        n.ch.root.rotation.y = n.heading;
        n.ch.locomote(clamp(v, 0, 3), false, dt);
        // wave hello now and then when passing close
        n.wave -= dt;
        if (near < 3 && n.wave < -12 && this.r() < 0.01) { n.wave = 2; n.ch.play('Yes', { fade: 0.2 }); }
      } else {
        n.ch.locomote(0, false, dt);
        // stationed NPCs glance at the player when close
        const d = n.ch.root.position.distanceTo(pp);
        if (d < 4 && n.clip !== 'SitIdle' && n.clip !== 'Phone') {
          const to = pp.clone().sub(n.ch.root.position);
          n.ch.root.rotation.y = dampAngle(n.ch.root.rotation.y, Math.atan2(to.x, to.z), 2, dt);
        }
      }
      n.ch.update(dt);
    }

    if (level !== 'street') return;
    const camPos = g.renderer.camera.position;
    for (const p of this.pigeons) {
      p.m.visible = p.pos.distanceTo(camPos) < 45;
      const d = p.pos.distanceTo(pp);
      if (!p.flying && (d < 1.6 || (d < 4.5 && g.player.speed > 4))) {
        p.flying = true;
        p.t = 0;
        const away = p.pos.clone().sub(pp).setY(0).normalize();
        p.vel.set(away.x * 3 + (this.r() - 0.5) * 2, 4 + this.r() * 2, away.z * 3 + (this.r() - 0.5) * 2);
        if (d < 3) g.events.emit('sfx', { name: 'flutter', volume: 0.6 });
      }
      if (p.flying) {
        p.t += dt;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.y -= 0.6 * dt;
        p.heading = Math.atan2(p.vel.x, p.vel.z);
        const flap = Math.sin(time * 40) * 0.9;
        (p.m.getObjectByName('wingL') as THREE.Mesh).rotation.z = flap;
        (p.m.getObjectByName('wingR') as THREE.Mesh).rotation.z = -flap;
        if (p.t > 4.5 && pp.distanceTo(p.home) > 6) {
          // glide home and land
          p.flying = false;
          p.pos.copy(p.home);
        }
      } else {
        p.peck -= dt;
        const head = p.m.getObjectByName('head')!;
        if (p.peck < 0) {
          p.peck = 0.6 + this.r() * 2.5;
          p.heading += (this.r() - 0.5) * 1.2;
          if (this.r() < 0.4) p.pos.add(new THREE.Vector3(Math.sin(p.heading) * 0.15, 0, Math.cos(p.heading) * 0.15));
        }
        head.position.y = p.peck < 0.25 ? 0.16 : 0.23;
        (p.m.getObjectByName('wingL') as THREE.Mesh).rotation.z = 0;
        (p.m.getObjectByName('wingR') as THREE.Mesh).rotation.z = 0;
      }
      p.m.position.copy(p.pos);
      p.m.rotation.y = p.heading;
    }
  }
}
