// Game orchestrator: owns the engine services, levels, player, camera and
// the main loop. Systems communicate through `events`.

import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { Physics } from '../engine/Physics';
import { Assets } from '../engine/Assets';
import { Input } from '../engine/Input';
import { Save } from '../engine/Save';
import { Emitter, type GameEvents } from '../engine/Events';
import { Sky, type TimeOfDay } from '../world/Sky';
import { Character } from './Character';
import { Player } from './Player';
import { CameraRig } from './CameraRig';
import { InteractionSystem, type Interactable } from './Interaction';
import type { Level } from './Level';
import type { WorldData } from '../data';
import type { UI } from '../ui/UI';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { outfitById } from './outfits';

export type GameState = 'loading' | 'title' | 'playing' | 'paused' | 'menu' | 'transition';

const FRAME_MS = 1000 / 60;
const IDLE_FRAME_MS = 1000 / 30;

export class Game {
  readonly scene = new THREE.Scene();
  readonly events = new Emitter<GameEvents>();
  readonly assets = new Assets();
  readonly save = new Save();
  readonly interaction = new InteractionSystem();
  renderer!: Renderer;
  physics!: Physics;
  input!: Input;
  sky!: Sky;
  player!: Player;
  rig!: CameraRig;
  ui!: UI;
  data: WorldData = {};
  characterGltf!: GLTF;
  levels = new Map<string, Level>();
  level!: Level;
  state: GameState = 'loading';
  time = 0;
  /** Extra per-frame systems (pets, NPCs, audio, progress…) */
  systems: Array<{ update(dt: number, time: number): void }> = [];
  /** Interactables that live outside any level (e.g. global) */
  globalInteractables: Interactable[] = [];
  /** Smoothed CPU milliseconds per frame (profiling / harness) */
  readonly cpu = { update: 0, render: 0 };
  private lastFrame = 0;
  private lastActive = 0;
  private frameTimes: number[] = [];
  /** When true the activity owns the camera/controls (sitting, cabinet…) */
  activityOwnsCamera = false;
  /** When set, owns the camera instead of the player rig (title flyover, harness bookmarks) */
  cameraOverride: ((dt: number, camera: THREE.PerspectiveCamera) => void) | null = null;
  /** Scripted input for the test harness */
  autopilot: ((dt: number) => { x: number; y: number; sprint: boolean }) | null = null;

  constructor(readonly container: HTMLElement) {}

