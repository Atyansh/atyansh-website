// Goals, collectibles and rewards — the game's progression layer.
//
// Goals are derived from save flags/counters so they survive reloads and
// can be completed in any order. Completing a goal grants a reward (an
// outfit and/or photo filter). The HUD tracker shows the next open goal.

import * as THREE from 'three';
import type { Game } from './Game';
import { CURB_H, ALLEY, BLOCK, PARK, LOTS } from '../world/layout';
import { OUTFITS } from './outfits';

export interface Goal {
  id: string;
  title: string;
  hint: string;
  /** progress 0..total */
  progress: () => number;
  total: number;
  reward?: string;
}

export const ENTERABLE = ['cinema', 'records', 'arcade', 'books', 'anime', 'tv', 'climb', 'studio'];
export const ARCADE_TARGET = 1500;
export const GACHA_TARGET = 12;

/** Golden record spawn points (world coords, street level) — some on roofs */
export function recordSpots(): THREE.Vector3[] {
  const roof = (id: string) => {
    const l = LOTS.find((x) => x.id === id)!;
    return new THREE.Vector3(l.x + l.w * 0.2, CURB_H + l.h + 0.6, l.z);
  };
  return [
    new THREE.Vector3((ALLEY.minX + ALLEY.maxX) / 2, CURB_H + 0.5, -2),          // deep in the alley
    new THREE.Vector3(PARK.minX + 2.0, CURB_H + 0.5, PARK.maxZ - 8.5),           // behind BaoBao's hedge
    new THREE.Vector3(BLOCK.maxX + 2.0, CURB_H + 0.5, BLOCK.maxZ + 3.6),         // by the newsstand
    new THREE.Vector3(-56.5, CURB_H + 0.5, 47.0),                                // far SW corner
    new THREE.Vector3(56.5, CURB_H + 0.5, -47.0),                                // far NE corner
    roof('deli'),                                                                // roof — via the fire escape
    new THREE.Vector3(2.2, CURB_H + 1.0 + 0.9, 33.0),                            // on the bus shelter roof
    new THREE.Vector3(-20, CURB_H + 1.4, 34.0),                                  // ticket booth top
  ];
}

export class Progress {
  readonly goals: Goal[];
  private done = new Set<string>();

  constructor(private game: Game) {
    const s = game.save;
    const visited = () => ENTERABLE.filter((id) => s.flag(`visited:${id}`)).length;
    const pets = () => ['baobao', 'huhu', 'chance'].filter((p) => s.flag(`pet:${p}`)).length;
    const tops = () => ['ridge', 'tower', 'island'].filter((b) => s.flag(`climb:top:${b}`)).length;
    this.goals = [
      { id: 'tour', title: 'Grand Tour', hint: 'Step inside every building on the block', progress: visited, total: ENTERABLE.length, reward: 'marquee' },
      { id: 'pets', title: 'Friends of the Park', hint: 'Earn BaoBao’s trust, pet HuHu, play fetch with Chance', progress: pets, total: 3, reward: 'tabby' },
      { id: 'climb', title: 'Send It', hint: 'Top out all three boulders in the climbing gym', progress: tops, total: 3, reward: 'crimp' },
      { id: 'arcade', title: 'High Score', hint: `Score ${ARCADE_TARGET} on BLOCK BREAKER in the arcade`, progress: () => Math.min(ARCADE_TARGET, s.data.arcadeBest), total: ARCADE_TARGET, reward: 'arcade' },
      { id: 'gacha', title: 'Gotta Watch ’Em All', hint: `Collect ${GACHA_TARGET} different cards from the café gacha`, progress: () => Math.min(GACHA_TARGET, new Set(s.data.gachaCards).size), total: GACHA_TARGET },
      { id: 'records', title: 'Golden Records', hint: 'Find the golden records hidden around the block', progress: () => s.data.collectibles.length, total: recordSpots().length, reward: 'gold' },
    ];
    for (const g of this.goals) {
      if (g.progress() < g.total) continue;
      this.done.add(g.id);
      if (!s.data.rewards.includes(g.id)) { s.data.rewards.push(g.id); s.write(); }
    }
    game.events.on('levelEnter', ({ id }) => {
      if (ENTERABLE.includes(id) && s.setFlag(`visited:${id}`)) this.check();
    });
    game.events.on('progress', () => this.check());
    game.events.on('collectible', () => this.check());
    this.refreshTracker();
  }

