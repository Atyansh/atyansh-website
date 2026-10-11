// Interior level builder. Each building's interior is its own level, built
// far from the city (all levels share one physics world). Room provides the
// shell (floor, walls, ceiling, trims, entrance door + exit), placement
// helpers with exact colliders, lighting helpers and poster-wall layout
// whose sections open the collection browser at the nearest item.

import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import type { Interactable } from '../game/Interaction';
import type { Surface } from '../engine/Events';
import type { PropOptions } from '../engine/Assets';
import { Batches, boxGeo, floorGeo, quadGeo } from '../world/geo';
import type { BrowserItem } from '../ui/Browser';
import type { CityLevel } from '../world/City';

let areaInit = false;

export const INTERIOR_ORIGIN = 1000;
export const INTERIOR_SPACING = 180;

export interface ShellOptions {
  floor: string;
  floorScale?: number;
  floorTint?: number;
  wall: string;
  wallScale?: number;
  wallTint?: number;
  /** plain painted walls instead of a PBR set */
  wallColor?: number;
  ceiling?: number;
  baseboard?: number;
  crown?: boolean;
  surface: Surface;
  doorColor?: number;
}

export interface WallRun {
  /** local start/end on the floor plan */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** direction the art faces (radians) */
  facing: number;
  y0: number;
  rows: number;
  w: number;
  h: number;
  gap?: number;
  rowGap?: number;
  /** distance from the wall surface */
  inset?: number;
}

export class Room {
  readonly group = new THREE.Group();
  readonly B = new Batches();
  readonly ox: number;
  readonly interactables: Interactable[] = [];
  readonly updates: Array<(dt: number, t: number) => void> = [];
  private enterHooks: Array<() => void> = [];
  private exitHooks: Array<() => void> = [];

  constructor(readonly game: Game, readonly index: number, readonly w: number, readonly d: number, readonly h: number) {
    if (!areaInit) {
      RectAreaLightUniformsLib.init();
      areaInit = true;
    }
    this.ox = INTERIOR_ORIGIN + index * INTERIOR_SPACING;
    this.group.position.set(this.ox, 0, 0);
  }

  /** Local → world */
  v(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(this.ox + x, y, z);
  }

  get assets() { return this.game.assets; }
  get physics() { return this.game.physics; }

