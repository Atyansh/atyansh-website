// Procedural building generator.
//
// Facades are built as real wall strips around true window openings, so every
// window has 3D reveals, a recessed interior-mapped pane, frames, mullions and
// a protruding sill — no painted-on windows. Party walls stay blank up to the
// neighbour's height. Ground floors are composed per business type (store,
// café, lobby, shutter, gym, cinema) with recessed doors, real display boxes
// behind glass, awnings and signage. Everything merges into per-material
// batches (see geo.ts) to keep draw calls low.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Assets } from '../engine/Assets';
import type { Physics } from '../engine/Physics';
import { Batches, boxGeo, quadGeo, floorGeo } from './geo';
import { CURB_H, facingRotation, type Lot, type StyleId } from './layout';
import { createWindowMaterial, bindCityUniforms } from './WindowMaterial';
import { awningTexture, bladeTexture, fasciaTexture, menuTexture, muralTexture, plateTexture, shelfTexture } from './Signage';
import { rng, hashString } from '../engine/math';
import type { NightLights } from './NightLights';

export interface StyleDef {
  wall: string;
  scale: number;
  tint: number;
  trim: number;
  frame: number;
  bay: number;
  floorH: number;
  gfH: number;
  winW: number;
  winH: number;
  cornice: 'heavy' | 'light' | 'flat';
  lintel: boolean;
  mullion: 'cross' | 'vertical' | 'none' | 'grid';
  room: 0 | 1 | 2;
  /** horizontal ribbon windows (industrial / modern) */
  ribbon?: boolean;
  normal?: number;
}

export const STYLES: Record<StyleId, StyleDef> = {
  brickTan: { wall: 'brick_wall_02', scale: 1.9, tint: 0xffffff, trim: 0xd9d0bd, frame: 0x2a2c31, bay: 3.2, floorH: 3.3, gfH: 4.6, winW: 1.35, winH: 1.9, cornice: 'heavy', lintel: true, mullion: 'vertical', room: 0 },
  brickRed: { wall: 'red_brick_03', scale: 1.5, tint: 0xf2e6e0, trim: 0xe9e2d2, frame: 0xf1ede5, bay: 3.0, floorH: 3.2, gfH: 4.5, winW: 1.25, winH: 1.85, cornice: 'heavy', lintel: true, mullion: 'cross', room: 0 },
  brickDark: { wall: 'brick_wall_001', scale: 1.9, tint: 0xd8d0c8, trim: 0xa39d92, frame: 0x1d1f23, bay: 3.4, floorH: 3.3, gfH: 4.6, winW: 1.5, winH: 1.95, cornice: 'light', lintel: true, mullion: 'grid', room: 1 },
  plasterCream: { wall: 'painted_plaster_wall', scale: 2.6, tint: 0xf0e2c6, trim: 0xffffff, frame: 0x39404a, bay: 3.1, floorH: 3.2, gfH: 4.4, winW: 1.3, winH: 1.8, cornice: 'heavy', lintel: false, mullion: 'vertical', room: 0 },
  plasterSage: { wall: 'painted_plaster_wall', scale: 2.6, tint: 0xbfcfae, trim: 0xf6f2e8, frame: 0x2f3a33, bay: 3.1, floorH: 3.2, gfH: 4.4, winW: 1.3, winH: 1.8, cornice: 'heavy', lintel: false, mullion: 'cross', room: 0 },
  plasterPink: { wall: 'painted_plaster_wall', scale: 2.6, tint: 0xf3c7c9, trim: 0xfff8f2, frame: 0x5a3a44, bay: 3.0, floorH: 3.2, gfH: 4.3, winW: 1.2, winH: 1.7, cornice: 'light', lintel: false, mullion: 'vertical', room: 0 },
  plasterBlue: { wall: 'painted_plaster_wall', scale: 2.6, tint: 0xbcd2e4, trim: 0xffffff, frame: 0x2c3a4a, bay: 3.1, floorH: 3.2, gfH: 4.4, winW: 1.3, winH: 1.8, cornice: 'light', lintel: false, mullion: 'vertical', room: 0 },
  plasterDark: { wall: 'painted_plaster_wall', scale: 2.6, tint: 0x55506a, trim: 0x2c2a36, frame: 0x17161d, bay: 3.2, floorH: 3.3, gfH: 4.6, winW: 1.4, winH: 1.8, cornice: 'flat', lintel: false, mullion: 'none', room: 2 },
  stucco: { wall: 'white_stucco_02', scale: 2.2, tint: 0xf2ebe0, trim: 0xfaf6ee, frame: 0x3b3f45, bay: 3.2, floorH: 3.2, gfH: 4.4, winW: 1.3, winH: 1.8, cornice: 'light', lintel: false, mullion: 'vertical', room: 0 },
  modern: { wall: 'rectangular_facade_tiles', scale: 3.2, tint: 0xd8dde3, trim: 0x8e959e, frame: 0x1e2126, bay: 2.6, floorH: 3.6, gfH: 5.0, winW: 2.3, winH: 2.6, cornice: 'flat', lintel: false, mullion: 'vertical', room: 1, ribbon: false },
  industrial: { wall: 'corrugated_iron_02', scale: 2.4, tint: 0x4a4f58, trim: 0x2e3238, frame: 0x22252a, bay: 4.0, floorH: 4.2, gfH: 5.2, winW: 3.2, winH: 1.3, cornice: 'flat', lintel: false, mullion: 'grid', room: 2, ribbon: true },
  artdeco: { wall: 'white_stucco_02', scale: 2.2, tint: 0xe9dcc4, trim: 0xc9b48a, frame: 0x6b5634, bay: 3.0, floorH: 3.4, gfH: 5.4, winW: 1.25, winH: 2.1, cornice: 'heavy', lintel: true, mullion: 'grid', room: 0 },
  concrete: { wall: 'brushed_concrete', scale: 2.5, tint: 0xcdc8bf, trim: 0x9c968c, frame: 0x24272c, bay: 3.0, floorH: 3.4, gfH: 4.8, winW: 2.0, winH: 2.0, cornice: 'flat', lintel: false, mullion: 'vertical', room: 1 },
};

