// Streets: road surface + markings, sidewalks + curbs, street furniture,
// traffic lights (animated), street signs, bus shelter, parked cars and the
// barricaded exits that bound the playable area.

import * as THREE from 'three';
import type { Assets } from '../engine/Assets';
import type { Physics } from '../engine/Physics';
import { Batches, boxGeo, floorGeo } from './geo';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLOCK, CURB, CURB_H, OUTER_FRONT, ROAD_OUT, ALLEY, PARK, STREET_NAMES, type Lot } from './layout';
import { streetSignTexture } from './Signage';
import { streetWear } from './Weathering';
import { rng } from '../engine/math';
import type { NightLights } from './NightLights';

export interface StreetResult {
  group: THREE.Group;
  treeSpots: Array<{ x: number; z: number; s: number }>;
  update: (dt: number, time: number) => void;
  busPosterSlot: THREE.MeshStandardMaterial;
  kiosk: THREE.Vector3;
}

const FAR = 220;

export function buildStreets(assets: Assets, physics: Physics, lights: NightLights, lots: Lot[]): StreetResult {
  const group = new THREE.Group();
  const B = new Batches();
  const r = rng(4242);
  const asphalt = streetWear(assets.pbr('asphalt_02', { scale: 7, normalScale: 0.8 }).clone());
  const walk = assets.pbr('concrete_tiles_02', { scale: 2.4 });
  const curbMat = assets.pbr('brushed_concrete', { scale: 1.6, tint: 0xd8d4cc });
  const alleyMat = assets.pbr('asphalt_floor', { scale: 4, tint: 0x9a9690 });
  const paintW = new THREE.MeshStandardMaterial({ color: 0xe9e7df, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const paintY = new THREE.MeshStandardMaterial({ color: 0xe6b437, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.6, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.45, metalness: 0.75 });

  // ---- road surface (one big plane under everything) ----
  B.put(asphalt, floorGeo(FAR * 2, FAR * 2), 0, 0, 0);
  physics.aabb(-FAR, -1, -FAR, FAR, 0, FAR, { kind: 'static', surface: 'asphalt' });

  // ---- raised land: 3×3 regions split by the road corridors ----
  const xs: Array<[number, number]> = [[-FAR, -ROAD_OUT.x], [-CURB.x, CURB.x], [ROAD_OUT.x, FAR]];
  const zs: Array<[number, number]> = [[-FAR, -ROAD_OUT.z], [-CURB.z, CURB.z], [ROAD_OUT.z, FAR]];
  for (const [x0, x1] of xs) {
    for (const [z0, z1] of zs) {
      const w = x1 - x0;
      const d = z1 - z0;
      const g = boxGeo(w, CURB_H, d);
      g.translate((x0 + x1) / 2, CURB_H / 2, (z0 + z1) / 2);
      B.add(walk, g, undefined, false, true);
      physics.aabb(x0, 0, z0, x1, CURB_H, z1, { kind: 'static', surface: 'concrete' });
      // curb stones along every edge facing a road
      const cw = 0.3;
      const edges: Array<[number, number, number, number]> = [];
      if (x0 > -FAR) edges.push([x0 + cw / 2, (z0 + z1) / 2, cw, d]);
      if (x1 < FAR) edges.push([x1 - cw / 2, (z0 + z1) / 2, cw, d]);
      if (z0 > -FAR) edges.push([(x0 + x1) / 2, z0 + cw / 2, w, cw]);
      if (z1 < FAR) edges.push([(x0 + x1) / 2, z1 - cw / 2, w, cw]);
      for (const [cx, cz, ew, ed] of edges) {
        const cg = boxGeo(ew, CURB_H + 0.012, ed);
        cg.translate(cx, (CURB_H + 0.012) / 2, cz);
        B.add(curbMat, cg, undefined, false, true);
      }
    }
  }
  // alley surface
  {
    const g = floorGeo(ALLEY.maxX - ALLEY.minX, BLOCK.maxZ - BLOCK.minZ);
    g.translate((ALLEY.minX + ALLEY.maxX) / 2, CURB_H + 0.004, 0);
    B.add(alleyMat, g, undefined, false, true);
    physics.box((ALLEY.minX + ALLEY.maxX) / 2, CURB_H - 0.05, 0, 3, 0.05, 30, undefined, { kind: 'static', surface: 'asphalt' });
  }

  // ---- markings ----
  const lineH = 0.012;
  const addLine = (mat: THREE.Material, x: number, z: number, w: number, d: number) => {
    const g = floorGeo(w, d);
    g.translate(x, lineH, z);
    B.add(mat, g, undefined, false, true);
  };
  const midZ = (CURB.z + ROAD_OUT.z) / 2;
  const midX = (CURB.x + ROAD_OUT.x) / 2;
  // centre double yellow, lane edge lines (skip inside intersections)
  for (const sz of [-1, 1]) {
    for (const seg of [[-FAR, -ROAD_OUT.x], [-CURB.x, CURB.x], [ROAD_OUT.x, FAR]]) {
      const [a, b] = seg;
      const len = b - a - (seg[0] === -CURB.x ? 6 : 0);
      const cx = (a + b) / 2;
      addLine(paintY, cx, sz * midZ - 0.12, len, 0.12);
      addLine(paintY, cx, sz * midZ + 0.12, len, 0.12);
      addLine(paintW, cx, sz * (CURB.z + 2.2), len, 0.12);
      addLine(paintW, cx, sz * (ROAD_OUT.z - 2.2), len, 0.12);
    }
  }
  for (const sx of [-1, 1]) {
    for (const seg of [[-FAR, -ROAD_OUT.z], [-CURB.z, CURB.z], [ROAD_OUT.z, FAR]]) {
      const [a, b] = seg;
      const len = b - a - (seg[0] === -CURB.z ? 6 : 0);
      const cz = (a + b) / 2;
      addLine(paintY, sx * midX - 0.12, cz, 0.12, len);
      addLine(paintY, sx * midX + 0.12, cz, 0.12, len);
      addLine(paintW, sx * (CURB.x + 2.2), cz, 0.12, len);
      addLine(paintW, sx * (ROAD_OUT.x - 2.2), cz, 0.12, len);
    }
  }
  // crosswalks + stop lines on every leg of the four intersections
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ix = sx * midX;
      const iz = sz * midZ;
      const half = 5.5;
      // legs along X (crossing the E–W road)
      for (const dir of [-1, 1]) {
        const cx = ix + dir * (half + 2.2);
        for (let k = -4; k <= 4; k++) addLine(paintW, cx, iz + k * 1.15, 3.2, 0.55);
        addLine(paintW, ix + dir * (half + 4.3), iz + dir * 2.7, 0.35, 5.0);
      }
      // legs along Z
      for (const dir of [-1, 1]) {
        const cz = iz + dir * (half + 2.2);
        for (let k = -4; k <= 4; k++) addLine(paintW, ix + k * 1.15, cz, 0.55, 3.2);
        addLine(paintW, ix - dir * 2.7, iz + dir * (half + 4.3), 5.0, 0.35);
      }
    }
  }
  // manholes + drains
  const manhole = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.55, metalness: 0.6 });
  for (let i = 0; i < 10; i++) {
    const g = new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20);
    const onX = r() < 0.5;
    const t = (r() - 0.5) * 80;
    const s = r() < 0.5 ? -1 : 1;
    g.translate(onX ? t : s * (midX + 2), 0.01, onX ? s * (midZ + 2) : t * 0.7);
    B.add(manhole, g, undefined, false, true);
  }

  // ---- street furniture along the block sidewalk ----
  const treeSpots: Array<{ x: number; z: number; s: number }> = [];
  const doorsAt = lots.filter((l) => !l.backdrop).map((l) => ({ x: l.x, z: l.z, l }));
  void doorsAt;
  // Repeated furniture is recorded here and flushed as InstancedMeshes
  const recorded = new Map<string, { opts: Record<string, unknown>; mats: THREE.Matrix4[]; collide: boolean; surface: 'metal' | 'wood' | 'concrete'; y: number }>();
  const place = (id: string, x: number, z: number, ry: number, opts: Record<string, unknown> = {}, collide: 'bounds' | 'none' = 'bounds', surface: 'metal' | 'wood' | 'concrete' = 'metal', y = CURB_H) => {
    const key = `${id}|${JSON.stringify(opts)}`;
    let rec = recorded.get(key);
    if (!rec) recorded.set(key, (rec = { opts, mats: [], collide: collide !== 'none', surface, y }));
    rec.mats.push(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  };
  const flushInstances = () => {
    for (const [key, rec] of recorded) {
      const id = key.split('|')[0];
      const { group: ig, bounds } = assets.instanced(id, rec.mats, rec.opts);
      group.add(ig);
      if (!rec.collide) continue;
      for (const m of rec.mats) {
        const b = bounds.clone().applyMatrix4(m);
        physics.aabb(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, { kind: 'static', surface: rec.surface });
      }
    }
  };

  // Sidewalk lines: inset from curb (kerb zone) on each side of the block
  const kerb = 0.85;
  const sides = [
    { axis: 'x' as const, fixed: CURB.z - kerb, from: -CURB.x + 6, to: CURB.x - 6, ry: 0, out: 1 },     // south
    { axis: 'x' as const, fixed: -CURB.z + kerb, from: -CURB.x + 6, to: CURB.x - 6, ry: Math.PI, out: -1 }, // north
    { axis: 'z' as const, fixed: -CURB.x + kerb, from: -CURB.z + 6, to: CURB.z - 6, ry: -Math.PI / 2, out: -1 }, // west
    { axis: 'z' as const, fixed: CURB.x - kerb, from: -CURB.z + 6, to: CURB.z - 6, ry: Math.PI / 2, out: 1 },   // east
  ];
  const lampMat = lights;
  const glowSpots: THREE.Vector3[] = [];
  for (const sd of sides) {
    const at = (t: number, off = 0) => (sd.axis === 'x' ? { x: t, z: sd.fixed - sd.out * off } : { x: sd.fixed - sd.out * off, z: t });
    // skip the alley mouth and park edges for trees / furniture where they'd block
    const blocked = (t: number) => {
      const p = at(t);
      if (Math.abs(p.x - (ALLEY.minX + ALLEY.maxX) / 2) < 4.5 && Math.abs(p.z) > 25) return true;
      return false;
    };
    // lamps every ~17 m
    for (let t = sd.from; t <= sd.to + 0.1; t += 17) {
      if (blocked(t)) continue;
      const p = at(t);
      place('street_lamp_01', p.x, p.z, sd.ry, {}, 'none');
      physics.cylinder(p.x, CURB_H + 1.9, p.z, 1.9, 0.14, { kind: 'static', surface: 'metal' });
      const head = new THREE.Vector3(p.x, CURB_H + 3.55, p.z);
      lampMat.addLamp(head);
      glowSpots.push(head);
    }
    // trees between lamps
    for (let t = sd.from + 8.5; t <= sd.to; t += 17) {
      if (blocked(t)) continue;
      const p = at(t);
      // keep the park side free (the park has its own trees)
      if (p.x > PARK.minX && p.z < PARK.maxZ + 1 && sd.axis === 'x') continue;
      treeSpots.push({ x: p.x, z: p.z, s: 0.85 + r() * 0.35 });
      // tree pit grate
      const grate = boxGeo(1.4, 0.02, 1.4);
      grate.translate(p.x, CURB_H + 0.01, p.z);
      B.add(steel, grate, undefined, false, true);
    }
    // benches, bins, newspaper boxes, bike racks
    for (let t = sd.from + 4; t <= sd.to; t += 17) {
      if (blocked(t) || r() < 0.25) continue;
      const p = at(t, 0.1);
      const pick = r();
      if (pick < 0.4) place('painted_wooden_bench', p.x, p.z, sd.ry + Math.PI, {}, 'bounds', 'wood');
      else if (pick < 0.65) place('metal_trash_can', p.x, p.z, sd.ry, { parts: ['metal_trash_can', 'metal_trash_can_handle_left', 'metal_trash_can_handle_right'] });
      else if (pick < 0.85) newsBox(group, physics, p.x, p.z, sd.ry, r);
      else bikeRack(B, steel, physics, p.x, p.z, sd.ry);
    }
  }
  // hydrants near each block corner
  for (const [x, z] of [[-CURB.x + 2.2, CURB.z - 0.8], [CURB.x - 2.2, CURB.z - 0.8], [-CURB.x + 2.2, -CURB.z + 0.8], [CURB.x - 2.2, -CURB.z + 0.8]]) {
    place('fire_hydrant', x, z, r() * Math.PI, { parts: ['fire_hydrant', 'fire_hydrant_cap_01', 'fire_hydrant_cap_02', 'fire_hydrant_cap_03', 'fire_hydrant_chain'] });
  }
  // outer sidewalk lamps (opposite side of the street)
  for (const sz of [-1, 1]) {
    for (let x = -CURB.x + 10; x < CURB.x; x += 22) {
      const z = sz * (ROAD_OUT.z + 0.8);
      place('street_lamp_01', x, z, sz > 0 ? Math.PI : 0, {}, 'none');
      physics.cylinder(x, CURB_H + 1.9, z, 1.9, 0.14, { kind: 'static', surface: 'metal' });
      lampMat.addLamp(new THREE.Vector3(x, CURB_H + 3.55, z));
    }
  }
  for (const sx of [-1, 1]) {
    for (let z = -CURB.z + 10; z < CURB.z; z += 22) {
      const x = sx * (ROAD_OUT.x + 0.8);
      place('street_lamp_01', x, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, {}, 'none');
      physics.cylinder(x, CURB_H + 1.9, z, 1.9, 0.14, { kind: 'static', surface: 'metal' });
      lampMat.addLamp(new THREE.Vector3(x, CURB_H + 3.55, z));
    }
  }

  // ---- parked cars (under covers) in the parking lanes ----
  const carSpots: Array<[number, number, number]> = [
    [-30, CURB.z + 1.1, Math.PI / 2], [-22, CURB.z + 1.1, Math.PI / 2], [24, CURB.z + 1.1, -Math.PI / 2],
    [-14, -(CURB.z + 1.1), Math.PI / 2], [30, -(ROAD_OUT.z - 1.1), -Math.PI / 2], [10, ROAD_OUT.z - 1.1, Math.PI / 2],
    [-(CURB.x + 1.1), 20, 0], [CURB.x + 1.1, -14, Math.PI], [ROAD_OUT.x - 1.1, 8, 0], [-(ROAD_OUT.x - 1.1), -22, Math.PI],
  ];
  for (const [x, z, ry] of carSpots) place('covered_car', x, z, ry + (r() - 0.5) * 0.04, {}, 'bounds', 'metal', 0);

  // ---- traffic lights at the 4 block corners ----
  const signals: Array<{ mats: THREE.MeshStandardMaterial[]; axis: 'x' | 'z' }> = [];
  const lensOff = 0x1a1a1a;
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2f3a2a, roughness: 0.5, metalness: 0.3 });
  const lensParts: Record<'x' | 'z', THREE.BufferGeometry[][]> = { x: [[], [], []], z: [[], [], []] };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (CURB.x - 0.6);
      const pz = sz * (CURB.z - 0.6);
      const pole = new THREE.CylinderGeometry(0.11, 0.13, 6.2, 12);
      pole.translate(px, CURB_H + 3.1, pz);
      B.add(steel, pole);
      physics.cylinder(px, CURB_H + 3.1, pz, 3.1, 0.14, { kind: 'static', surface: 'metal' });
      // mast arm over the road running along X (serves traffic on that road)
      const armLen = 6.5;
      const arm = new THREE.CylinderGeometry(0.07, 0.09, armLen, 8);
      arm.rotateZ(Math.PI / 2);
      arm.translate(px - sx * armLen / 2 * 0 + sx * 0, CURB_H + 5.9, pz);
      const armM = new THREE.Matrix4().makeTranslation(px + sx * (armLen / 2), CURB_H + 5.9, pz + sz * 0);
      const armG = new THREE.CylinderGeometry(0.07, 0.09, armLen, 8);
      armG.rotateZ(Math.PI / 2);
      armG.applyMatrix4(armM);
      B.add(steel, armG);
      // two signal heads: one on the arm (facing traffic on the N–S street), one on the pole.
      // Housings/visors merge into the static batch; lenses merge per (axis, colour)
      // so every head facing the same road shares one draw per colour.
      for (const [hx, hz, ry, axis] of [[px + sx * (armLen - 0.6), pz, sz > 0 ? 0 : Math.PI, 'x'], [px, pz + sz * 0.3, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 'z']] as Array<[number, number, number, 'x' | 'z']>) {
        const hm = new THREE.Matrix4().makeRotationY(ry).setPosition(hx, axis === 'x' ? CURB_H + 5.3 : CURB_H + 3.4, hz);
        const housing = boxGeo(0.36, 1.05, 0.3);
        housing.applyMatrix4(hm);
        B.add(housingMat, housing);
        for (let i = 0; i < 3; i++) {
          const visor = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 12, 1, true, -Math.PI / 2, Math.PI);
          visor.rotateX(Math.PI / 2);
          visor.translate(0, 0.35 - i * 0.32, 0.22);
          visor.applyMatrix4(hm);
          B.add(housingMat, visor, undefined, false);
          const lens = new THREE.CircleGeometry(0.11, 16);
          lens.translate(0, 0.32 - i * 0.32, 0.152);
          lens.applyMatrix4(hm);
          lensParts[axis][i].push(lens);
        }
      }
      // street name blades on top of the pole
      for (const [name, ry] of [[sz > 0 ? STREET_NAMES.s : STREET_NAMES.n, 0], [sx > 0 ? STREET_NAMES.e : STREET_NAMES.w, Math.PI / 2]] as Array<[string, number]>) {
        const t = streetSignTexture(name);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 0.03), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
        blade.position.set(px, CURB_H + 6.45 + (ry ? 0.36 : 0), pz);
        blade.rotation.y = ry;
        group.add(blade);
      }
    }
  }

  for (const axis of ['x', 'z'] as const) {
    const mats = [0xff3b2f, 0xffb21e, 0x2fe06b].map((c) => new THREE.MeshStandardMaterial({ color: lensOff, emissive: c, emissiveIntensity: 0, roughness: 0.3 }));
    mats.forEach((m, i) => {
      const merged = mergeGeometries(lensParts[axis][i].map((g) => g.toNonIndexed()));
      if (merged) group.add(new THREE.Mesh(merged, m));
    });
    signals.push({ mats, axis });
  }

  // ---- bus shelter on Atyansh Ave ----
  const busX = 2;
  const busZ = CURB.z - 1.25;
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8c0d0, transparent: true, opacity: 0.25, roughness: 0.05, envMapIntensity: 2 });
  {
    const posts: Array<[number, number]> = [[-1.9, -0.7], [1.9, -0.7], [-1.9, 0.6], [1.9, 0.6]];
    for (const [ox, oz] of posts) {
      const g = boxGeo(0.08, 2.55, 0.08);
      g.translate(busX + ox, CURB_H + 1.275, busZ + oz);
      B.add(steel, g);
    }
    const roof = boxGeo(4.2, 0.12, 1.7);
    roof.translate(busX, CURB_H + 2.6, busZ);
    B.add(steel, roof);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.0), glass);
    back.position.set(busX, CURB_H + 1.3, busZ - 0.7);
    group.add(back);
    const bench = boxGeo(2.6, 0.08, 0.4);
    bench.translate(busX + 0.3, CURB_H + 0.48, busZ - 0.45);
    B.add(new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.7 }), bench);
    physics.aabb(busX - 2, CURB_H, busZ - 0.75, busX + 2, CURB_H + 2.7, busZ - 0.62, { kind: 'static', surface: 'metal', cameraIgnore: true });
    physics.aabb(busX - 1, CURB_H, busZ - 0.65, busX + 1.6, CURB_H + 0.52, busZ - 0.25, { kind: 'static', surface: 'wood' });
  }
  // lightbox ad panel (filled with a real poster by the city builder)
  const busPosterSlot = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.4 });
  lights.register(busPosterSlot, 0.4, 1.2);
  {
    const box = boxGeo(1.4, 2.1, 0.18);
    box.translate(busX - 2.3, CURB_H + 1.05, busZ);
    B.add(steel, box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), busPosterSlot);
    face.position.set(busX - 2.3, CURB_H + 1.1, busZ + 0.095);
    group.add(face);
    physics.aabb(busX - 3.0, CURB_H, busZ - 0.1, busX - 1.6, CURB_H + 2.1, busZ + 0.1, { kind: 'static', surface: 'metal' });
  }

  // ---- barricaded exits (8 road legs leaving the map) ----
  const barrierTag = { kind: 'static' as const, surface: 'concrete' as const };
  const exits: Array<{ x: number; z: number; alongX: boolean }> = [];
  for (const s of [-1, 1]) {
    exits.push({ x: s * (OUTER_FRONT.x + 2), z: midZ, alongX: false }, { x: s * (OUTER_FRONT.x + 2), z: -midZ, alongX: false });
    exits.push({ x: midX, z: s * (OUTER_FRONT.z + 2), alongX: true }, { x: -midX, z: s * (OUTER_FRONT.z + 2), alongX: true });
  }
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 });
  const coneBand = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  for (const e of exits) {
    for (let k = -2; k <= 2; k++) {
      const off = k * 1.75;
      place('concrete_road_barrier', e.alongX ? e.x + off : e.x, e.alongX ? e.z : e.z + off, e.alongX ? 0 : Math.PI / 2, {}, 'none', 'concrete', 0);
    }
    // cones in front
    for (let k = -3; k <= 3; k += 2) {
      const cx = e.alongX ? e.x + k * 1.3 : e.x - Math.sign(e.x) * 1.4;
      const cz = e.alongX ? e.z - Math.sign(e.z) * 1.4 : e.z + k * 1.3;
      const cone = new THREE.ConeGeometry(0.2, 0.7, 16);
      cone.translate(cx, 0.35, cz);
      B.add(coneMat, cone);
      const band = new THREE.CylinderGeometry(0.12, 0.15, 0.12, 16, 1, true);
      band.translate(cx, 0.42, cz);
      B.add(coneBand, band, undefined, false);
    }
    // invisible wall across the whole corridor
    const half = 6;
    if (e.alongX) physics.aabb(e.x - half, 0, e.z - 0.5, e.x + half, 6, e.z + 0.5, barrierTag);
    else physics.aabb(e.x - 0.5, 0, e.z - half, e.x + 0.5, 6, e.z + half, barrierTag);
  }

  // ---- newsstand kiosk (blog) at the SE corner ----
  // against the anime café's east wall, out of the pedestrian flow
  const kiosk = new THREE.Vector3(BLOCK.maxX + 1.0, CURB_H, BLOCK.maxZ - 3.2);
  {
    const kg = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(2.6, 2.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x24533e, roughness: 0.55, metalness: 0.2 }));
    body.position.y = 1.2;
    body.castShadow = body.receiveShadow = true;
    kg.add(body);
    const roof = new THREE.Mesh(boxGeo(3.2, 0.14, 2.4), steel);
    roof.position.y = 2.5;
    roof.castShadow = true;
    kg.add(roof);
    kg.position.copy(kiosk);
    kg.rotation.y = Math.PI / 2;
    group.add(kg);
    physics.aabb(kiosk.x - 0.9, CURB_H, kiosk.z - 1.3, kiosk.x + 0.9, CURB_H + 2.6, kiosk.z + 1.3, { kind: 'static', surface: 'metal' });
  }

  // overhead utility cables sagging across the streets (catenary curves)
  {
    const wire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const span = (ax: number, az: number, bx: number, bz: number, y: number, sag: number) => {
      const a = new THREE.Vector3(ax, y, az);
      const b = new THREE.Vector3(bx, y, bz);
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
      }
      B.add(wire, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4, false), undefined, false);
    };
    for (const x of [-34, -6, 22, 40]) for (const sz of [-1, 1]) {
      span(x, sz * (CURB.z - 4.6), x + 3 * (r() - 0.5), sz * (OUTER_FRONT.z + 0.4), 9 + r() * 3, 0.9);
      span(x + 0.6, sz * (CURB.z - 4.6), x + 0.6 + 3 * (r() - 0.5), sz * (OUTER_FRONT.z + 0.4), 8.4 + r() * 3, 1.1);
    }
    for (const z of [-18, 6, 20]) for (const sx of [-1, 1]) span(sx * (CURB.x - 4.6), z, sx * (OUTER_FRONT.x + 0.4), z + 3 * (r() - 0.5), 9 + r() * 3, 0.9);
  }

  flushInstances();
  // glowing glass inside every lantern: one instanced draw
  {
    const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0.1 });
    lights.register(m, 0.1, 6);
    const glows = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), m, glowSpots.length);
    glowSpots.forEach((p, i) => glows.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    glows.computeBoundingSphere();
    group.add(glows);
  }
  B.build(group);

  // traffic signal cycle: x-road green 10s, amber 2s, all-red 1s, then z-road
  const update = (_dt: number, time: number) => {
    const t = time % 26;
    const phase = (axis: 'x' | 'z') => {
      const tt = axis === 'x' ? t : (t + 13) % 26;
      return tt < 10 ? 2 : tt < 12 ? 1 : 0;
    };
    for (const s of signals) {
      const p = phase(s.axis);
      s.mats.forEach((m, i) => { m.emissiveIntensity = (i === 0 && p === 0) || (i === 1 && p === 1) || (i === 2 && p === 2) ? 2.6 : 0; });
    }
  };

  return { group, treeSpots, update, busPosterSlot, kiosk };
}

