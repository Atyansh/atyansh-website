// Photo mode: free-fly camera, colour filters, FOV, hidden HUD, snapshots.

import * as THREE from 'three';
import type { Game } from './Game';
import type { PhotoFilter } from '../engine/Renderer';
import { clamp } from '../engine/math';

const FILTERS: PhotoFilter[] = ['none', 'vivid', 'warm', 'cool', 'retro', 'noir'];

export class PhotoMode {
  active = false;
  private pos = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private fov = 55;
  private filter = 0;
  private bar: HTMLDivElement;
  private snap = false;

  constructor(private game: Game) {
    this.bar = document.createElement('div');
    this.bar.style.cssText = 'position:fixed;left:50%;bottom:4vh;transform:translateX(-50%);display:none;gap:18px;align-items:center;padding:12px 20px;border-radius:999px;background:rgba(10,12,18,.72);backdrop-filter:blur(10px);color:#f4f1ea;font:500 13px var(--ui-font);z-index:31;pointer-events:none;white-space:nowrap';
    game.ui.root.appendChild(this.bar);
    game.afterRender.push(() => this.capture());
  }

  start(): void {
    const g = this.game;
    const cam = g.renderer.camera;
    this.active = true;
    this.pos.copy(cam.position);
    const dir = cam.getWorldDirection(new THREE.Vector3());
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(clamp(dir.y, -1, 1));
    this.fov = cam.fov;
    g.ui.setHudVisible(false);
    this.bar.style.display = 'flex';
    g.beginActivity({ name: 'photo', update: (dt) => this.update(dt), end: () => this.stop() });
    g.cameraOverride = (_dt, c) => {
      c.position.copy(this.pos);
      c.lookAt(this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))));
      c.fov = this.fov;
    };
    this.renderBar();
  }

  private stop(): void {
    const g = this.game;
    this.active = false;
    g.cameraOverride = null;
    g.renderer.setFilter('none');
    g.ui.setHudVisible(true);
    this.bar.style.display = 'none';
  }

  private renderBar(): void {
    this.bar.innerHTML = `<b style="font-family:var(--ui-display);letter-spacing:.12em">PHOTO MODE</b>
      <span>WASD fly · C/E down/up · Shift fast · mouse look</span><span>Filter: <b>${FILTERS[this.filter]}</b> (1–6)</span>
      <span>FOV ${Math.round(this.fov)} (wheel)</span><span><b>Space</b> snap</span><span><b>Esc</b> exit</span>`;
  }

  private update(dt: number): void {
    const g = this.game;
    const i = g.input;
    const m = i.consumeMouse();
    this.yaw -= m.dx * 0.0022;
    this.pitch = clamp(this.pitch - m.dy * 0.0022, -1.4, 1.4);
    const mv = i.move();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const sp = (i.isDown('sprint') ? 9 : 3.5) * dt;
    this.pos.addScaledVector(fwd, mv.y * sp).addScaledVector(right, mv.x * sp);
    // keep the camera near the player (no flying off into the void)
    const p = g.player.position;
    const off = this.pos.clone().sub(p);
    if (off.length() > 25) this.pos.copy(p).add(off.setLength(25));
    this.pos.y = clamp(this.pos.y, p.y + 0.2, p.y + 25);
    if (i.wheel) { this.fov = clamp(this.fov + i.wheel * 3, 20, 90); this.renderBar(); }
    if (i.pressed('jump')) { this.snap = true; g.events.emit('sfx', { name: 'shutter' }); }
    if (i.pressed('back') || i.pressed('phone')) g.endActivity();
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].findIndex((c) => i.pressedCode(c));
    if (digit >= 0) { this.filter = digit; g.renderer.setFilter(FILTERS[digit]); this.renderBar(); }
    if (i.isDown('crouch')) this.pos.y -= sp;
    if (i.isDown('interact')) this.pos.y += sp;
  }

  private capture(): void {
    if (!this.snap) return;
    this.snap = false;
    const url = this.game.renderer.domElement.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-block-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
    a.click();
    this.game.ui.toast('Photo saved', 'Check your downloads', '📷', 'info');
  }
}