export type DisplayProvider = (lot: Lot, slot: number) => THREE.Texture | null;

interface Face {
  key: 'front' | 'back' | 'left' | 'right';
  /** face frame: origin at face bottom-centre, +x along, +z outward */
  m: THREE.Matrix4;
  L: number;
  /** wall below this height stays blank (party wall) */
  blankTo: number;
  exposed: boolean;
}

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

export class CityBuilder {
  readonly batches = new Batches();
  private windowGeos: THREE.BufferGeometry[] = [];
  readonly windowMaterial: THREE.ShaderMaterial;
  private mats = new Map<string, THREE.Material>();
  /** Door interaction points for enterable buildings */
  readonly doors: Array<{ lot: Lot; position: THREE.Vector3; facing: number }> = [];
  readonly group = new THREE.Group();
  private inst: ReturnType<Assets['instancer']>;

  constructor(private assets: Assets, private physics: Physics, private lights: NightLights, private display: DisplayProvider, private allLots: Lot[]) {
    this.inst = assets.instancer();
    this.windowMaterial = createWindowMaterial();
    bindCityUniforms(this.windowMaterial);
  }

  // ---------- materials ----------

  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) this.mats.set(key, (m = make()));
    return m;
  }

  wallMat(s: StyleDef): THREE.Material {
    return this.assets.pbr(s.wall, { scale: s.scale, tint: s.tint, normalScale: s.normal ?? 1 });
  }

  trimMat(color: number): THREE.Material {
    return this.assets.pbr('brushed_concrete', { scale: 1.2, tint: color, normalScale: 0.5 });
  }

  paint(color: number, rough = 0.55, metal = 0.15): THREE.Material {
    return this.mat(`paint|${color}|${rough}|${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  }

  glassMat(): THREE.Material {
    return this.mat('glass', () => new THREE.MeshStandardMaterial({
      color: 0x9fb4c4, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 2.2, depthWrite: false,
    }));
  }

  /** PBR material that glows faintly from its own albedo (lit interiors seen through glass) */
  litPbr(id: string, scale: number, glow: number): THREE.Material {
    return this.mat(`litpbr|${id}|${scale}|${glow}`, () => {
      const base = this.assets.pbr(id, { scale });
      const m = base.clone();
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = base.map;
      m.emissiveIntensity = glow;
      this.lights.register(m, glow, glow * 2);
      return m;
    });
  }

  /** Emissive light panel registered with the night system */
  lightMat(color: number, day: number, night: number): THREE.MeshStandardMaterial {
    const m = this.mat(`light|${color}|${day}|${night}`, () => {
      const mm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: day, roughness: 0.4 });
      this.lights.register(mm, day, night);
      return mm;
    }) as THREE.MeshStandardMaterial;
    return m;
  }

  private signMat(tex: THREE.Texture, day = 0.35, night = 1.6): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: day, roughness: 0.5 });
    this.lights.register(m, day, night);
    return m;
  }

  // ---------- helpers ----------

  private box(mat: THREE.Material, m: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, d: number, cast = true): void {
    _m2.copy(m).multiply(_m.makeTranslation(x, y + h / 2, z));
    this.batches.add(mat, boxGeo(w, h, d), _m2, cast);
  }

  private quad(mat: THREE.Material, m: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, ry = 0, u0?: number, v0?: number): void {
    _m2.copy(m).multiply(_m.makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
    this.batches.add(mat, quadGeo(w, h, u0 ?? x - w / 2, v0 ?? y), _m2);
  }

  private hquad(mat: THREE.Material, m: THREE.Matrix4, x: number, y: number, z: number, w: number, d: number, down = false): void {
    const g = floorGeo(w, d);
    if (down) g.rotateX(Math.PI);
    _m2.copy(m).multiply(_m.makeTranslation(x, y, z));
    this.batches.add(mat, g, _m2);
  }

  /** Interior-mapped pane at face-local (cx, y0) recessed by `depth` */
  private pane(m: THREE.Matrix4, cx: number, y0: number, w: number, h: number, depth: number, seed: number, room: number): void {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(cx, y0 + h / 2, -depth);
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const win = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) win.set([w, h, seed, room], i * 4);
    g.setAttribute('win', new THREE.BufferAttribute(win, 4));
    this.windowGeos.push(g);
  }

  // ---------- building ----------

  build(lot: Lot): void {
    const s = STYLES[lot.style];
    const rot = facingRotation(lot.facing);
    const M = new THREE.Matrix4().makeRotationY(rot).setPosition(lot.x, CURB_H, lot.z);
    const { w, d, h } = lot;
    const faces: Face[] = [
      { key: 'front', m: M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, d / 2)), L: w, blankTo: 0, exposed: true },
      { key: 'back', m: M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -d / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI)), L: w, blankTo: 0, exposed: true },
      { key: 'right', m: M.clone().multiply(new THREE.Matrix4().makeTranslation(w / 2, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), L: d, blankTo: 0, exposed: true },
      { key: 'left', m: M.clone().multiply(new THREE.Matrix4().makeTranslation(-w / 2, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)), L: d, blankTo: 0, exposed: true },
    ];
    for (const f of faces) {
      if (f.key !== 'front') f.blankTo = this.neighbourHeight(lot, f);
    }
    const wallMat = this.wallMat(s);
    const r = rng(hashString(lot.id));
    const parapet = 0.95;
    const hasStore = !lot.backdrop && lot.ground !== 'blank';
    const cornerKey = lot.corner ? this.cornerFace(lot) : null;

    for (const f of faces) {
      const storefront = (f.key === 'front' && hasStore) || (f.key === cornerKey && hasStore);
      const yStart = storefront ? s.gfH : 0;
      // ---- window grid ----
      const margin = 0.9;
      const usable = f.L - margin * 2;
      const bays = Math.max(1, Math.floor(usable / s.bay));
      const bayW = usable / bays;
      const winW = s.ribbon ? bayW - 0.5 : Math.min(s.winW, bayW - 0.8);
      const firstFloor = s.gfH;
      const nFloors = Math.max(0, Math.floor((h - firstFloor - 0.6) / s.floorH));
      const rows: Array<[number, number]> = [];
      for (let fl = 0; fl < nFloors; fl++) {
        const yb = firstFloor + fl * s.floorH + (s.ribbon ? 1.8 : 0.9);
        const yt = yb + s.winH;
        if (yb < f.blankTo + 0.4) continue;
        rows.push([yb, yt]);
      }
      // ground-floor windows on plain faces of exposed buildings
      const gfWindows = !storefront && f.blankTo < 0.5 && !lot.backdrop && f.key !== 'front' && lot.ground !== 'blank';
      if (gfWindows) rows.unshift([1.1, 1.1 + Math.min(s.winH, 2.0)]);
      if (lot.backdrop && f.blankTo < 0.5) rows.unshift([1.0, 1.0 + s.winH]);
      rows.sort((a, b) => a[0] - b[0]);
      const xs: number[] = [];
      for (let b = 0; b < bays; b++) xs.push(-f.L / 2 + margin + bayW * (b + 0.5));

      // ---- wall strips ----
      const top = h + parapet;
      let y = yStart;
      for (const [yb, yt] of rows) {
        if (yb > y) this.quad(wallMat, f.m, 0, y, 0, f.L, yb - y);
        // piers between openings
        let x = -f.L / 2;
        for (const cx of xs) {
          const x0 = cx - winW / 2;
          if (x0 > x) this.quad(wallMat, f.m, (x + x0) / 2, yb, 0, x0 - x, yt - yb);
          x = cx + winW / 2;
        }
        if (f.L / 2 > x) this.quad(wallMat, f.m, (x + f.L / 2) / 2, yb, 0, f.L / 2 - x, yt - yb);
        y = yt;
      }
      if (top > y) this.quad(wallMat, f.m, 0, y, 0, f.L, top - y);
      // parapet inner face + coping
      this.quad(wallMat, f.m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.3)).multiply(new THREE.Matrix4().makeRotationY(Math.PI)), 0, h, 0, f.L - 0.6, parapet);
      this.box(this.trimMat(s.trim), f.m, 0, top, -0.1, f.L + 0.12, 0.12, 0.42);

      // ---- windows ----
      const R = 0.17;
      const frameMat = this.paint(s.frame);
      const trim = this.trimMat(s.trim);
      for (const [yb, yt] of rows) {
        const wh = yt - yb;
        for (const cx of xs) {
          const x0 = cx - winW / 2;
          const x1 = cx + winW / 2;
          // reveals
          this.quad(wallMat, f.m, x0, yb, -R / 2, R, wh, Math.PI / 2, 0, yb);
          this.quad(wallMat, f.m, x1, yb, -R / 2, R, wh, -Math.PI / 2, 0, yb);
          this.hquad(wallMat, f.m, cx, yt, -R / 2, winW, R, true);
          this.hquad(trim, f.m, cx, yb, -R / 2, winW, R);
          // pane
          const seed = r();
          this.pane(f.m, cx, yb, winW, wh, R, seed, s.room);
          // frame + mullions
          const ft = 0.055;
          this.box(frameMat, f.m, cx, yb, -R + 0.03, winW, ft, 0.05, false);
          this.box(frameMat, f.m, cx, yt - ft, -R + 0.03, winW, ft, 0.05, false);
          this.box(frameMat, f.m, x0 + ft / 2, yb, -R + 0.03, ft, wh, 0.05, false);
          this.box(frameMat, f.m, x1 - ft / 2, yb, -R + 0.03, ft, wh, 0.05, false);
          if (s.mullion === 'vertical' || s.mullion === 'cross' || s.mullion === 'grid') {
            this.box(frameMat, f.m, cx, yb, -R + 0.03, 0.045, wh, 0.045, false);
          }
          if (s.mullion === 'cross' || s.mullion === 'grid') {
            this.box(frameMat, f.m, cx, yb + wh * 0.62, -R + 0.03, winW, 0.045, 0.045, false);
          }
          if (s.mullion === 'grid' && winW > 2) {
            this.box(frameMat, f.m, cx - winW / 4, yb, -R + 0.03, 0.04, wh, 0.04, false);
            this.box(frameMat, f.m, cx + winW / 4, yb, -R + 0.03, 0.04, wh, 0.04, false);
          }
          // sill + lintel
          this.box(trim, f.m, cx, yb - 0.08, 0.04, winW + 0.2, 0.08, 0.2, true);
          if (s.lintel) this.box(trim, f.m, cx, yt, 0.015, winW + 0.24, 0.24, 0.07, true);
        }
      }

      // ---- cornice / belt course ----
      if (f.exposed) {
        if (s.cornice === 'heavy') {
          this.box(trim, f.m, 0, h - 0.35, 0.12, f.L + 0.5, 0.35, 0.5);
          this.box(trim, f.m, 0, h - 0.55, 0.06, f.L + 0.3, 0.2, 0.3);
          // dentils
          for (let x = -f.L / 2 + 0.3; x < f.L / 2 - 0.2; x += 0.42) this.box(trim, f.m, x, h - 0.72, 0.06, 0.16, 0.17, 0.14, false);
        } else if (s.cornice === 'light') {
          this.box(trim, f.m, 0, h - 0.2, 0.08, f.L + 0.24, 0.24, 0.3);
        }
        if (storefront) this.box(trim, f.m, 0, s.gfH - 0.12, 0.08, f.L + 0.1, 0.26, 0.24);
      }

      if (storefront) this.groundFloor(lot, s, f, f.key === 'front', r);
    }

    // ---- roof ----
    const roofMat = this.assets.pbr('asphalt_floor', { scale: 3, tint: 0x9a9a98 });
    this.hquad(roofMat, M, 0, h + 0.02, 0, w - 0.05, d - 0.05);
    if (!lot.backdrop || r() < 0.6) this.roofProps(lot, M, r);

    // ---- collision: solid mass to the roof slab + thin parapet walls ----
    const c = Math.cos(rot);
    const sn = Math.abs(Math.sin(rot));
    const hx = (Math.abs(c) * w + sn * d) / 2;
    const hz = (sn * w + Math.abs(c) * d) / 2;
    const tag = { kind: 'static' as const, surface: 'concrete' as const };
    const yTop = CURB_H + h;
    this.physics.aabb(lot.x - hx, 0, lot.z - hz, lot.x + hx, yTop, lot.z + hz, tag);
    const pt = 0.3;
    this.physics.aabb(lot.x - hx, yTop, lot.z - hz, lot.x + hx, yTop + parapet, lot.z - hz + pt, tag);
    this.physics.aabb(lot.x - hx, yTop, lot.z + hz - pt, lot.x + hx, yTop + parapet, lot.z + hz, tag);
    this.physics.aabb(lot.x - hx, yTop, lot.z - hz, lot.x - hx + pt, yTop + parapet, lot.z + hz, tag);
    this.physics.aabb(lot.x + hx - pt, yTop, lot.z - hz, lot.x + hx, yTop + parapet, lot.z + hz, tag);
    if (lot.enter) {
      const fwd = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
      const pos = new THREE.Vector3(lot.x, CURB_H, lot.z).addScaledVector(fwd, d / 2 + 1.3);
      this.doors.push({ lot, position: pos, facing: rot });
    }
  }

  /** Which side face of a corner building faces the street */
  private cornerFace(lot: Lot): 'left' | 'right' | null {
    const rot = facingRotation(lot.facing);
    const right = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const want = lot.corner === 'e' ? new THREE.Vector3(1, 0, 0) : lot.corner === 'w' ? new THREE.Vector3(-1, 0, 0)
      : lot.corner === 's' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
    return right.dot(want) > 0.5 ? 'right' : right.dot(want) < -0.5 ? 'left' : null;
  }

  /** Height of whatever building abuts this face (0 if open) */
  private neighbourHeight(lot: Lot, f: Face): number {
    const centre = new THREE.Vector3(0, 0, 0.6).applyMatrix4(f.m);
    let best = 0;
    for (const o of this.allLots) {
      if (o === lot) continue;
      const rot = facingRotation(o.facing);
      const c = Math.abs(Math.cos(rot));
      const sn = Math.abs(Math.sin(rot));
      const hx = (c * o.w + sn * o.d) / 2 + 0.01;
      const hz = (sn * o.w + c * o.d) / 2 + 0.01;
      if (Math.abs(centre.x - o.x) <= hx && Math.abs(centre.z - o.z) <= hz) best = Math.max(best, o.h);
    }
    return best;
  }

  // ---------- ground floor ----------

  private groundFloor(lot: Lot, s: StyleDef, f: Face, isFront: boolean, r: () => number): void {
    const { L, m } = f;
    const gf = s.gfH;
    const wallMat = this.wallMat(s);
    const trim = this.trimMat(s.trim);
    const dark = this.paint(0x1c1d21, 0.5, 0.4);
    const metal = this.paint(0x2c2f35, 0.35, 0.7);
    const signH = 1.0;
    const signY = gf - signH - 0.25;
    const openTop = signY - 0.12;
    const bulk = 0.55;
    const pier = 0.7;
    const door = isFront && lot.ground !== 'shutter' ? { x: lot.w > 16 ? -L * 0.2 * (r() > 0.5 ? 1 : -1) : 0, w: lot.ground === 'cinema' ? 3.6 : 2.0 } : null;
    if (lot.enter && door) door.x = 0;

    // corner piers + sign band backing
    this.box(wallMat, m, -L / 2 + pier / 2, 0, 0.1, pier, gf, 0.2);
    this.box(wallMat, m, L / 2 - pier / 2, 0, 0.1, pier, gf, 0.2);
    this.quad(wallMat, m, 0, openTop, 0, L, gf - openTop);

    // sign
    if (isFront && lot.sign && lot.ground !== 'cinema') {
      this.box(dark, m, 0, signY, 0.14, L - pier * 2 - 0.2, signH, 0.2);
      const sign = this.signMat(fasciaTexture(lot.sign, lot.accent, lot.style !== 'stucco', lot.style === 'brickRed' || lot.style === 'plasterSage'));
      const sw = Math.min(L - pier * 2 - 0.5, 9);
      const g = new THREE.PlaneGeometry(sw, signH * 0.86);
      g.translate(0, signY + signH / 2, 0.245);
      g.applyMatrix4(m);
      const mesh = new THREE.Mesh(g, sign);
      this.group.add(mesh);
    }

    // openings: door + display windows
    const spans: Array<[number, number]> = [];
    const x0 = -L / 2 + pier;
    const x1 = L / 2 - pier;
    if (door) {
      spans.push([x0, door.x - door.w / 2 - 0.15]);
      spans.push([door.x + door.w / 2 + 0.15, x1]);
    } else spans.push([x0, x1]);

    if (lot.ground === 'shutter') {
      this.shutters(lot, m, x0, x1, openTop, r);
      return;
    }

    // door recess
    if (door) {
      const dd = 0.6;
      const dh = Math.min(2.8, openTop - 0.05);
      const dx0 = door.x - door.w / 2;
      const dx1 = door.x + door.w / 2;
      this.box(metal, m, dx0 - 0.075, 0, 0.0, 0.15, openTop, 0.18);
      this.box(metal, m, dx1 + 0.075, 0, 0.0, 0.15, openTop, 0.18);
      this.quad(wallMat, m, dx0, 0, -dd / 2, dd, openTop, Math.PI / 2, 0, 0);
      this.quad(wallMat, m, dx1, 0, -dd / 2, dd, openTop, -Math.PI / 2, 0, 0);
      this.hquad(dark, m, door.x, openTop, -dd / 2, door.w, dd, true);
      this.hquad(this.assets.pbr('terrazzo_tiles', { scale: 1.5 }), m, door.x, 0.005, -dd / 2, door.w, dd);
      // transom above the door
      this.box(metal, m, door.x, dh, -dd, door.w, 0.08, 0.06, false);
      this.pane(m, door.x, dh + 0.08, door.w, openTop - dh - 0.08, dd + 0.02, r(), 1);
      // two glass leaves
      const leafW = door.w / 2 - 0.02;
      for (const side of [-1, 1]) {
        const lx = door.x + side * (leafW / 2 + 0.01);
        this.box(metal, m, lx, 0, -dd, leafW, 0.12, 0.06, false);
        this.box(metal, m, lx, dh - 0.1, -dd, leafW, 0.1, 0.06, false);
        this.box(metal, m, lx - side * (leafW / 2 - 0.04), 0, -dd, 0.08, dh, 0.06, false);
        this.box(metal, m, lx + side * (leafW / 2 - 0.04), 0, -dd, 0.08, dh, 0.06, false);
        this.box(this.paint(0xc9ccd1, 0.25, 0.9), m, lx - side * 0.25, 1.0, -dd + 0.06, 0.04, 0.5, 0.05, false);
        this.pane(m, lx, 0.12, leafW - 0.1, dh - 0.22, dd + 0.03, r(), lot.enter ? 1 : 0);
      }
      if (lot.enter) {
        // warm welcome light above enterable doors
        this.box(this.lightMat(0xfff1d0, 0.6, 2.2), m, door.x, openTop - 0.06, -dd / 2, door.w * 0.7, 0.04, 0.12, false);
      }
    }

    // display windows with real depth
    for (const [a, b] of spans) {
      const sw = b - a;
      if (sw < 0.8) {
        this.box(wallMat, m, (a + b) / 2, 0, 0.05, sw, openTop, 0.1);
        continue;
      }
      const cx = (a + b) / 2;
      // bulkhead + transom bar
      this.box(lot.ground === 'cafe' ? this.paint(0x3a2a22, 0.6, 0) : dark, m, cx, 0, 0.04, sw, bulk, 0.16);
      this.box(metal, m, cx, openTop - 0.08, 0.02, sw, 0.08, 0.1, false);
      // mullions
      const panes = Math.max(1, Math.round(sw / 2.4));
      for (let i = 0; i <= panes; i++) {
        const mx = a + (sw * i) / panes;
        this.box(metal, m, mx, bulk, 0.0, 0.07, openTop - bulk, 0.08, false);
      }
      // display box
      this.displayBox(lot, m, a, b, bulk, openTop - 0.08, r);
      // glass
      const g = new THREE.PlaneGeometry(sw, openTop - bulk - 0.08);
      g.translate(cx, bulk + (openTop - bulk - 0.08) / 2, -0.03);
      g.applyMatrix4(m);
      this.batches.add(this.glassMat(), g, undefined, false, false);
      // awning
      if (lot.awning && isFront) this.awning(lot, m, cx, sw, gf, openTop);
    }

    if (lot.ground === 'cafe' && isFront) this.cafeExtras(lot, m, L, r);
    if (lot.ground === 'lobby' && isFront) {
      this.box(metal, m, door?.x ?? 0, openTop - 0.02, 0.6, (door?.w ?? 2) + 1.2, 0.16, 1.4);
      this.box(this.lightMat(0xfff2d8, 0.3, 1.8), m, door?.x ?? 0, openTop - 0.05, 0.9, (door?.w ?? 2) + 0.6, 0.03, 0.6, false);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), this.signMat(plateTexture(String(10 + Math.floor(r() * 290))), 0.1, 0.6));
      plate.position.set((door?.x ?? 0) + (door?.w ?? 2) / 2 + 0.45, 2.1, 0.21);
      plate.applyMatrix4(m);
      this.group.add(plate);
    }
  }

  /** Recessed lit display behind storefront glass */
  private displayBox(lot: Lot, m: THREE.Matrix4, a: number, b: number, y0: number, y1: number, r: () => number): void {
    const depth = lot.ground === 'gym' ? 2.2 : 1.0;
    const w = b - a;
    const cx = (a + b) / 2;
    const h = y1 - y0;
    const innerCol = lot.ground === 'cinema' ? 0x3a1418 : 0x34312e;
    const inner = this.mat(`inner|${innerCol}`, () => {
      const m = new THREE.MeshStandardMaterial({ color: innerCol, roughness: 0.85, emissive: innerCol, emissiveIntensity: 0.35 });
      this.lights.register(m, 0.35, 0.9);
      return m;
    });
    const deckMat = this.litPbr(lot.ground === 'cafe' ? 'floor_tiles_06' : 'wood_floor', 1.2, 0.25);
    // shell
    this.hquad(deckMat, m, cx, y0, -depth / 2, w, depth);
    this.hquad(inner, m, cx, y1, -depth / 2, w, depth, true);
    this.quad(inner, m, a, y0, -depth / 2, depth, h, Math.PI / 2, 0, 0);
    this.quad(inner, m, b, y0, -depth / 2, depth, h, -Math.PI / 2, 0, 0);
    // light strip at the top
    this.box(this.lightMat(0xfff4e2, 1.2, 2.4), m, cx, y1 - 0.05, -0.25, w - 0.1, 0.04, 0.08, false);

    // back wall content
    const backM = m.clone().multiply(new THREE.Matrix4().makeTranslation(cx, y0, -depth));
    if (lot.ground === 'gym') {
      // a climbing wall seen through the glass
      const ply = this.litPbr('plywood', 1.5, 0.45);
      const g = quadGeo(w, h, 0, 0);
      g.applyMatrix4(backM);
      this.batches.add(ply, g);
      const holdCols = [0xf3d34a, 0xe8443a, 0x3fa7dd, 0x3ddc7b, 0xb44df0, 0x24262d];
      for (let i = 0; i < Math.round(w * h * 2.2); i++) {
        const hg = new THREE.SphereGeometry(0.06 + r() * 0.06, 6, 5);
        hg.scale(1, 0.75, 0.6);
        hg.translate((r() - 0.5) * (w - 0.3), 0.25 + r() * (h - 0.4), 0.04);
        hg.applyMatrix4(backM);
        this.batches.add(this.paint(holdCols[Math.floor(r() * holdCols.length)], 0.6, 0), hg, undefined, false);
      }
      return;
    }
    const slots = Math.max(1, Math.floor(w / 1.25));
    let artPlaced = 0;
    for (let i = 0; i < slots; i++) {
      const tex = this.display(lot, i);
      if (!tex) continue;
      const pw = Math.min(1.05, w / slots - 0.2);
      const aspect = lot.id === 'records' ? 1 : 1.45;
      const ph = Math.min(h - 0.35, pw * aspect);
      const px = -w / 2 + (w / slots) * (i + 0.5);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 });
      this.lights.register(mat, 0.18, 0.55);
      const pg = new THREE.PlaneGeometry(pw, ph);
      pg.translate(px, h * 0.52, 0.03);
      pg.applyMatrix4(backM);
      this.group.add(new THREE.Mesh(pg, mat));
      // frame
      const fg = boxGeo(pw + 0.08, ph + 0.08, 0.03);
      fg.translate(px, h * 0.52, 0.0);
      fg.applyMatrix4(backM);
      this.batches.add(this.paint(0x15161a, 0.5, 0.2), fg, undefined, false);
      artPlaced++;
    }
    if (!artPlaced) {
      const tex = shelfTexture(hashString(lot.id) + Math.floor(a * 10), lot.accent);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
      this.lights.register(mat, 0.3, 0.8);
      const g = quadGeo(w, h, 0, 0);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w, uv.getY(i) / h);
      g.applyMatrix4(backM);
      this.group.add(new THREE.Mesh(g, mat));
    } else {
      const g = quadGeo(w, h, 0, 0);
      g.applyMatrix4(backM);
      this.batches.add(inner, g);
    }
  }

  private awning(lot: Lot, m: THREE.Matrix4, cx: number, w: number, gf: number, openTop: number): void {
    const t = awningTexture(lot.accent);
    const mat = this.mat(`awning|${lot.accent}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide })) as THREE.MeshStandardMaterial;
    const depth = 1.25;
    const drop = 0.55;
    const y = Math.min(openTop + 0.05, gf - 1.4);
    const len = Math.hypot(depth, drop);
    const g = new THREE.PlaneGeometry(w, len);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 1.6));
    g.rotateX(-Math.PI / 2 + Math.atan2(drop, depth));
    g.translate(cx, y - drop / 2, depth / 2);
    g.applyMatrix4(m);
    this.batches.add(mat, g, undefined, true, true);
    // valance
    const vg = new THREE.PlaneGeometry(w, 0.28);
    const vuv = vg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < vuv.count; i++) vuv.setX(i, vuv.getX(i) * (w / 1.6));
    vg.translate(cx, y - drop - 0.14, depth);
    vg.applyMatrix4(m);
    this.batches.add(mat, vg, undefined, true, true);
  }

  private shutters(lot: Lot, m: THREE.Matrix4, x0: number, x1: number, openTop: number, r: () => number): void {
    const sw = x1 - x0;
    const n = Math.max(1, Math.round(sw / 3.1));
    const step = sw / n;
    const wallMat = this.wallMat(STYLES[lot.style]);
    for (let i = 0; i < n; i++) {
      const cx = x0 + step * (i + 0.5);
      const graffiti = r() < 0.5;
      const scaleX = (step - 0.1) / 3.08;
      const sm = m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, -0.02), new THREE.Quaternion(), new THREE.Vector3(scaleX, Math.min(1.15, (openTop - 0.1) / 2.4), 1)));
      this.inst.add('rollershutter_door', sm, { parts: [graffiti ? 'rollershutter_door_graffiti' : 'rollershutter_door'], castShadow: false });
      const top = 2.4 * Math.min(1.15, (openTop - 0.1) / 2.4);
      if (openTop > top) this.box(wallMat, m, cx, top, 0.0, step, openTop - top, 0.1);
    }
  }

  private cafeExtras(lot: Lot, m: THREE.Matrix4, L: number, r: () => number): void {
    const n = Math.max(1, Math.floor((L - 4) / 3.2));
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 2.2 + i * ((L - 4.4) / Math.max(1, n - 1 || 1));
      const set = this.assets.prop('outdoor_table_chair_set_01');
      set.position.set(x, 0, 1.7);
      set.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.4;
      set.applyMatrix4(m);
      this.group.add(set);
      set.updateMatrixWorld(true);
      this.physics.fromObject(set, 'bounds', { kind: 'static', surface: 'wood' });
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.92), new THREE.MeshStandardMaterial({ map: menuTexture(lot.sign ?? 'MENU', ['espresso  3', 'latte  4.5', 'pastry  3.5', 'matcha  5']), roughness: 0.9 }));
    const easel = new THREE.Group();
    board.position.set(0, 0.62, 0);
    board.rotation.x = -0.12;
    easel.add(board);
    easel.position.set(L / 2 - 1.3, 0, 0.8);
    easel.applyMatrix4(m);
    this.group.add(easel);
  }

  // ---------- roof ----------

  private roofProps(lot: Lot, M: THREE.Matrix4, r: () => number): void {
    const { w, d, h } = lot;
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const part = r() > 0.5 ? 'exterior_aircon_unit' : 'exterior_aircon_unit_rusted';
      const am = M.clone().multiply(new THREE.Matrix4().compose(
        new THREE.Vector3((r() - 0.5) * (w - 4), h, (r() - 0.5) * (d - 4)),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(r() * 4) * (Math.PI / 2)),
        new THREE.Vector3(1.2, 1.2, 1.2)));
      this.inst.add('exterior_aircon_unit', am, { parts: [part] });
    }
    // vents
    const ventMat = this.paint(0x8d9196, 0.4, 0.8);
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const g = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 12);
      g.translate((r() - 0.5) * (w - 2), h + 0.45, (r() - 0.5) * (d - 2));
      g.applyMatrix4(M);
      this.batches.add(ventMat, g);
    }
    // access hut
    if (w > 10 && r() < 0.7) {
      const hx = (r() - 0.5) * (w - 6);
      const hz = (r() - 0.5) * (d - 6);
      this.box(this.wallMat(STYLES[lot.style]), M, hx, h, hz, 2.6, 2.6, 2.4);
      this.hquad(this.assets.pbr('asphalt_floor', { scale: 3, tint: 0x9a9a98 }), M, hx, h + 2.62, hz, 2.7, 2.5);
    }
    // water tower on taller buildings — the classic skyline silhouette
    if (h > 16 && r() < 0.55) this.waterTower(M, (r() - 0.5) * (w - 6), h, (r() - 0.5) * (d - 6));
  }

  private waterTower(M: THREE.Matrix4, x: number, y: number, z: number): void {
    const wood = this.assets.pbr('old_wood_floor', { scaleX: 1.2, scaleY: 2.5, tint: 0xc9a982 });
    const steel = this.paint(0x2e2f33, 0.6, 0.5);
    const legH = 3.4;
    for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const g = new THREE.CylinderGeometry(0.08, 0.1, legH, 8);
      g.translate(x + lx, y + legH / 2, z + lz);
      g.applyMatrix4(M);
      this.batches.add(steel, g);
    }
    this.box(steel, M, x, y + legH, z, 3.0, 0.15, 3.0);
    const tank = new THREE.CylinderGeometry(1.75, 1.85, 3.6, 24, 1, true);
    const uv = tank.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 11, uv.getY(i) * 3.6);
    tank.translate(x, y + legH + 1.95, z);
    tank.applyMatrix4(M);
    this.batches.add(wood, tank);
    const cone = new THREE.ConeGeometry(1.95, 1.3, 24);
    cone.translate(x, y + legH + 4.4, z);
    cone.applyMatrix4(M);
    this.batches.add(steel, cone);
    for (const hy of [0.4, 1.6, 2.8]) {
      const band = new THREE.TorusGeometry(1.84, 0.03, 4, 32);
      band.rotateX(Math.PI / 2);
      band.translate(x, y + legH + 0.15 + hy, z);
      band.applyMatrix4(M);
      this.batches.add(steel, band, undefined, false);
    }
  }

  // ---------- special frontages ----------

  /** Cinema marquee, blade sign and poster cases */
  cinemaFront(lot: Lot, posters: THREE.Texture[]): void {
    const s = STYLES[lot.style];
    const rot = facingRotation(lot.facing);
    const M = new THREE.Matrix4().makeRotationY(rot).setPosition(lot.x, CURB_H, lot.z + 0);
    const f = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, lot.d / 2));
    const gold = this.paint(0xc9a24a, 0.35, 0.8);
    // marquee box
    const mw = lot.w * 0.7;
    const my = s.gfH - 1.45;
    this.box(this.paint(0xece5d6, 0.6, 0.1), f, 0, my, 1.1, mw, 1.6, 2.2);
    this.box(gold, f, 0, my - 0.1, 1.1, mw + 0.2, 0.12, 2.3);
    this.box(gold, f, 0, my + 1.6, 1.1, mw + 0.2, 0.12, 2.3);
    const letters = this.signMat(fasciaTexture('NOW SHOWING · EVERY FILM', 0xff5a4e, true), 0.55, 2.0);
    for (const side of [1]) {
      const g = new THREE.PlaneGeometry(mw - 0.4, 1.2);
      g.translate(0, my + 0.8, 1.1 + side * 1.11);
      g.applyMatrix4(f);
      this.group.add(new THREE.Mesh(g, letters));
    }
    // chasing bulbs (emissive strips)
    this.box(this.lightMat(0xffe2a0, 1.4, 3.2), f, 0, my + 1.48, 2.21, mw - 0.1, 0.08, 0.04, false);
    this.box(this.lightMat(0xffe2a0, 1.4, 3.2), f, 0, my + 0.04, 2.21, mw - 0.1, 0.08, 0.04, false);
    // underside lights
    this.box(this.lightMat(0xfff4dd, 1.0, 2.6), f, 0, my - 0.03, 1.1, mw - 0.6, 0.03, 1.8, false);
    // blade sign
    const blade = this.signMat(bladeTexture(lot.sign ?? 'CINEMA', lot.accent), 0.6, 2.0);
    const bladeG = new THREE.BoxGeometry(0.35, 6.5, 1.6);
    const bm = new THREE.Mesh(bladeG, [this.paint(0x1a1b20), this.paint(0x1a1b20), this.paint(0x1a1b20), this.paint(0x1a1b20), blade, blade]);
    bm.rotation.y = Math.PI / 2;
    bm.position.set(-lot.w / 2 + 1.6, s.gfH + 4.0, 0.9);
    const holder = new THREE.Group();
    holder.add(bm);
    holder.applyMatrix4(f);
    this.group.add(holder);
    // poster cases flanking the doors
    const caseMat = this.paint(0x15161a, 0.4, 0.5);
    const slots = [-lot.w / 2 + 2.4, -lot.w / 2 + 4.2, lot.w / 2 - 4.2, lot.w / 2 - 2.4];
    slots.forEach((x, i) => {
      this.box(gold, f, x, 0.6, 0.08, 1.28, 2.0, 0.12);
      this.box(caseMat, f, x, 0.66, 0.1, 1.16, 1.88, 0.12);
      const tex = posters[i];
      if (!tex) return;
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.5 });
      this.lights.register(m, 0.25, 0.8);
      const g = new THREE.PlaneGeometry(1.04, 1.62);
      g.translate(x, 0.66 + 0.94, 0.165);
      g.applyMatrix4(f);
      this.group.add(new THREE.Mesh(g, m));
    });
    // ticket booth
    this.box(this.paint(0x7d1f24, 0.5, 0.2), f, 0, 0, 0.6, 1.6, 1.1, 1.0);
    this.box(gold, f, 0, 1.1, 0.6, 1.7, 0.08, 1.1);
    this.physics.aabb(lot.x - 0.85, CURB_H, lot.z + lot.d / 2 + 0.05, lot.x + 0.85, CURB_H + 1.2, lot.z + lot.d / 2 + 1.15, { kind: 'static', surface: 'wood' });
  }

  /** Climbing gym mural across the upper street face */
  gymMural(lot: Lot): void {
    const s = STYLES[lot.style];
    const rot = facingRotation(lot.facing);
    const f = new THREE.Matrix4().makeRotationY(rot).setPosition(lot.x, CURB_H, lot.z).multiply(new THREE.Matrix4().makeTranslation(0, 0, lot.d / 2));
    const tex = muralTexture('CLIMBING GYM', 'BOULDERING · EST. 2026', lot.accent);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 });
    this.lights.register(m, 0.05, 0.4);
    const h = lot.h - s.gfH - 1.2;
    const g = new THREE.PlaneGeometry(lot.w - 1.2, h);
    g.translate(0, s.gfH + 0.6 + h / 2, 0.03);
    g.applyMatrix4(f);
    this.group.add(new THREE.Mesh(g, m));
  }

  finalize(parent: THREE.Object3D): void {
    this.inst.flush(this.group);
    this.batches.build(this.group);
    if (this.windowGeos.length) {
      const merged = mergeGeometries(this.windowGeos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, this.windowMaterial);
        mesh.receiveShadow = false;
        // The wall strips leave real openings; panes must block sunlight
        mesh.castShadow = true;
        this.group.add(mesh);
      }
      this.windowGeos = [];
    }
    parent.add(this.group);
  }
}