function newsBox(group: THREE.Group, physics: Physics, x: number, z: number, ry: number, r: () => number): void {
  const cols = [0x2f6fd6, 0xd63a2f, 0xf2c230, 0x2f9e5a];
  const c = cols[Math.floor(r() * cols.length)];
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo(0.5, 1.0, 0.45), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.3 }));
  body.position.y = 0.6;
  body.castShadow = true;
  g.add(body);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), new THREE.MeshStandardMaterial({ color: 0xd9e2e8, roughness: 0.1, metalness: 0.2 }));
  win.position.set(0, 0.8, 0.226);
  g.add(win);
  const leg = new THREE.Mesh(boxGeo(0.06, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  leg.position.y = 0.05;
  g.add(leg);
  g.position.set(x, CURB_H, z);
  g.rotation.y = ry;
  group.add(g);
  physics.aabb(x - 0.3, CURB_H, z - 0.3, x + 0.3, CURB_H + 1.1, z + 0.3, { kind: 'static', surface: 'metal' });
}

function bikeRack(B: Batches, steel: THREE.Material, physics: Physics, x: number, z: number, ry: number): void {
  for (let i = -1; i <= 1; i++) {
    const g = new THREE.TorusGeometry(0.38, 0.03, 6, 16, Math.PI);
    g.translate(i * 0.55, CURB_H + 0.02, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z));
    B.add(steel, g);
  }
  physics.aabb(x - 0.9, CURB_H, z - 0.9, x + 0.9, CURB_H + 0.42, z + 0.9, { kind: 'static', surface: 'metal' });
}