  completion(): number {
    return this.goals.reduce((a, g) => a + Math.min(1, g.progress() / g.total), 0) / this.goals.length;
  }

  private check(): void {
    for (const g of this.goals) {
      if (this.done.has(g.id) || g.progress() < g.total) continue;
      this.done.add(g.id);
      this.game.events.emit('sfx', { name: 'goal' });
      const outfit = OUTFITS.find((o) => o.unlock === g.id);
      this.game.ui.toast(`Goal complete · ${g.title}`, outfit ? `Unlocked the ${outfit.name} outfit — open the phone's Wardrobe` : g.hint, '🏆', 'reward');
      if (!this.game.save.data.rewards.includes(g.id)) {
        this.game.save.data.rewards.push(g.id);
        this.game.save.write();
      }
      if (this.done.size === this.goals.length) {
        this.game.ui.toast('Key to the Block', 'Every goal complete. Thanks for visiting.', '🗝', 'reward');
      }
    }
    this.refreshTracker();
  }

  refreshTracker(): void {
    const next = this.goals.find((g) => !this.done.has(g.id));
    if (!next) { this.game.ui.setGoal('All goals complete', 'The block is yours'); return; }
    this.game.ui.setGoal(next.title, `${next.hint} · ${Math.min(next.progress(), next.total)}/${next.total}`);
  }

  isDone(id: string): boolean { return this.done.has(id); }
}

/** Spinning golden records you can pick up */
export class GoldenRecords {
  private items: Array<{ id: string; mesh: THREE.Group; base: THREE.Vector3 }> = [];

  constructor(private game: Game) {
    const disc = new THREE.Group();
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.018, 40), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.22, emissive: 0x6a4a10, emissiveIntensity: 0.4 }));
    vinyl.rotation.x = Math.PI / 2;
    disc.add(vinyl);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.022, 24), new THREE.MeshStandardMaterial({ color: 0xff5a4e, roughness: 0.5 }));
    label.rotation.x = Math.PI / 2;
    disc.add(label);
    const street = game.levels.get('street')!;
    const hc = document.createElement('canvas');
    hc.width = hc.height = 64;
    const hg = hc.getContext('2d')!;
    const grad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 64, 64);
    const haloTex = new THREE.CanvasTexture(hc);
    recordSpots().forEach((p, i) => {
      const id = `record:${i}`;
      if (game.save.data.collectibles.includes(id)) return;
      const m = disc.clone();
      m.position.copy(p);
      // no light (removing one on pickup recompiles every shader) and no
      // sprite (the AO pass draws sprites as opaque quads): an emissive rim
      // that blooms instead
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 40), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd36a, emissiveIntensity: 3.5 }));
      m.add(ring);
      void haloTex;
      street.group.add(m);
      this.items.push({ id, mesh: m, base: p.clone() });
    });
  }

  update(dt: number, t: number): void {
    if (this.game.level?.id !== 'street') return;
    const pp = this.game.player.position;
    for (const it of this.items) {
      it.mesh.rotation.y += dt * 1.8;
      it.mesh.position.y = it.base.y + Math.sin(t * 2 + it.base.x) * 0.08;
      if (pp.distanceTo(it.base) < 1.2 && it.mesh.visible) {
        it.mesh.visible = false;
        this.game.save.data.collectibles.push(it.id);
        this.game.save.write();
        this.game.events.emit('sfx', { name: 'collect' });
        this.game.events.emit('collectible', { id: it.id });
        this.game.ui.toast('Golden record', `${this.game.save.data.collectibles.length} found`, '💿', 'collect');
      }
    }
  }

  remaining(): Array<{ x: number; z: number }> {
    return this.items.filter((i) => i.mesh.visible).map((i) => ({ x: i.base.x, z: i.base.z }));
  }
}
