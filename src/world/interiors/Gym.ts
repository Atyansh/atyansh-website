// CLIMBING GYM — a full bouldering hall you can actually climb.
//
// Wall sections are rotated slabs with exact rotated-box colliders (so you
// walk under overhangs), three faceted mesa boulders with convex-hull
// colliders, ~1500 holds merged into one vertex-coloured mesh, crash pads,
// beta theater playing real send videos, send pyramid + stats, front desk,
// shoe cubbies and a training corner. Climbing itself lives in Climbing.ts.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room } from './Room';
import { sit } from '../game/Activity';
import { Climbing, type Hold } from '../game/Climbing';
import { boxGeo } from '../world/geo';
import { rng } from '../engine/math';
import { cardTexture } from './cards';

const W = 40;
const D = 46;
const H = 11;
const ROUTE_COLS = [0x3ddc7b, 0x3fa7dd, 0xf3d34a, 0xef8f3a, 0xe8443a, 0xb44df0, 0x24262d, 0xf2efe8];

export function buildGym(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets, physics } = game;
  const r = rng(4242);
  room.shell({ floor: 'rubber_tiles', floorScale: 1.4, floorTint: 0x8a8f99, wall: 'painted_plaster_wall', wallScale: 3, wallTint: 0xc9ccd2, ceiling: 0x3a3d44, baseboard: 0x24262b, surface: 'pad' });

  // ---- plywood with a t-nut grid (canvas over the PBR diffuse) ----
  const plyBase = assets.pbr('plywood', { scale: 1.5 });
  const plyCanvas = document.createElement('canvas');
  plyCanvas.width = plyCanvas.height = 1024;
  const pg = plyCanvas.getContext('2d')!;
  pg.fillStyle = '#d9cdb0';
  pg.fillRect(0, 0, 1024, 1024);
  const plyTex = new THREE.CanvasTexture(plyCanvas);
  plyTex.colorSpace = THREE.SRGBColorSpace;
  plyTex.wrapS = plyTex.wrapT = THREE.RepeatWrapping;
  plyTex.repeat.set(1 / 1.5, 1 / 1.5);
  plyTex.anisotropy = 8;
  const plyImg = new Image();
  plyImg.onload = () => {
    // painted plywood: light paint over faint grain, so paint tints read true
    pg.fillStyle = '#f4f1ea';
    pg.fillRect(0, 0, 1024, 1024);
    pg.globalAlpha = 0.22;
    pg.drawImage(plyImg, 0, 0, 1024, 1024);
    pg.globalAlpha = 1;
    pg.fillStyle = 'rgba(40,36,30,0.55)';
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) { pg.beginPath(); pg.arc(73 + x * 146, 73 + y * 146, 9, 0, Math.PI * 2); pg.fill(); }
    pg.strokeStyle = 'rgba(0,0,0,0.25)';
    pg.lineWidth = 4;
    pg.strokeRect(2, 2, 1020, 1020);
    plyTex.needsUpdate = true;
  };
  plyImg.src = '/world/assets/tex/plywood_diff.webp';
  const wallPaints = [0xf2efe8, 0xd8dde4, 0x9db4c8, 0x36404d, 0xe8e2d4];
  const plyMats = wallPaints.map((c) => {
    const m = new THREE.MeshStandardMaterial({ map: plyTex, normalMap: plyBase.normalMap, roughnessMap: plyBase.roughnessMap, color: c, roughness: 0.92 });
    m.normalScale.setScalar(0.6);
    return m;
  });
  const kick = room.paint(0x1d1f23, 0.85);

  // ---- hold shapes (rocky blobs), merged into one vertex-coloured mesh ----
  const shapes = [0, 1, 2, 3, 4].map((k) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const rr = rng(77 + k);
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const n = 0.82 + rr() * 0.3;
      v.multiplyScalar(n);
      if (v.z < 0) v.z *= 0.25; // flat back against the wall
      v.x *= k === 2 ? 1.8 : k === 4 ? 0.6 : 1.1;
      v.y *= k === 3 ? 0.45 : 0.75;
      pos.setXYZ(i, v.x, v.y, v.z * 0.7);
    }
    g.computeVertexNormals();
    return g.toNonIndexed();
  });
  const holdParts: THREE.BufferGeometry[] = [];
  const volParts: THREE.BufferGeometry[] = [];
  const holds: Hold[] = [];
  const addHold = (p: THREE.Vector3, n: THREE.Vector3, size: number, color: number) => {
    const g = shapes[Math.floor(r() * shapes.length)].clone();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * Math.PI * 2));
    g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(size, size, size)));
    const col = new THREE.Color(color);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    holdParts.push(g);
    holds.push({ p: room.v(p.x, p.y, p.z), n: n.clone() });
  };

  // ---- wall sections ----
  const climbTag = { kind: 'static' as const, surface: 'wood' as const, climbable: true };
  const wallSection = (lx: number, lz: number, width: number, height: number, lean: number, ry: number, routes: number, paint: number) => {
    const cL = Math.cos(lean);
    const sL = Math.sin(lean);
    const pivot = new THREE.Matrix4().makeRotationY(ry).setPosition(lx, 0, lz);
    const slabLocal = new THREE.Matrix4().compose(new THREE.Vector3(0, (height / 2) * cL, (height / 2) * sL), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, 0)), new THREE.Vector3(1, 1, 1));
    const slabM = pivot.clone().multiply(slabLocal);
    const g = boxGeo(width, height, 0.4);
    g.translate(0, 0, -0.2);
    g.applyMatrix4(slabM);
    room.B.add(plyMats[paint % plyMats.length], g);
    // exact rotated collider
    const c = new THREE.Vector3(0, 0, -0.2).applyMatrix4(slabM);
    const q = new THREE.Quaternion().setFromRotationMatrix(slabM);
    physics.box(room.ox + c.x, c.y, c.z, width / 2, height / 2, 0.2, q, climbTag);
    // kickboard
    const kg = boxGeo(width, 0.36, 0.06);
    kg.translate(0, 0.18 - height / 2, 0.03);
    kg.applyMatrix4(slabM);
    room.B.add(kick, kg, undefined, false);
    // face frame: point at (hx, hy) on the face, `off` metres out
    const onFace = (hx: number, hy: number, off: number) => new THREE.Vector3(hx, hy * cL - off * sL, hy * sL + off * cL).applyMatrix4(pivot);
    const faceN = new THREE.Vector3(0, -sL, cL).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry));
    for (let rt = 0; rt < routes; rt++) {
      const col = ROUTE_COLS[Math.floor(r() * ROUTE_COLS.length)];
      let hx = -width / 2 + (rt + 0.5) * (width / routes);
      const n = 9 + Math.floor(r() * 6);
      // start tag
      const tag = boxGeo(0.14, 0.14, 0.02);
      tag.applyMatrix4(new THREE.Matrix4().compose(onFace(hx, 0.55, 0.02), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceN), new THREE.Vector3(1, 1, 1)));
      room.B.add(room.paint(col, 0.5), tag, undefined, false);
      for (let k = 0; k < n; k++) {
        const hy = 0.45 + (k / (n - 1)) * (height - 1.0);
        hx = THREE.MathUtils.clamp(hx + (r() - 0.5) * 0.6, -width / 2 + 0.3, width / 2 - 0.3);
        addHold(onFace(hx, hy, 0.02), faceN, 0.07 + r() * 0.11, col);
      }
    }
    // volumes
    for (let v = 0; v < Math.max(2, Math.floor(width / 4)); v++) {
      const vg = new THREE.ConeGeometry(0.45 + r() * 0.5, 0.3 + r() * 0.25, r() > 0.5 ? 3 : 4);
      vg.rotateX(Math.PI / 2);
      vg.rotateZ(r() * Math.PI);
      const p = onFace(-width / 2 + 1 + r() * (width - 2), 1.2 + r() * (height - 3), 0.15);
      vg.applyMatrix4(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceN), new THREE.Vector3(1, 1, 1)));
      const col = new THREE.Color(r() > 0.35 ? 0xf2efe8 : 0x2c2e33);
      const cc = new Float32Array(vg.attributes.position.count * 3);
      for (let i = 0; i < cc.length; i += 3) { cc[i] = col.r; cc[i + 1] = col.g; cc[i + 2] = col.b; }
      vg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      volParts.push(vg.toNonIndexed());
    }
  };
  wallSection(-10, -D / 2 + 1.1, 16, 9.5, -0.1, 0, 7, 0);
  wallSection(8, -D / 2 + 1.1, 16, 10, 0.24, 0, 7, 2);
  wallSection(-W / 2 + 1.1, -12, 14, 9, 0.05, Math.PI / 2, 6, 1);
  wallSection(-W / 2 + 1.1, 4, 12, 9.5, 0.4, Math.PI / 2, 5, 3);
  wallSection(W / 2 - 1.1, -11, 14, 9.5, 0.16, -Math.PI / 2, 6, 4);
  wallSection(W / 2 - 1.1, 5, 10, 8, -0.08, -Math.PI / 2, 4, 0);

  // ---- mesa boulders (convex hulls) ----
  const boulders: Array<{ id: string; x: number; z: number }> = [];
  const mkBoulder = (id: string, bx: number, bz: number, rx: number, ry: number, rz: number, paint: number, holdCount: number) => {
    const pts: THREE.Vector3[] = [];
    for (const [ly, lr] of [[0, 0.88], [0.32, 1.0], [0.66, 0.9], [1, 0.62]]) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r() * 0.6;
        const jr = 0.84 + r() * 0.16;
        pts.push(new THREE.Vector3(Math.cos(a) * rx * lr * jr, ly * ry * (0.96 + r() * 0.04), Math.sin(a) * rz * lr * jr));
      }
    }
    for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pts.push(new THREE.Vector3(px * rx * 0.45, ry, pz * rz * 0.45));
    const geo = new ConvexGeometry(pts);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: plyTex, normalMap: plyBase.normalMap, color: wallPaints[paint], roughness: 0.9, flatShading: true }));
    mesh.position.set(bx, 0.36, bz);
    mesh.castShadow = mesh.receiveShadow = true;
    room.group.add(mesh);
    const wp = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => wp.set([room.ox + bx + p.x, 0.36 + p.y, bz + p.z], i * 3));
    physics.hull(wp, climbTag);
    // holds on facets
    const pos = geo.getAttribute('position');
    const triCount = pos.count / 3;
    const v0 = new THREE.Vector3(); const v1 = new THREE.Vector3(); const v2 = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < holdCount && guard++ < holdCount * 30) {
      const tri = Math.floor(r() * triCount);
      v0.fromBufferAttribute(pos, tri * 3); v1.fromBufferAttribute(pos, tri * 3 + 1); v2.fromBufferAttribute(pos, tri * 3 + 2);
      const n = new THREE.Vector3().crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
      if (n.y > 0.75 || n.y < -0.4) continue;
      let a = r(); let b = r();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const p = v0.clone().addScaledVector(v1.clone().sub(v0), a).addScaledVector(v2.clone().sub(v0), b);
      if (p.y < 0.25) continue;
      addHold(p.add(new THREE.Vector3(bx, 0.36, bz)).addScaledVector(n, 0.02), n, 0.08 + r() * 0.12, ROUTE_COLS[Math.floor(r() * ROUTE_COLS.length)]);
      placed++;
    }
    boulders.push({ id, x: bx, z: bz });
  };
  mkBoulder('ridge', -5, -6, 7.5, 7.2, 5.6, 4, 120);
  mkBoulder('tower', 8.5, 2, 5.4, 6.0, 4.8, 2, 90);
  mkBoulder('island', -4, 9, 4.6, 3.8, 3.8, 1, 50);

  const holdMesh = new THREE.Mesh(mergeGeometries(holdParts)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
  holdMesh.castShadow = true;
  room.group.add(holdMesh);
  if (volParts.length) {
    const vm = new THREE.Mesh(mergeGeometries(volParts)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    vm.castShadow = vm.receiveShadow = true;
    room.group.add(vm);
  }

  // ---- crash pads (standable) ----
  const padMat = new THREE.MeshStandardMaterial({ color: 0x2b4fa0, roughness: 0.95 });
  const padSeam = new THREE.MeshStandardMaterial({ color: 0x1e3a7a, roughness: 0.95 });
  const pads: Array<[number, number, number, number]> = [
    [0, -D / 2 + 4.2, W - 2, 6.2], [-W / 2 + 4.2, -4, 6.2, 22], [W / 2 - 4.2, -3, 6.2, 22],
    [-5, -6, 18, 14], [8.5, 2, 13, 12], [-4, 9, 11, 10],
  ];
  for (const [px, pz, pw, pd] of pads) {
    const tall = 0.36;
    room.box(padMat, px, 0, pz, pw, tall, pd, false, 'pad', false);
    room.aabb(px - pw / 2, 0, pz - pd / 2, px + pw / 2, tall, pz + pd / 2, 'pad');
    for (let s = -pw / 2 + 2; s < pw / 2; s += 2) room.box(padSeam, px + s, tall, pz, 0.04, 0.005, pd, false, 'pad', false);
  }

  // ---- beta theater: one decoder, real send videos ----
  const vids = game.data.climbVideos ?? [];
  if (vids.length) {
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'none';
    let cur = 0;
    const scrMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 0.9 });
    let vtex: THREE.VideoTexture | null = null;
    const setPoster = () => {
      const t = vids[cur].thumb;
      if (!t) return;
      const tx = assets.art(t);
      scrMat.emissiveMap = tx;
      scrMat.needsUpdate = true;
    };
    el.addEventListener('playing', () => {
      if (!vtex) { vtex = new THREE.VideoTexture(el); vtex.colorSpace = THREE.SRGBColorSpace; }
      scrMat.emissiveMap = vtex;
      scrMat.needsUpdate = true;
    });
    const plaqueC = document.createElement('canvas');
    plaqueC.width = 1024; plaqueC.height = 160;
    const plaqueTex = new THREE.CanvasTexture(plaqueC);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    const drawPlaque = () => {
      const g = plaqueC.getContext('2d')!;
      const v = vids[cur];
      g.fillStyle = '#16181d'; g.fillRect(0, 0, 1024, 160);
      g.textAlign = 'center';
      g.fillStyle = '#ffa53a'; g.font = '800 64px "Avenir Next Condensed", sans-serif';
      g.fillText(`NOW SHOWING · ${v.grade.toUpperCase()}`, 512, 70);
      g.fillStyle = '#9aa3b2'; g.font = '34px "Avenir Next", sans-serif';
      g.fillText(`${v.gym} · ${v.date} · ${cur + 1} of ${vids.length}`, 512, 130);
      plaqueTex.needsUpdate = true;
    };
    const show = (i: number) => {
      cur = (i + vids.length) % vids.length;
      el.src = vids[cur].video;
      setPoster();
      drawPlaque();
      el.play().catch(() => {});
    };
    el.addEventListener('ended', () => show(cur + 1));
    setPoster();
    drawPlaque();
    const sx = -W / 2 + 4;
    const sz = D / 2 - 0.15;
    room.box(room.paint(0x111214, 0.4, 0.3), sx + 3, 1.3, sz - 0.05, 3.4, 5.8, 0.1, false);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.5), scrMat);
    scr.position.set(sx + 3, 4.2, sz - 0.11);
    scr.rotation.y = Math.PI;
    room.group.add(scr);
    room.art(plaqueTex, 3.1, 0.48, sx + 3, 0.95, sz - 0.11, Math.PI, { glow: 0.5 });
    room.box(padMat, sx + 3, 0, sz - 5.5, 3.4, 0.45, 1.0, true, 'pad');
    room.interactables.push({
      id: 'beta', position: room.v(sx + 3, 1, sz - 6.6), radius: 1.8, verb: 'Watch', label: 'the beta',
      onInteract: () => sit(game, {
        hip: room.v(sx + 3, 0.5, sz - 5.5), facing: 0,
        hint: 'E  Stand up · D  Next send',
        shot: { position: room.v(sx + 3.6, 1.7, sz - 7.3), target: room.v(sx + 3, 3.6, sz), fov: 52 },
        onUpdate: () => { if (game.input.pressed('next')) show(cur + 1); if (game.input.pressed('prev')) show(cur - 1); },
      }),
    });
    room.onEnter(() => show(cur));
    room.onExit(() => el.pause());
  }

  // ---- send pyramid + stats ----
  const pyramid = game.data.climbing ?? [];
  const stats = game.data.climbStats;
  if (pyramid.length) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 640;
    const g = c.getContext('2d')!;
    g.fillStyle = '#16181d'; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = '#fff'; g.font = '800 64px "Avenir Next Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText('SEND PYRAMID', 512, 84);
    const max = Math.max(...pyramid.map((p) => p.count));
    const rows = [...pyramid].reverse();
    rows.forEach((p, i) => {
      const bw = (p.count / max) * 820;
      const y = 130 + i * (480 / rows.length);
      g.fillStyle = `#${ROUTE_COLS[(rows.length - 1 - i) % ROUTE_COLS.length].toString(16).padStart(6, '0')}`;
      g.fillRect(512 - bw / 2, y, bw, 480 / rows.length - 10);
      g.fillStyle = '#e8ecf2'; g.font = '700 32px "Avenir Next", sans-serif';
      g.textAlign = 'left'; g.fillText(p.grade.toUpperCase(), 30, y + 34);
      g.textAlign = 'right'; g.fillText(String(p.count), 994, y + 34);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    room.art(t, 4.0, 2.5, 6, 3.2, D / 2 - 0.08, Math.PI, { frame: 0x24262b, glow: 0.25 });
  }
  if (stats) {
    const tex = cardTexture({ kicker: 'Kaya · bouldering', title: `${stats.totalSends} sends`, body: `${stats.totalFlashes} flashes (${stats.flashRate}%) · hardest ${stats.maxGrade.toUpperCase()} · ${stats.totalVideos} videos`, accent: '#ffa53a' }, 800, 500);
    room.art(tex, 2.6, 1.6, 11.5, 3.2, D / 2 - 0.08, Math.PI, { frame: 0x24262b, glow: 0.25 });
  }

  // ---- front desk, shoe cubbies, chalk, training corner ----
  const desk = { x: W / 2 - 4, z: D / 2 - 4 };
  room.box(room.paint(0x2a2d33, 0.5, 0.3), desk.x, 0, desk.z, 4.0, 1.05, 1.0, true, 'wood');
  room.box(room.paint(0xffa53a, 0.4, 0.2), desk.x, 1.05, desk.z, 4.1, 0.06, 1.1, false);
  room.prop('CashRegister_01', desk.x - 1, desk.z, 0, { scale: 0.8 }, 'none', 1.11);
  const cubby = room.paint(0xe8e2d4, 0.8);
  for (let cx = 0; cx < 6; cx++) for (let cy = 0; cy < 4; cy++) {
    room.box(cubby, W / 2 - 0.3, 0.2 + cy * 0.45, D / 2 - 9 - cx * 0.6, 0.4, 0.04, 0.56, false);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), room.paint(ROUTE_COLS[(cx + cy) % ROUTE_COLS.length], 0.6));
    shoe.rotation.z = Math.PI / 2;
    shoe.position.set(W / 2 - 0.3, 0.3 + cy * 0.45, D / 2 - 9 - cx * 0.6);
    room.group.add(shoe);
  }
  room.aabb(W / 2 - 0.6, 0, D / 2 - 12.6, W / 2, 2.0, D / 2 - 8.6, 'wood');
  for (const [cx, cz] of [[-6, 2.5], [12, -4], [0, -D / 2 + 7.5]]) {
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.3, 16), room.paint(0xf2efe8, 0.9));
    bucket.position.set(cx, 0.51, cz);
    room.group.add(bucket);
    room.box(room.paint(0x2a2d33, 0.5, 0.5), cx, 0, cz, 0.4, 0.36, 0.4, true, 'metal');
  }
  // hangboard + kettlebells
  room.box(room.paint(0x8a5a3a, 0.6), -W / 2 + 0.15, 2.4, 14, 0.12, 0.3, 1.2, false);
  for (let k = 0; k < 4; k++) {
    const kb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), room.paint(0x1d1f23, 0.4, 0.6));
    kb.position.set(-W / 2 + 0.8, 0.14, 12 + k * 0.5);
    room.group.add(kb);
  }
  // lockers
  for (let k = 0; k < 8; k++) {
    room.box(room.paint(k % 2 ? 0x3a5a7a : 0x34506d, 0.45, 0.6), -W / 2 + 0.35, 0, 18 + k * 0.62 - 3, 0.6, 2.0, 0.58, false);
  }
  room.aabb(-W / 2, 0, 14.6, -W / 2 + 0.7, 2.0, 19.9, 'metal');

  // ---- lights ----
  for (let x = -12; x <= 12; x += 12) for (const z of [-12, 0, 12]) room.rect(x, H - 0.05, z, 5, 1.2, 0xf4f7ff, 7.5);

  // ---- climbing ----
  const climbing = new Climbing(game);
  climbing.setHolds(holds);
  climbing.onTopOut = (p) => {
    let best = boulders[0];
    for (const b of boulders) if (Math.hypot(b.x + room.ox - p.x, b.z - p.z) < Math.hypot(best.x + room.ox - p.x, best.z - p.z)) best = b;
    if (game.save.setFlag(`climb:top:${best.id}`)) game.ui.toast('Topped out!', `The ${best.id} boulder`, '🧗', 'goal');
    game.events.emit('progress', { key: `climb:${best.id}` });
  };
  room.interactables.push({
    id: 'climb',
    position: () => climbing.probe()?.point ?? room.v(0, -100, 0),
    radius: 1.6,
    facing: false,
    verb: 'Climb',
    label: 'the wall',
    enabled: () => !climbing.active && climbing.probe() !== null,
    onInteract: () => { const s = climbing.probe(); if (s) climbing.start(s); },
  });
  room.updates.push(() => climbing.applyIK());
  room.onEnter(() => { game.player.jumpInterceptor = () => { const s = climbing.probe(); if (s) { climbing.start(s); return true; } return false; }; });
  room.onExit(() => { game.player.jumpInterceptor = null; });

  room.exitTo('climb');
  return room.finish({ id: 'climb', name: 'Climbing Gym', music: 'climbing', ambience: 'gym', envIntensity: 0.55, boom: 4.6, spawn: { x: 0, z: D / 2 - 2, facing: Math.PI } });
}