  aabb(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: Surface = 'wood', climbable = false, cameraIgnore = false): void {
    this.physics.aabb(this.ox + Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), this.ox + Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1),
      { kind: 'static', surface, climbable, cameraIgnore });
  }

  paint(color: number, rough = 0.6, metal = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  glow(color: number, intensity = 1.5): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
  }

  // ---------------- shell ----------------

  shell(o: ShellOptions): void {
    const { w, d, h } = this;
    const floor = this.assets.pbr(o.floor, { scale: o.floorScale ?? 2, tint: o.floorTint ?? 0xffffff });
    const wall = o.wallColor !== undefined
      ? this.paint(o.wallColor, 0.85)
      : this.assets.pbr(o.wall, { scale: o.wallScale ?? 2, tint: o.wallTint ?? 0xffffff });
    const ceil = this.paint(o.ceiling ?? 0xe8e6e0, 0.9);
    const trim = this.paint(o.baseboard ?? 0x2b2622, 0.55);

    const fg = floorGeo(w, d);
    this.B.add(floor, fg, undefined, false, true);
    const cg = floorGeo(w, d);
    cg.rotateX(Math.PI);
    cg.translate(0, h, 0);
    this.B.add(ceil, cg, undefined, false, true);
    // floor + ceiling colliders (thick so nothing tunnels)
    this.aabb(-w / 2 - 1, -1, -d / 2 - 1, w / 2 + 1, 0, d / 2 + 1, o.surface);
    this.aabb(-w / 2 - 1, h, -d / 2 - 1, w / 2 + 1, h + 1, d / 2 + 1, 'concrete');

    // walls (inward-facing), front wall split around the door
    const doorW = 2.2;
    const doorH = 2.9;
    const addWall = (m: THREE.Matrix4, len: number, door: boolean) => {
      if (!door) {
        const g = quadGeo(len, h, -len / 2, 0);
        g.applyMatrix4(m);
        this.B.add(wall, g);
        return;
      }
      const side = (len - doorW) / 2;
      for (const s of [-1, 1]) {
        const g = quadGeo(side, h, s < 0 ? -len / 2 : doorW / 2, 0);
        g.translate(s * (doorW / 2 + side / 2), 0, 0);
        g.applyMatrix4(m);
        this.B.add(wall, g);
      }
      const top = quadGeo(doorW, h - doorH, -doorW / 2, doorH);
      top.translate(0, doorH, 0);
      top.applyMatrix4(m);
      this.B.add(wall, top);
    };
    const R = (ry: number, x: number, z: number) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
    addWall(R(0, 0, -d / 2), w, false);            // back wall faces +z
    addWall(R(Math.PI, 0, d / 2), w, true);        // front wall faces -z (door)
    addWall(R(Math.PI / 2, -w / 2, 0), d, false);  // left wall faces +x
    addWall(R(-Math.PI / 2, w / 2, 0), d, false);  // right wall faces -x
    const t = 1;
    this.aabb(-w / 2 - t, 0, -d / 2 - t, w / 2 + t, h, -d / 2, 'concrete');
    this.aabb(-w / 2 - t, 0, d / 2, w / 2 + t, h, d / 2 + t, 'concrete');
    this.aabb(-w / 2 - t, 0, -d / 2, -w / 2, h, d / 2, 'concrete');
    this.aabb(w / 2, 0, -d / 2, w / 2 + t, h, d / 2, 'concrete');

    // baseboards
    const bb = 0.14;
    for (const [x, z, len, ry] of [[0, -d / 2 + 0.02, w, 0], [-w / 2 + 0.02, 0, d, Math.PI / 2], [w / 2 - 0.02, 0, d, Math.PI / 2]] as Array<[number, number, number, number]>) {
      const g = boxGeo(len, bb, 0.03);
      g.rotateY(ry);
      g.translate(x, bb / 2, z);
      this.B.add(trim, g, undefined, false);
    }
    for (const s of [-1, 1]) {
      const len = (w - doorW) / 2;
      const g = boxGeo(len, bb, 0.03);
      g.translate(s * (doorW / 2 + len / 2), bb / 2, d / 2 - 0.02);
      this.B.add(trim, g, undefined, false);
    }
    if (o.crown) {
      for (const [x, z, len, ry] of [[0, -d / 2 + 0.06, w, 0], [0, d / 2 - 0.06, w, 0], [-w / 2 + 0.06, 0, d, Math.PI / 2], [w / 2 - 0.06, 0, d, Math.PI / 2]] as Array<[number, number, number, number]>) {
        const g = boxGeo(len, 0.16, 0.12);
        g.rotateY(ry);
        g.translate(x, h - 0.08, z);
        this.B.add(trim, g, undefined, false);
      }
    }

    // entrance doors (closed) + EXIT sign + exit interaction
    const doorMat = this.paint(o.doorColor ?? 0x2a2c31, 0.45, 0.4);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.5, envMapIntensity: 1.5 });
    for (const s of [-1, 1]) {
      const leaf = boxGeo(doorW / 2 - 0.04, doorH - 0.02, 0.08);
      leaf.translate(s * (doorW / 4), (doorH - 0.02) / 2, d / 2 - 0.06);
      this.B.add(doorMat, leaf);
      const gl = boxGeo(doorW / 2 - 0.36, doorH - 0.9, 0.02);
      gl.translate(s * (doorW / 4), doorH / 2 + 0.15, d / 2 - 0.11);
      this.B.add(glassMat, gl, undefined, false);
      const bar = boxGeo(0.5, 0.05, 0.06);
      bar.translate(s * (doorW / 4 - 0.1), 1.05, d / 2 - 0.15);
      this.B.add(this.paint(0xc8ccd2, 0.25, 0.9), bar, undefined, false);
    }
    const exitTex = exitSignTexture();
    const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.08), [doorMat, doorMat, doorMat, doorMat,
      new THREE.MeshStandardMaterial({ map: exitTex, emissive: 0xffffff, emissiveMap: exitTex, emissiveIntensity: 1.6 }), doorMat]);
    exitSign.position.set(0, doorH + 0.32, d / 2 - 0.08);
    exitSign.rotation.y = Math.PI;
    this.group.add(exitSign);
  }

  /** Exit back to the street, outside this building's door */
  exitTo(buildingId: string): void {
    this.interactables.push({
      id: `exit:${buildingId}`,
      position: this.v(0, 1, this.d / 2 - 1.0),
      radius: 2.2,
      verb: 'Exit',
      label: 'to the street',
      priority: 2,
      onInteract: () => {
        const city = this.game.levels.get('street') as CityLevel | undefined;
        const door = city?.doors.find((dd) => dd.lot.enter === buildingId);
        void this.game.goTo('street', door ? { position: door.position, facing: door.facing } : undefined);
      },
    });
  }

  // ---------------- placement ----------------

  prop(id: string, x: number, z: number, ry = 0, opts: PropOptions = {}, collide: 'bounds' | 'none' = 'bounds', y = 0, surface: Surface = 'wood'): THREE.Object3D {
    const o = this.assets.prop(id, opts);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    this.group.add(o);
    if (collide === 'bounds') {
      o.updateWorldMatrix(true, true); // parents first: the room group is offset to ox
      const b = new THREE.Box3().setFromObject(o);
      // group is offset by ox; Box3 is world-space already
      this.physics.aabb(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, { kind: 'static', surface });
    }
    return o;
  }

  box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, collide = true, surface: Surface = 'wood', cast = true): void {
    const g = boxGeo(w, h, d);
    g.translate(x, y + h / 2, z);
    this.B.add(mat, g, undefined, cast);
    if (collide) this.aabb(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, surface);
  }

  /** Framed image plane facing `ry`; returns the mesh */
  art(tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number, opts: { frame?: number; glow?: number; frameW?: number } = {}): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: opts.glow ?? 0.12 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    if (opts.frame !== undefined) {
      const fw = opts.frameW ?? 0.05;
      const g = boxGeo(w + fw * 2, h + fw * 2, 0.04);
      g.translate(0, 0, -0.025);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
      this.B.add(this.frameMat(opts.frame), g, undefined, false);
    }
    return m;
  }

  private frameMats = new Map<number, THREE.Material>();
  private frameMat(c: number): THREE.Material {
    let m = this.frameMats.get(c);
    if (!m) this.frameMats.set(c, (m = this.paint(c, 0.45, 0.3)));
    return m;
  }

  /** Lay out items along wall runs; returns placements for browse lookup */
  wallOfArt(items: Array<{ art: string }>, runs: WallRun[], frame = 0x15161a, glow = 0.12): Array<{ index: number; pos: THREE.Vector3 }> {
    const placed: Array<{ index: number; pos: THREE.Vector3 }> = [];
    let i = 0;
    for (const run of runs) {
      const len = Math.hypot(run.x1 - run.x0, run.z1 - run.z0);
      const gap = run.gap ?? 0.3;
      const cols = Math.max(1, Math.floor((len + gap) / (run.w + gap)));
      const used = cols * run.w + (cols - 1) * gap;
      const start = (len - used) / 2 + run.w / 2;
      const dx = (run.x1 - run.x0) / len;
      const dz = (run.z1 - run.z0) / len;
      const inset = run.inset ?? 0.03;
      const nx = Math.sin(run.facing) * inset;
      const nz = Math.cos(run.facing) * inset;
      for (let rI = 0; rI < run.rows; rI++) {
        const y = run.y0 + run.h / 2 + rI * (run.h + (run.rowGap ?? 0.35));
        for (let c = 0; c < cols; c++) {
          if (i >= items.length) return placed;
          const t = start + c * (run.w + gap);
          const x = run.x0 + dx * t + nx;
          const z = run.z0 + dz * t + nz;
          this.art(this.assets.art(items[i].art), run.w, run.h, x, y, z, run.facing, { frame, glow });
          placed.push({ index: i, pos: this.v(x, y, z) });
          i++;
        }
      }
    }
    return placed;
  }

  /** Browse interactables along a wall of art: opens at the nearest item */
  browseSpots(placed: Array<{ index: number; pos: THREE.Vector3 }>, every: number, label: string, open: (start: number) => void): void {
    for (let k = 0; k < placed.length; k += every) {
      const p = placed[k].pos.clone();
      p.y = 1;
      this.interactables.push({
        id: `browse:${label}:${k}`,
        position: p,
        radius: 2.4,
        verb: 'Browse',
        label,
        onInteract: () => {
          // nearest placed item to the player
          const pp = this.game.player.position;
          let best = 0;
          let bd = Infinity;
          for (const pl of placed) {
            const dd = pl.pos.distanceToSquared(new THREE.Vector3(pp.x, pl.pos.y, pp.z));
            if (dd < bd) { bd = dd; best = pl.index; }
          }
          open(best);
        },
      });
    }
  }

  // ---------------- lights ----------------

  /** Soft area light at local (x,y,z) aimed at a local target (default: straight down) */
  rect(x: number, y: number, z: number, w: number, h: number, color: number, intensity: number, target?: THREE.Vector3): THREE.RectAreaLight {
    const l = new THREE.RectAreaLight(color, intensity, w, h);
    l.position.set(x, y, z);
    this.group.add(l);
    // lookAt works in world space; the room group is offset by ox
    const t = target ?? new THREE.Vector3(x, 0, z);
    l.lookAt(this.v(t.x, t.y, t.z));
    // visible panel
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.glow(color, 2.2));
    p.position.set(x, y + 0.01, z);
    p.rotation.x = Math.PI / 2;
    if (!target) this.group.add(p);
    return l;
  }

  point(x: number, y: number, z: number, color: number, intensity: number, distance = 14, decay = 1.6): THREE.PointLight {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    this.group.add(l);
    return l;
  }

  spot(x: number, y: number, z: number, tx: number, ty: number, tz: number, color: number, intensity: number, angle = 0.6, shadow = false): THREE.SpotLight {
    const l = new THREE.SpotLight(color, intensity, 30, angle, 0.5, 1.4);
    l.position.set(x, y, z);
    l.target.position.set(tx, ty, tz);
    l.castShadow = shadow;
    if (shadow) {
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0004;
    }
    this.group.add(l, l.target);
    return l;
  }

  onEnter(fn: () => void): void { this.enterHooks.push(fn); }
  onExit(fn: () => void): void { this.exitHooks.push(fn); }

  finish(o: { id: string; name: string; music: string; ambience: Level['ambience']; envIntensity?: number; boom?: number; spawn?: { x: number; z: number; facing: number } }): Level {
    this.B.build(this.group);
    const sp = o.spawn ?? { x: 0, z: this.d / 2 - 1.6, facing: Math.PI };
    return {
      id: o.id,
      name: o.name,
      group: this.group,
      interior: true,
      music: o.music,
      ambience: o.ambience,
      spawn: { position: this.v(sp.x, 0, sp.z), facing: sp.facing },
      interactables: this.interactables,
      boom: o.boom ?? 3.4,
      envIntensity: o.envIntensity ?? 0.5,
      shadowExtent: Math.max(this.w, this.d) * 0.7,
      update: (dt, t) => { for (const u of this.updates) u(dt, t); },
      onEnter: () => { for (const f of this.enterHooks) f(); },
      onExit: () => { for (const f of this.exitHooks) f(); },
    };
  }
}

function exitSignTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d1a10';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#3dff7a';
  g.font = '800 64px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('EXIT', 128, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