  async init(ui: UI): Promise<void> {
    this.ui = ui;
    this.renderer = new Renderer(this.container, this.scene);
    this.physics = await Physics.create();
    this.input = new Input(this.renderer.domElement);
    this.sky = new Sky(this.scene, this.renderer.renderer, this.assets);
    this.rig = new CameraRig(this.renderer.camera, this.physics);
    this.applySettings();
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
    };
  }

  applySettings(): void {
    const s = this.save.settings;
    this.rig.sensitivity = s.sensitivity;
    this.rig.invertY = s.invertY;
    this.rig.baseFov = s.fov;
  }

  async setTimeOfDay(t: TimeOfDay): Promise<void> {
    await this.sky.set(t);
    this.save.settings.timeOfDay = t;
    this.save.write();
  }

  createPlayer(spawn: THREE.Vector3, facing: number): void {
    const character = new Character(this.characterGltf);
    const outfit = outfitById(this.save.settings.outfit);
    character.tint(outfit.body, outfit.joints);
    this.scene.add(character.root);
    this.player = new Player(this.physics, this.events, character, spawn);
    this.player.facing = facing;
    this.rig.ignoreCollider = this.player.collider;
    this.rig.snapBehind(facing);
  }

  addLevel(level: Level): void {
    this.levels.set(level.id, level);
    level.group.visible = false;
    this.scene.add(level.group);
  }

  /** Switch levels with a fade; spawn defaults to the level's own */
  async goTo(id: string, spawn?: { position: THREE.Vector3; facing: number }, fade = true): Promise<void> {
    const next = this.levels.get(id);
    if (!next) return;
    const prevState = this.state;
    this.state = 'transition';
    if (fade) await this.ui.fade(true);
    const prev = this.level;
    if (prev) {
      prev.group.visible = false;
      prev.onExit?.();
      this.events.emit('levelExit', { id: prev.id });
    }
    this.level = next;
    next.group.visible = true;
    const s = spawn ?? next.spawn;
    this.player.teleport(s.position, s.facing);
    this.rig.snapBehind(s.facing);
    this.rig.boomTarget = next.boom ?? 4.3;
    this.sky.setShadowExtent(next.shadowExtent ?? 45);
    // Interiors don't show the sky dome; their walls hide it anyway
    this.sky.dome.visible = !next.interior;
    next.onEnter?.();
    this.events.emit('levelEnter', { id: next.id });
    this.input.reset();
    // Let one frame settle (shadow map, texture uploads) before revealing
    this.renderFrame(1 / 60, true);
    if (fade) await this.ui.fade(false);
    this.state = prevState === 'transition' ? 'playing' : prevState;
  }

  start(): void {
    this.lastFrame = performance.now();
    this.renderer.renderer.setAnimationLoop((now) => this.frame(now));
  }

  private frame(now: number): void {
    // Frame pacing: 60 fps cap, 30 fps when nothing is happening
    const active = this.input.active() || this.autopilot !== null || (this.player && (this.player.speed > 0.05 || !this.player.grounded))
      || this.state !== 'playing' || this.activityOwnsCamera;
    if (active) this.lastActive = now;
    const interval = now - this.lastActive > 2500 ? IDLE_FRAME_MS : FRAME_MS;
    if (now - this.lastFrame < interval - 1) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
    this.input.pollGamepad();
    const t0 = performance.now();
    this.update(dt);
    const t1 = performance.now();
    this.renderFrame(dt, false);
    const t2 = performance.now();
    this.cpu.update = this.cpu.update * 0.95 + (t1 - t0) * 0.05;
    this.cpu.render = this.cpu.render * 0.95 + (t2 - t1) * 0.05;
    this.input.endFrame();
  }

  private update(dt: number): void {
    this.time += dt;
    const playing = this.state === 'playing';
    if (playing) this.save.data.playSeconds += dt;

    // Global keys
    if (playing && this.input.pressed('phone')) this.ui.openPhone();
    if (this.state === 'title' || this.state === 'loading') {
      this.ui.update(dt);
      return;
    }

    if (this.player) {
      const look = this.input.consumeMouse();
      const pad = this.input.padLook;
      if (playing && !this.activityOwnsCamera) {
        this.rig.look(look.dx + pad.x * 900 * dt, look.dy + pad.y * 600 * dt, dt);
      }
      let controls = playing && !this.activityOwnsCamera;
      if (this.autopilot && playing) {
        const ap = this.autopilot(dt);
        // Feed the scripted vector through the same controller path
        this.input.padMove = { x: ap.x, y: ap.y };
        controls = true;
      }
      this.player.update(dt, this.input, this.rig.yaw, controls);
      if (this.player.shake > 0) {
        this.rig.addShake(this.player.shake);
        this.player.shake = 0;
      }
    }

    // Interaction
    if (playing && this.player && this.player.state !== 'locked' && this.player.state !== 'mantle') {
      const list = [...this.level.interactables, ...this.globalInteractables];
      const it = this.interaction.resolve(list, this.player.position, this.player.facing);
      this.ui.setPrompt(it);
      if (it && this.input.pressed('interact')) {
        this.ui.setPrompt(null);
        it.onInteract();
        this.events.emit('interact', { id: it.id });
      }
    } else {
      this.ui.setPrompt(null);
    }

    this.level?.update?.(dt, this.time);
    for (const s of this.systems) s.update(dt, this.time);
    this.physics.step();
    this.ui.update(dt);
  }

  private renderFrame(dt: number, force: boolean): void {
    if (this.cameraOverride) {
      this.cameraOverride(dt, this.renderer.camera);
      this.renderer.camera.updateProjectionMatrix();
      if (this.player) this.sky.update(this.player.position, this.renderer.camera);
    } else if (this.player) {
      if (!this.activityOwnsCamera || this.rig.inShot) {
        this.rig.update(dt, this.player.position, this.player.facing, this.player.speed,
          this.input.isDown('sprint'));
      }
      this.sky.update(this.player.position, this.renderer.camera);
    }
    void force;
    this.renderer.render(this.time);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.reset();
    this.ui.showPause(true);
  }

  resume(): void {
    this.ui.showPause(false);
    this.ui.closePhone();
    this.state = 'playing';
    this.input.lock();
  }

  stats(): { median: number; p99: number; frames: number } {
    const s = [...this.frameTimes].sort((a, b) => a - b);
    return { median: s[Math.floor(s.length / 2)] ?? 0, p99: s[Math.floor(s.length * 0.99)] ?? 0, frames: s.length };
  }
}
