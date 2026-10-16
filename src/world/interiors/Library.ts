// LIBRARY — floor-to-ceiling shelving full of spines with every real cover
// face-out among them, a rolling ladder, reading table with banker's lamps,
// an armchair nook and a "currently reading" lectern.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room, type Placed } from './Room';
import { sit } from '../game/Activity';
import { bookItems } from './items';
import { boxGeo } from '../world/geo';
import { rng } from '../engine/math';

const W = 16;
const D = 20;
const H = 5.4;

export function buildLibrary(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const books = game.data.books ?? [];
  room.shell({ floor: 'wood_floor', floorScale: 1.5, floorTint: 0xd8b48e, wall: 'painted_plaster_wall', wallScale: 3, wallTint: 0xefe2c8, ceiling: 0xf2ead8, baseboard: 0x3a2618, crown: true, surface: 'wood' });
  const wood = assets.pbr('wood_floor', { scale: 1.2, tint: 0x6a4228 });
  const r = rng(88);
  const open = (start: number) => game.browse({ heading: 'Bookshelf · Goodreads', accent: '#e8c56a', items: bookItems(game.data), start, aspect: 1.5 });

  // wainscoting
  for (const [x, z, len, ry] of [[0, -D / 2 + 0.02, W, 0], [-W / 2 + 0.02, 0, D, Math.PI / 2], [W / 2 - 0.02, 0, D, -Math.PI / 2]] as Array<[number, number, number, number]>) {
    const g = boxGeo(len, 1.1, 0.04);
    g.rotateY(ry);
    g.translate(x, 0.55, z);
    room.B.add(wood, g, undefined, false);
  }

  // ---- shelving units along the walls ----
  const unitW = 1.2;
  const shelfH = 4.1;
  const depth = 0.38;
  const shelves = 6;
  const pitch = shelfH / shelves;
  type Unit = { x: number; z: number; ry: number };
  const units: Unit[] = [];
  for (let z = -D / 2 + 1.2; z < D / 2 - 2.6; z += unitW) units.push({ x: -W / 2 + depth / 2 + 0.02, z: z + unitW / 2, ry: Math.PI / 2 });
  for (let z = -D / 2 + 1.2; z < D / 2 - 2.6; z += unitW) units.push({ x: W / 2 - depth / 2 - 0.02, z: z + unitW / 2, ry: -Math.PI / 2 });
  for (let x = -W / 2 + 1.0; x < W / 2 - 1.0; x += unitW) {
    if (Math.abs(x + unitW / 2) < 1.5) continue; // window gap behind the lectern wall art
    units.push({ x: x + unitW / 2, z: -D / 2 + depth / 2 + 0.02, ry: 0 });
  }
  const spineGeo = new THREE.BoxGeometry(1, 1, 1);
  spineGeo.translate(0, 0.5, 0);
  const spineMats: THREE.Matrix4[] = [];
  const spineCols: THREE.Color[] = [];
  const palette = [0x7a2a24, 0x2c4a3a, 0x2f3d5c, 0x8a6a2c, 0x5b3550, 0x3c5a5e, 0xc9b48a, 0x1e2a3a, 0x6b3a22, 0x9a3a2a, 0x2a2a2a, 0xd8cdb4];
  let coverIdx = 0;
  const coverSpots: Placed[] = [];
  const coversPerUnit = Math.max(1, Math.ceil(books.length / units.length));
  for (const u of units) {
    const M = new THREE.Matrix4().makeRotationY(u.ry).setPosition(u.x, 0, u.z);
    // carcass: sides, back, shelves (merged per room)
    const parts: Array<[number, number, number, number, number, number]> = [
      [unitW, shelfH, 0.03, 0, shelfH / 2, -depth / 2 + 0.015],
      [0.04, shelfH, depth, -unitW / 2 + 0.02, shelfH / 2, 0],
      [0.04, shelfH, depth, unitW / 2 - 0.02, shelfH / 2, 0],
      [unitW + 0.06, 0.08, depth + 0.06, 0, shelfH + 0.04, 0],
    ];
    for (let s = 0; s <= shelves; s++) parts.push([unitW - 0.04, 0.035, depth, 0, s * pitch, 0]);
    for (const [w, h, d, x, y, z] of parts) {
      const g = boxGeo(w, h, d);
      g.translate(x, y, z);
      g.applyMatrix4(M);
      room.B.add(wood, g, undefined, true);
    }
    // contents per shelf
    const coverShelves = new Set<number>();
    while (coverShelves.size < Math.min(shelves, coversPerUnit)) coverShelves.add(1 + Math.floor(r() * (shelves - 1)));
    for (let s = 0; s < shelves; s++) {
      const y0 = s * pitch + 0.02;
      let x = -unitW / 2 + 0.05;
      const coverAt = coverShelves.has(s) && coverIdx < books.length ? 0.15 + r() * 0.5 : -1;
      while (x < unitW / 2 - 0.08) {
        if (coverAt >= 0 && x > coverAt - unitW / 2 && coverIdx < books.length && !coverShelves.has(-s - 1)) {
          // face-out real cover
          const b = books[coverIdx];
          const ch = Math.min(pitch - 0.1, 0.36);
          const cw = ch / 1.5;
          const local = new THREE.Vector3(x + cw / 2, y0 + ch / 2 + 0.01, depth / 2 - 0.09).applyMatrix4(M);
          const cm = room.art(assets.art(b.art), cw, ch, local.x, local.y, local.z, u.ry + 0, { glow: 0.06 });
          cm.rotateX(-0.08);
          coverSpots.push({ index: coverIdx, pos: room.v(local.x, local.y, local.z), mesh: cm });
          coverIdx++;
          coverShelves.add(-s - 1);
          x += cw + 0.05;
          continue;
        }
        const t = 0.025 + r() * 0.035;
        const h = Math.min(pitch - 0.08, 0.2 + r() * 0.14);
        const lean = r() < 0.06 ? 0.25 : 0;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x + t / 2, y0, -0.02 + r() * 0.03),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -lean)),
          new THREE.Vector3(t, h, 0.22 + r() * 0.06),
        );
        spineMats.push(M.clone().multiply(m));
        spineCols.push(new THREE.Color(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.8 + r() * 0.35));
        x += t + 0.002;
        if (lean) x += 0.05;
      }
    }
    // collider per unit
    const c = Math.abs(Math.cos(u.ry));
    const hx = (c * unitW + (1 - c) * depth) / 2;
    const hz = ((1 - c) * unitW + c * depth) / 2;
    room.aabb(u.x - hx, 0, u.z - hz, u.x + hx, shelfH + 0.1, u.z + hz, 'wood');
  }
  const spines = new THREE.InstancedMesh(spineGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), spineMats.length);
  spineMats.forEach((m, i) => { spines.setMatrixAt(i, m); spines.setColorAt(i, spineCols[i]); });
  spines.castShadow = spines.receiveShadow = true;
  spines.computeBoundingSphere();
  room.group.add(spines);
  room.aimBrowse(coverSpots, (i) => `${books[i]?.title ?? ''} — ${books[i]?.author ?? ''}`, open);

  // ---- rolling ladder on the left wall ----
  {
    const lx = -W / 2 + 0.75;
    const lz = -2;
    const rail = new THREE.CylinderGeometry(0.02, 0.02, D - 4, 8);
    rail.rotateX(Math.PI / 2);
    rail.translate(-W / 2 + 0.45, 3.9, -0.5);
    room.B.add(room.paint(0xb8964a, 0.3, 0.9), rail);
    for (const s of [-0.25, 0.25]) {
      const g = new THREE.CylinderGeometry(0.025, 0.025, 4.0, 8);
      g.rotateX(0.18);
      g.translate(lx, 2.0, lz + s);
      room.B.add(wood, g);
    }
    for (let k = 0; k < 10; k++) {
      const g = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6);
      g.rotateX(Math.PI / 2);
      g.translate(lx + 0.36 - k * 0.036, 0.3 + k * 0.38, lz);
      room.B.add(wood, g);
    }
  }

  // ---- reading table + banker's lamps ----
  const tz = -1.5;
  room.box(wood, 0, 0.72, tz, 4.2, 0.07, 1.3, false, 'wood');
  for (const lx of [-1.9, 1.9]) for (const lz of [-0.55, 0.55]) room.box(wood, lx, 0, tz + lz, 0.08, 0.72, 0.08, false);
  room.aabb(-2.1, 0, tz - 0.65, 2.1, 0.79, tz + 0.65, 'wood');
  for (const lx of [-1.0, 1.0]) {
    const lamp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 16), room.paint(0xb8964a, 0.3, 0.9));
    lamp.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), base.material);
    stem.position.y = 0.17;
    lamp.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.1, 16, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide, emissive: 0x2f8f4a, emissiveIntensity: 0.4 }));
    shade.rotation.z = Math.PI / 2;
    shade.position.y = 0.34;
    lamp.add(shade);
    lamp.position.set(lx, 0.79, tz);
    room.group.add(lamp);
    room.point(lx, 1.05, tz, 0xffd9a0, 1.6, 4);
  }
  // chairs (procedural) around the table
  const chairMat = room.paint(0x5a3622, 0.6);
  for (const lx of [-1.4, 0, 1.4]) {
    for (const side of [-1, 1]) {
      const z = tz + side * 1.0;
      room.box(chairMat, lx, 0.44, z, 0.46, 0.05, 0.46, false);
      room.box(chairMat, lx, 0.47, z + side * 0.21, 0.46, 0.55, 0.05, false);
      for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) room.box(chairMat, lx + dx, 0, z + dz, 0.04, 0.44, 0.04, false);
      room.aabb(lx - 0.25, 0, z - 0.25, lx + 0.25, 1.0, z + 0.25, 'wood');
    }
  }

  // ---- armchair nook with rug ----
  const rugTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 768;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7a2a24'; g.fillRect(0, 0, 512, 768);
    g.strokeStyle = '#d8b46a'; g.lineWidth = 14; g.strokeRect(24, 24, 464, 720);
    g.strokeStyle = '#1e2a3a'; g.lineWidth = 24; g.strokeRect(60, 60, 392, 648);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#d8b46a' : '#1e2a3a'; g.beginPath(); g.ellipse(256, 384, 160 - i * 26, 260 - i * 40, 0, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, 4.6);
  rug.receiveShadow = true;
  room.group.add(rug);
  const chairs = [{ x: -1.0, z: 5.6, ry: Math.PI - 0.4 }, { x: 1.0, z: 5.6, ry: Math.PI + 0.4 }];
  for (const c of chairs) {
    room.prop('ArmChair_01', c.x, c.z, c.ry, {}, 'bounds');
    const fwd = new THREE.Vector3(Math.sin(c.ry), 0, Math.cos(c.ry));
    room.interactables.push({
      id: `arm:${c.x}`, position: room.v(c.x + fwd.x * 0.8, 1, c.z + fwd.z * 0.8), radius: 1.3, verb: 'Sit', label: 'and read a book',
      onInteract: () => sit(game, {
        hip: room.v(c.x + fwd.x * 0.05, 0.48, c.z + fwd.z * 0.05), facing: c.ry,
        shot: { position: room.v(c.x + fwd.x * 2.4 - fwd.z * 0.8, 1.5, c.z + fwd.z * 2.4 + fwd.x * 0.8), target: room.v(c.x, 0.9, c.z), fov: 50 },
        // settle in, then the bookshelf opens; closing it gets you up
        afterSeated: (stand) => {
          game.browser.open({
            heading: 'Reading · Goodreads', accent: '#e8c56a', items: bookItems(game.data), start: Math.max(0, featured), aspect: 1.5,
            onClose: () => stand(),
          });
        },
      }),
    });
  }
  room.prop('side_table_01', 0, 6.1, 0, {}, 'bounds');
  room.prop('desk_lamp_arm_01', 0.1, 6.1, 2.6, {}, 'none', 0.45);
  room.point(0, 1.3, 6.0, 0xffd29a, 2.2, 5);
  room.prop('potted_plant_01', -W / 2 + 1.0, D / 2 - 1.0, 0.7);
  room.prop('potted_plant_02', W / 2 - 1.0, D / 2 - 1.0, 2.0);

  // ---- currently reading lectern ----
  const reading = books.findIndex((b) => b.status === 'currently-reading');
  const featured = reading >= 0 ? reading : 0;
  const lec = { x: 0, z: -D / 2 + 1.6 };
  room.box(wood, lec.x, 0, lec.z, 0.6, 1.0, 0.5, true, 'wood');
  // sloped reading top, facing the reader (who stands on the +z side)
  const SLOPE = 0.35;
  const top = boxGeo(0.75, 0.05, 0.6);
  top.rotateX(SLOPE);
  top.translate(lec.x, 1.12, lec.z + 0.05);
  room.B.add(wood, top);
  // the open book lies on that slope, just proud of its surface
  const n = new THREE.Vector3(0, Math.cos(SLOPE), Math.sin(SLOPE));
  const at = new THREE.Vector3(lec.x, 1.12, lec.z + 0.05).addScaledVector(n, 0.025 + 0.006);
  if (books[featured]) room.art(assets.art(books[featured].art), 0.36, 0.54, at.x, at.y, at.z, 0, { glow: 0.2 }).rotateX(-(Math.PI / 2 - SLOPE));
  const signC = document.createElement('canvas');
  signC.width = 1024; signC.height = 256;
  const sgc = signC.getContext('2d')!;
  sgc.fillStyle = '#1e140c'; sgc.fillRect(0, 0, 1024, 256);
  sgc.fillStyle = '#e8c56a'; sgc.textAlign = 'center';
  sgc.font = '600 40px Georgia, serif'; sgc.fillText(reading >= 0 ? 'CURRENTLY READING' : 'LATEST READ', 512, 70);
  sgc.font = 'italic 64px Georgia, serif';
  let title = books[featured]?.title ?? '';
  while (sgc.measureText(title).width > 960 && title.length > 4) title = `${title.slice(0, -2)}…`;
  sgc.fillStyle = '#f6efe0'; sgc.fillText(title, 512, 150);
  sgc.font = '36px Georgia, serif'; sgc.fillStyle = '#c9b48a'; sgc.fillText(books[featured]?.author ?? '', 512, 210);
  const st = new THREE.CanvasTexture(signC);
  st.colorSpace = THREE.SRGBColorSpace;
  room.art(st, 3.0, 0.75, 0, 3.0, -D / 2 + 0.05, 0, { frame: 0xb8964a, glow: 0.3 });
  room.interactables.push({
    id: 'lectern', position: room.v(lec.x, 1, lec.z + 0.9), radius: 1.6, verb: 'Read', label: reading >= 0 ? 'Currently reading' : 'Latest read', priority: 1,
    onInteract: () => open(featured),
  });
  room.spot(0, H - 0.1, -D / 2 + 3, 0, 1, lec.z, 0xffe3b8, 16, 0.4);

  // ---- lights ----
  for (const [lx, lz] of [[-3, -5], [3, -5], [-3, 2], [3, 2], [0, 6]]) {
    room.prop('modern_ceiling_lamp_01', lx, lz, 0, { castShadow: false }, 'none', H - 1.17); // geometry spans 0.22..1.17 above its origin
    room.point(lx, H - 1.2, lz, 0xffe0b0, 4.2, 9);
  }

  room.exitTo('books');
  return room.finish({ id: 'books', name: 'Library', music: 'books', ambience: 'interior', envIntensity: 0.3 });
}
