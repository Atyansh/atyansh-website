// RECORDS — exposed-brick record shop: album wall, crates of sleeves,
// turntables, top-tracks chalkboard, and a listening booth.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room } from './Room';
import { sit } from '../game/Activity';
import { albumItems } from './items';
import { boxGeo } from '../world/geo';

const W = 14;
const D = 20;
const H = 4.6;

function chalkboard(title: string, lines: string[], sub?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1280;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1e2421';
  g.fillRect(0, 0, 1024, 1280);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * 1024, Math.random() * 1280, 3, 1); }
  g.fillStyle = '#f2efe4';
  g.textAlign = 'center';
  g.font = '700 92px "Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
  g.fillText(title, 512, 130);
  if (sub) { g.font = '40px "Chalkboard SE", cursive'; g.fillStyle = '#c9d6c2'; g.fillText(sub, 512, 190); }
  g.textAlign = 'left';
  lines.forEach((l, i) => {
    g.fillStyle = i < 3 ? '#ffd27a' : '#f2efe4';
    g.font = `${i < 3 ? 600 : 400} 44px "Chalkboard SE", "Marker Felt", cursive`;
    let t = `${i + 1}. ${l}`;
    while (g.measureText(t).width > 900 && t.length > 4) t = `${t.slice(0, -2)}…`;
    g.fillText(t, 70, 290 + i * 84);
  });
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

function neonTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.font = '700 150px "Brush Script MT", "Snell Roundhand", cursive';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 40;
  g.fillStyle = color;
  g.fillText(text, 512, 132);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 512, 132);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRecords(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const albums = game.data.music ?? [];
  room.shell({ floor: 'wood_floor_worn', floorScale: 1.8, wall: 'red_brick_03', wallScale: 1.6, wallTint: 0xe0d0c8, ceiling: 0x1c1a19, baseboard: 0x2a201a, surface: 'wood' });
  const wood = assets.pbr('wood_floor', { scale: 1.2, tint: 0x8a5a3a });
  const open = (start: number) => game.browse({ heading: 'Saved Albums · Spotify', accent: '#36c98e', items: albumItems(game.data), start, aspect: 1 });

  // ---- album wall (every saved album) ----
  const placed = room.wallOfArt(albums, [
    { x0: -W / 2 + 0.03, z0: D / 2 - 2.2, x1: -W / 2 + 0.03, z1: -D / 2 + 0.8, facing: Math.PI / 2, y0: 0.9, rows: 3, w: 0.82, h: 0.82, gap: 0.32, rowGap: 0.3 },
  ], 0x1a1714, 0.14);
  room.aimBrowse(placed, (i) => `${albums[i]?.title ?? ''} — ${albums[i]?.artist ?? ''}`, open);

  // ---- crates of sleeves ----
  const sleeveMat = [0x2b2b2e, 0x3a3027, 0x4a3b33, 0x1f2a30, 0x3b2228].map((c) => room.paint(c, 0.7));
  let albumIdx = 0;
  const crates: Array<[number, number, number]> = [[-2.2, 3.0, 0], [2.4, 3.0, 0], [-2.2, -1.5, 0], [2.4, -1.5, 0], [0.1, -6, Math.PI / 2]];
  for (const [cx, cz, ry] of crates) {
    const crate = new THREE.Group();
    // bin: open-top wooden box on legs, two rows of sleeves
    for (const [w, h, d, x, y, z] of [[2.6, 0.06, 0.95, 0, 0.62, 0], [2.6, 0.32, 0.04, 0, 0.78, 0.46], [2.6, 0.32, 0.04, 0, 0.78, -0.46], [0.04, 0.32, 0.95, 1.28, 0.78, 0], [0.04, 0.32, 0.95, -1.28, 0.78, 0], [0.04, 0.32, 0.95, 0, 0.78, 0]] as number[][]) {
      const g = boxGeo(w, h, d);
      g.translate(x, y, z);
      crate.add(new THREE.Mesh(g, wood));
    }
    for (const lx of [-1.2, 1.2]) for (const lz of [-0.42, 0.42]) {
      const g = boxGeo(0.05, 0.62, 0.05);
      g.translate(lx, 0.31, lz);
      crate.add(new THREE.Mesh(g, wood));
    }
    for (const half of [-1, 1]) {
      for (const row of [-0.22, 0.22]) {
        for (let k = 0; k < 9; k++) {
          const sleeve = new THREE.Mesh(boxGeo(0.31, 0.31, 0.006), sleeveMat[(k + Math.round(cx)) % sleeveMat.length]);
          sleeve.position.set(half * 0.64 + (k - 4) * 0.012, 0.8, row);
          sleeve.rotation.y = Math.PI / 2;
          sleeve.rotation.z = -0.32 + k * 0.035;
          sleeve.position.x = half * 0.64 - 0.45 + k * 0.1;
          crate.add(sleeve);
        }
        // front sleeve shows a real cover
        const a = albums[albumIdx++ % Math.max(1, albums.length)];
        if (a) {
          const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.31), new THREE.MeshStandardMaterial({ map: assets.art(a.art), roughness: 0.6 }));
          cover.position.set(half * 0.64 + 0.5, 0.82, row);
          cover.rotation.y = Math.PI / 2;
          cover.rotation.x = 0;
          cover.rotateX(-0.25);
          crate.add(cover);
        }
      }
    }
    crate.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    crate.position.set(cx, 0, cz);
    crate.rotation.y = ry;
    room.group.add(crate);
    const hw = ry ? 0.5 : 1.32;
    const hd = ry ? 1.32 : 0.5;
    room.aabb(cx - hw, 0, cz - hd, cx + hw, 0.95, cz + hd, 'wood');
    room.interactables.push({
      id: `crate:${cx}:${cz}`, position: room.v(cx, 1, cz), radius: 2.0, verb: 'Dig through', label: 'the crate',
      onInteract: () => open(Math.max(0, (albumIdx - 4) % Math.max(1, albums.length))),
    });
  }

  // ---- turntables on the back wall ----
  const deskZ = -D / 2 + 0.7;
  room.box(wood, -3.2, 0, deskZ, 3.4, 0.95, 0.9, true, 'wood');
  const platters: THREE.Mesh[] = [];
  for (const tx of [-4.1, -2.3]) {
    room.box(room.paint(0x1c1c1f, 0.4, 0.5), tx, 0.95, deskZ, 0.9, 0.12, 0.65, false);
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 40), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.25, metalness: 0.2 }));
    platter.position.set(tx - 0.08, 1.1, deskZ);
    room.group.add(platter);
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshStandardMaterial({ color: 0xff6a3a }));
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.016;
    platter.add(label);
    platters.push(platter);
    const arm = boxGeo(0.02, 0.02, 0.3);
    arm.rotateY(0.5);
    arm.translate(tx + 0.28, 1.13, deskZ + 0.05);
    room.B.add(room.paint(0xc8ccd2, 0.25, 0.9), arm, undefined, false);
  }
  room.updates.push((dt) => platters.forEach((p) => { p.rotation.y -= dt * 3.5; }));

  // ---- top tracks chalkboard + neon ----
  const tracks = (game.data.topTracks ?? []).map((t) => `${t.title} — ${t.artist}`);
  room.art(chalkboard('On Rotation', tracks.slice(0, 10), 'top tracks this season'), 2.0, 2.5, 0.6, 2.3, -D / 2 + 0.06, 0, { frame: 0x5a3a24, frameW: 0.08, glow: 0.18 });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: neonTexture('Records', '#36e0a0'), transparent: true, emissive: 0xffffff, emissiveMap: neonTexture('Records', '#36e0a0'), emissiveIntensity: 2.2 }));
  neon.position.set(-3.2, 3.6, -D / 2 + 0.08);
  room.group.add(neon);
  room.point(-3.2, 3.2, -D / 2 + 1.2, 0x36e0a0, 2.2, 6);

  // ---- counter with register + staff picks ----
  const ctrX = W / 2 - 1.4;
  const ctrZ = D / 2 - 4.5;
  room.box(wood, ctrX, 0, ctrZ, 1.0, 1.0, 3.6, true, 'wood');
  room.box(room.paint(0x241c17, 0.3, 0.1), ctrX, 1.0, ctrZ, 1.1, 0.05, 3.7, false);
  room.prop('CashRegister_01', ctrX, ctrZ + 0.9, -Math.PI / 2, {}, 'none', 1.05);
  room.prop('cassette_player', ctrX, ctrZ - 0.6, -Math.PI / 2 + 0.3, {}, 'none', 1.05);
  room.prop('potted_plant_04', ctrX + 0.1, ctrZ - 1.4, 0, {}, 'none', 1.05);
  const picks = albums.slice(0, 3);
  picks.forEach((a, i) => room.art(assets.art(a.art), 0.6, 0.6, W / 2 - 0.06, 1.75 + (i % 2) * 0.1, ctrZ - 1.1 + i * 0.85, -Math.PI / 2, { frame: 0x1a1714, glow: 0.2 }));

  // ---- listening booth (back-right corner): glass walls, doorway, chair facing the speakers ----
  const bx0 = W / 2 - 3.8;           // west glass wall
  const bz1 = -D / 2 + 3.8;          // south glass wall
  const doorW = 1.2;                 // doorway at the east end of the south wall
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.16, roughness: 0.05, envMapIntensity: 2, depthWrite: false });
  const frame = room.paint(0x2a2620, 0.5, 0.3);
  // west wall: glass + frame, solid collider
  room.box(glass, bx0, 0, (-D / 2 + bz1) / 2, 0.04, 2.6, bz1 + D / 2, false, 'wood', false);
  room.aabb(bx0 - 0.06, 0, -D / 2, bx0 + 0.06, 2.6, bz1, 'wood', false, true);
  // south wall up to the doorway
  const sx1 = W / 2 - doorW;
  room.box(glass, (bx0 + sx1) / 2, 0, bz1, sx1 - bx0, 2.6, 0.04, false, 'wood', false);
  room.aabb(bx0, 0, bz1 - 0.06, sx1, 2.6, bz1 + 0.06, 'wood', false, true);
  for (const [fx, fz] of [[bx0, bz1], [bx0, -D / 2 + 0.05], [sx1, bz1], [(bx0 + sx1) / 2, bz1], [bx0, (-D / 2 + bz1) / 2]]) {
    room.box(frame, fx, 0, fz, 0.08, 2.6, 0.08, false, 'wood');
  }
  room.box(frame, (bx0 + W / 2) / 2, 2.6, (-D / 2 + bz1) / 2, W / 2 - bx0, 0.1, bz1 + D / 2, false);
  // inside: chair faces the back wall (−z), speakers + boombox in front of it
  const chairX = bx0 + 1.6;
  const chairZ = bz1 - 1.5;
  room.prop('mid_century_lounge_chair', chairX, chairZ, Math.PI, {}, 'bounds');
  room.prop('side_table_01', chairX, -D / 2 + 0.45, 0, {}, 'bounds');
  room.prop('boombox', chairX, -D / 2 + 0.45, 0, { scale: 0.7 }, 'none', 0.45);
  for (const sxo of [-1.0, 1.0]) room.box(room.paint(0x1a1714, 0.5, 0.2), chairX + sxo, 0, -D / 2 + 0.35, 0.4, 1.0, 0.35, true, 'wood');
  room.point(chairX, 2.3, chairZ, 0xffcf96, 2.6, 5);
  room.interactables.push({
    id: 'booth', position: room.v(chairX, 1, chairZ + 0.7), radius: 1.6, verb: 'Listen', label: 'in the booth', priority: 1,
    onInteract: () => sit(game, {
      hip: room.v(chairX, 0.46, chairZ - 0.05), facing: Math.PI,
      hint: 'E  Stand up',
      shot: { position: room.v(chairX + 0.9, 1.65, chairZ + 1.4), target: room.v(chairX, 0.8, -D / 2 + 0.4), fov: 52 },
      onSit: () => {
        game.events.emit('progress', { key: 'listened' });
        game.ui.toast('Listening booth', tracks.length ? `On rotation: ${tracks[0]}` : 'Pull up a chair', '♫');
      },
    }),
  });

  // ---- rugs, lamps, plants ----
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6.5), new THREE.MeshStandardMaterial({ color: 0x6d2e2a, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.006, 0.8);
  rug.receiveShadow = true;
  room.group.add(rug);
  for (const [lx, lz] of [[-2.2, 3], [2.4, 3], [-2.2, -1.5], [2.4, -1.5], [0, -6], [ctrX - 0.3, ctrZ]]) {
    room.prop('hanging_industrial_lamp', lx, lz, 0, { castShadow: false }, 'none', H);
    room.point(lx, H - 1.5, lz, 0xffd6a0, 3.2, 7);
  }
  room.prop('potted_plant_01', -W / 2 + 0.7, D / 2 - 1.0, 0.3);
  room.prop('wall_clock', W / 2 - 0.05, -2, -Math.PI / 2, {}, 'none', 3.0);
  room.prop('potted_plant_02', W / 2 - 0.7, -D / 2 + 4.5, 1.1);

  room.exitTo('records');
  return room.finish({ id: 'records', name: 'Records', music: 'music', ambience: 'interior', envIntensity: 0.4 });
}
