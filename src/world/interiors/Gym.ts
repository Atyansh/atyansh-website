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
import { Climbing, type Hold, type HoldKind, type Route } from '../game/Climbing';
import { boxGeo } from '../world/geo';
import { rng } from '../engine/math';
import { cardTexture } from './cards';

const W = 40;
const D = 46;
const H = 11;
const ROUTE_COLS = [0x3ddc7b, 0x3fa7dd, 0xf3d34a, 0xef8f3a, 0xe8443a, 0xb44df0, 0x24262d, 0xf2efe8];
/** The circuit: V-grade → tape colour, like a real gym */
const GRADES: Array<[number, string]> = [
  [0x3ddc7b, 'Green'], [0x3fa7dd, 'Blue'], [0xf3d34a, 'Yellow'], [0xef8f3a, 'Orange'],
  [0xe8443a, 'Red'], [0xb44df0, 'Purple'], [0x24262d, 'Black'], [0xf2efe8, 'White'],
];

/** Downturned climbing shoe: rubber sole + toe rand, coloured upper, velcro strap */
function climbingShoe(): { upper: THREE.BufferGeometry; sole: THREE.BufferGeometry; strap: THREE.BufferGeometry } {
  const L = 0.25;
  // side profile (x = heel→toe, y = up), downturned toe
  const prof = new THREE.Shape();
  prof.moveTo(0, 0.02);
  prof.bezierCurveTo(0.0, 0.07, 0.03, 0.1, 0.07, 0.105);    // heel cup
  prof.lineTo(0.12, 0.095);                                  // collar
  prof.bezierCurveTo(0.17, 0.085, 0.22, 0.06, L, 0.012);     // instep → toe
  prof.bezierCurveTo(L + 0.005, 0.0, L - 0.02, -0.008, 0.2, 0.0); // pointed downturned toe
  prof.bezierCurveTo(0.14, 0.012, 0.08, 0.004, 0.02, 0.0);   // arched sole
  prof.lineTo(0, 0.02);
  const upper = new THREE.ExtrudeGeometry(prof, { depth: 0.075, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 12 });
  upper.translate(-L / 2, 0, -0.0375);
  // sole + rand: a thin rubber shell along the bottom/toe
  const soleShape = new THREE.Shape();
  soleShape.moveTo(0.01, -0.004);
  soleShape.bezierCurveTo(0.08, 0.0, 0.14, 0.008, 0.2, -0.004);
  soleShape.bezierCurveTo(L - 0.015, -0.012, L + 0.012, 0.0, L + 0.004, 0.03);
  soleShape.lineTo(L - 0.012, 0.03);
  soleShape.bezierCurveTo(L - 0.01, 0.012, 0.21, 0.01, 0.2, 0.012);
  soleShape.bezierCurveTo(0.14, 0.02, 0.08, 0.012, 0.01, 0.01);
  soleShape.lineTo(0.01, -0.004);
  const sole = new THREE.ExtrudeGeometry(soleShape, { depth: 0.085, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 });
  sole.translate(-L / 2, 0, -0.0425);
  const strap = new THREE.BoxGeometry(0.028, 0.012, 0.11);
  strap.rotateZ(-0.35);
  strap.translate(0.03, 0.1, 0);
  return { upper, sole, strap };
}

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

  // ---- holds: shaped by type, merged into one vertex-coloured mesh ----
  // Each type has its own silhouette (all flat-backed, facing +Z):
  // jugs are deep rounded buckets, crimps thin edges, slopers broad domes,
  // pinches tall fins, pockets chunky blobs, foot chips tiny nubs.
  const KIND_SHAPE: Record<HoldKind, [number, number, number]> = {
    jug: [1.25, 0.85, 0.95], crimp: [1.7, 0.32, 0.42], sloper: [1.35, 1.05, 0.5], pinch: [0.5, 1.45, 0.75], pocket: [1.0, 0.95, 0.7], foot: [0.9, 0.6, 0.55],
  };
  const KIND_SIZE: Record<HoldKind, number> = { jug: 0.14, crimp: 0.09, sloper: 0.16, pinch: 0.11, pocket: 0.1, foot: 0.055 };
  const shapeCache = new Map<string, THREE.BufferGeometry>();
  const shapeOf = (kind: HoldKind, variant: number): THREE.BufferGeometry => {
    const key = `${kind}:${variant}`;
    let g = shapeCache.get(key);
    if (g) return g;
    g = new THREE.IcosahedronGeometry(1, kind === 'foot' ? 0 : 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const rr = rng(77 + variant * 13 + kind.length);
    const [sx, sy, sz] = KIND_SHAPE[kind];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(0.85 + rr() * 0.25);
      if (v.z < 0) v.z *= 0.2; // flat back against the wall
      if (kind === 'jug' && v.y > 0.2 && v.z > 0.1) v.z -= 0.35 * v.y; // scooped lip to grab
      if (kind === 'crimp' && v.y > 0) v.z *= 0.7;
      pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
    }
    g.computeVertexNormals();
    g = g.toNonIndexed();
    shapeCache.set(key, g);
    return g;
  };
  const holdParts: THREE.BufferGeometry[] = [];
  const volParts: THREE.BufferGeometry[] = [];
  const holds: Hold[] = [];
  const routes: Route[] = [];
  /** p/n in room-local space; returns the hold index */
  const addHold = (p: THREE.Vector3, n: THREE.Vector3, kind: HoldKind, color: number, route: number, scale = 1): number => {
    const size = KIND_SIZE[kind] * scale * (0.85 + r() * 0.3);
    const g = shapeOf(kind, Math.floor(r() * 3)).clone();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    // jugs / crimps sit roughly level (lip up); others any angle
    const spin = kind === 'jug' || kind === 'crimp' || kind === 'sloper' ? (r() - 0.5) * 0.6 : r() * Math.PI * 2;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin));
    g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(size, size, size)));
    const col = new THREE.Color(color).multiplyScalar(0.92 + r() * 0.12);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    holdParts.push(g);
    holds.push({ p: room.v(p.x, p.y, p.z), n: n.clone(), kind, size, route });
    return holds.length - 1;
  };
  /** Hold type for a hand move at a grade */
  const kindFor = (grade: number): HoldKind => {
    const w: Array<[HoldKind, number]> = [
      ['jug', Math.max(0.08, 0.95 - grade * 0.14)], ['crimp', 0.05 + grade * 0.06], ['sloper', grade * 0.05],
      ['pinch', 0.06 + grade * 0.03], ['pocket', grade * 0.03],
    ];
    let x = r() * w.reduce((a, [, v]) => a + v, 0);
    for (const [k, v] of w) { x -= v; if (x <= 0) return k; }
    return 'jug';
  };
  // grade tape textures
  const tapeTex = new Map<string, THREE.CanvasTexture>();
  const tape = (label: string, color: number): THREE.CanvasTexture => {
    const key = `${label}:${color}`;
    let t = tapeTex.get(key);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    g.fillRect(0, 0, 128, 64);
    const light = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.6;
    g.fillStyle = light ? '#111' : '#fff';
    g.font = '800 40px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 64, 34);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    tapeTex.set(key, t);
    return t;
  };
  const tapes: Array<{ p: THREE.Vector3; n: THREE.Vector3; tex: THREE.Texture }> = [];
  const route = (grade: number, handsIdx: number[], boulder: string | null, tagP: THREE.Vector3, tagN: THREE.Vector3, matched: boolean) => {
    const [color, colour] = GRADES[grade];
    const ri = routes.length;
    routes.push({
      id: `${boulder ?? 'w'}-${ri}`, grade, color, colour, hands: handsIdx,
      start: matched ? [handsIdx[0], handsIdx[0]] : [handsIdx[0], handsIdx[1]], top: handsIdx[handsIdx.length - 1],
      boulder, tag: room.v(tagP.x, tagP.y, tagP.z), tagN: tagN.clone(),
    });
    tapes.push({ p: tagP, n: tagN, tex: tape(`V${grade}`, color) });
    return ri;
  };

  // ---- wall sections ----
  const climbTag = { kind: 'static' as const, surface: 'wood' as const, climbable: true };
  const wallSection = (lx: number, lz: number, width: number, height: number, lean: number, ry: number, paint: number, grades: [number, number]) => {
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
    const used: Array<[number, number]> = [];
    const free = (hx: number, hy: number, d = 0.22) => used.every(([x, y]) => Math.hypot(x - hx, y - hy) > d);
    const put = (hx: number, hy: number, kind: HoldKind, color: number, ri: number, scale = 1) => { used.push([hx, hy]); return addHold(onFace(hx, hy, 0.02), faceN, kind, color, ri, scale); };
    // problems in lanes across the wall
    const lanes = Math.max(2, Math.floor(width / 2.1));
    const laneW = width / lanes;
    for (let rt = 0; rt < lanes; rt++) {
      const grade = grades[0] + Math.floor(r() * (grades[1] - grades[0] + 1));
      const [color] = GRADES[grade];
      const ri = routes.length;
      const lane0 = -width / 2 + rt * laneW + 0.3;
      const lane1 = lane0 + laneW - 0.6;
      let hx = (lane0 + lane1) / 2;
      let hy = 1.4;
      const matched = grade >= 4;
      const hand: number[] = [];
      if (matched) hand.push(put(hx, hy, 'jug', color, ri, 1.2));
      else { hand.push(put(hx - 0.22, hy, kindFor(grade), color, ri)); hand.push(put(hx + 0.22, hy + (r() - 0.5) * 0.15, kindFor(grade), color, ri)); }
      let side = r() < 0.5 ? -1 : 1;
      let crux = grade >= 5 ? 2 + Math.floor(r() * 3) : -1;
      // boulder problems: ~4.5 m tall, whatever the wall's full height
      const topY = Math.min(height - 0.6, 4.3 + r() * 0.4);
      while (hy < topY - 0.6) {
        const move = (0.4 + grade * 0.07) * (0.8 + r() * 0.35) * (crux === 0 ? 1.55 : 1);
        crux--;
        hy += move * 0.85;
        hx = THREE.MathUtils.clamp(hx + side * (0.12 + r() * 0.3), lane0, lane1);
        side = -side;
        hand.push(put(hx, hy, kindFor(grade), color, ri));
      }
      hand.push(put(hx + (r() - 0.5) * 0.3, Math.min(topY, hy + 0.5), 'jug', color, ri, 1.25));
      // footholds: below each hand hold (fewer on harder problems)
      for (let k = 0; k < hand.length; k++) {
        if (r() > 1 - grade * 0.07) continue;
        const hp = holds[hand[k]].p;
        const local = new THREE.Vector3(hp.x - room.ox, hp.y, hp.z);
        // back to face coords: hy from height above the wall foot
        const hyK = (local.clone().applyMatrix4(pivot.clone().invert()).y) / cL;
        const hxK = local.clone().applyMatrix4(pivot.clone().invert()).x;
        const fy = hyK - 0.95 - r() * 0.2;
        const fx = THREE.MathUtils.clamp(hxK + (r() - 0.5) * 0.5, lane0, lane1);
        if (fy > 0.25 && free(fx, fy, 0.16)) put(fx, fy, grade <= 1 ? 'jug' : 'foot', color, ri, grade <= 1 ? 0.6 : 1);
      }
      const tagP = onFace(lane0 + (lane1 - lane0) / 2, 0.62, 0.012);
      route(grade, hand, null, tagP, faceN, matched);
      // TOP tape just above the finish
      const tp = holds[hand[hand.length - 1]].p;
      tapes.push({ p: new THREE.Vector3(tp.x - room.ox, tp.y, tp.z).addScaledVector(new THREE.Vector3(0, 1, 0).addScaledVector(faceN, -faceN.y).normalize(), 0.24).addScaledVector(faceN, 0.012), n: faceN, tex: tape('TOP', color) });
    }
    // spare holds between the lines (feet, rests, link-ups)
    const spare = Math.floor(width * height * 0.32);
    for (let k = 0; k < spare; k++) {
      const hx = -width / 2 + 0.3 + r() * (width - 0.6);
      const hy = 0.35 + r() * (height - 0.8);
      if (!free(hx, hy, 0.3)) continue;
      const kind: HoldKind = r() < 0.45 ? 'foot' : r() < 0.6 ? 'jug' : kindFor(3);
      put(hx, hy, kind, GRADES[Math.floor(r() * GRADES.length)][0], -1, 0.9);
    }
    // volumes, kept off the problem lines
    for (let v = 0; v < Math.max(2, Math.floor(width / 4)); v++) {
      const hx = -width / 2 + 1 + r() * (width - 2);
      const hy = 2 + r() * (height - 4);
      if (!free(hx, hy, 0.75)) continue;
      const vg = new THREE.ConeGeometry(0.4 + r() * 0.35, 0.25 + r() * 0.2, r() > 0.5 ? 3 : 4);
      vg.rotateX(Math.PI / 2);
      vg.rotateZ(r() * Math.PI);
      vg.applyMatrix4(new THREE.Matrix4().compose(onFace(hx, hy, 0.12), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceN), new THREE.Vector3(1, 1, 1)));
      const col = new THREE.Color(r() > 0.35 ? 0xf2efe8 : 0x2c2e33);
      const cc = new Float32Array(vg.attributes.position.count * 3);
      for (let i = 0; i < cc.length; i += 3) { cc[i] = col.r; cc[i + 1] = col.g; cc[i + 2] = col.b; }
      vg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      volParts.push(vg.toNonIndexed());
    }
  };
  // slab, vertical and overhangs: harder grades go on the steep walls
  wallSection(-10, -D / 2 + 1.1, 16, 9.5, -0.1, 0, 0, [0, 3]);
  wallSection(8, -D / 2 + 1.1, 16, 10, 0.24, 0, 2, [2, 6]);
  wallSection(-W / 2 + 1.1, -12, 14, 9, 0.05, Math.PI / 2, 1, [0, 4]);
  wallSection(-W / 2 + 1.1, 4, 12, 9.5, 0.4, Math.PI / 2, 3, [4, 7]);
  wallSection(W / 2 - 1.1, -11, 14, 9.5, 0.16, -Math.PI / 2, 4, [1, 5]);
  wallSection(W / 2 - 1.1, 5, 10, 8, -0.08, -Math.PI / 2, 0, [0, 2]);

  // ---- mesa boulders (convex hulls) with problems that top out ----
  const boulders: Array<{ id: string; x: number; z: number }> = [];
  const ray = new THREE.Raycaster();
  const mkBoulder = (id: string, bx: number, bz: number, rx: number, ry: number, rz: number, paint: number, problems: number, spare: number, grades: [number, number]) => {
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
    // surface queries in room-local space
    const probe = new THREE.Mesh(geo);
    probe.position.set(bx, 0.36, bz);
    probe.updateMatrixWorld(true);
    const centre = new THREE.Vector3(bx, 0, bz);
    /** surface point + normal at (azimuth, height) seen from outside */
    const surf = (az: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } | null => {
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const from = centre.clone().addScaledVector(dir, Math.max(rx, rz) * 2).setY(y);
      ray.set(from, dir.clone().negate());
      const hit = ray.intersectObject(probe, false)[0];
      if (!hit || !hit.face) return null;
      return { p: hit.point, n: hit.face.normal.clone() };
    };
    const used: THREE.Vector3[] = [];
    const freeAt = (p: THREE.Vector3, d: number) => used.every((u) => u.distanceTo(p) > d);
    const putB = (s: { p: THREE.Vector3; n: THREE.Vector3 }, kind: HoldKind, color: number, ri: number, scale = 1) => {
      used.push(s.p.clone());
      return addHold(s.p.clone().addScaledVector(s.n, 0.02), s.n, kind, color, ri, scale);
    };
    for (let k = 0; k < problems; k++) {
      const firstHold = holds.length;
      /** abandoned line: its holds stay on the boulder as spares */
      const abandon = () => { for (let q = firstHold; q < holds.length; q++) holds[q].route = -1; };
      const grade = grades[0] + Math.floor(r() * (grades[1] - grades[0] + 1));
      const [color] = GRADES[grade];
      const ri = routes.length;
      let az = (k / problems) * Math.PI * 2 + r() * 0.5;
      let y = 0.36 + 1.45;
      const s0 = surf(az, y);
      if (!s0 || s0.n.y > 0.6 || s0.n.y < -0.5) continue;
      const hand: number[] = [];
      const matched = grade >= 4;
      const azStep = (d: number) => d / Math.max(rx, rz);
      if (matched) hand.push(putB(s0, 'jug', color, ri, 1.2));
      else {
        const a = surf(az - azStep(0.22), y), b = surf(az + azStep(0.22), y);
        if (!a || !b) { abandon(); continue; }
        hand.push(putB(a, kindFor(grade), color, ri), putB(b, kindFor(grade), color, ri));
      }
      let side = 1;
      let last = s0;
      for (let guard = 0; guard < 20; guard++) {
        const move = (0.42 + grade * 0.07) * (0.8 + r() * 0.3);
        y += move * 0.85;
        az += azStep(side * (0.1 + r() * 0.25));
        side = -side;
        const s = surf(az, y);
        // past the summit (the probe sails over the top) or onto its flat
        // top: the previous hold is the lip
        if (!s || s.n.y > 0.7) break;
        last = s;
        hand.push(putB(s, kindFor(grade), color, ri));
      }
      if (hand.length < 4) { abandon(); continue; }
      // the finish: a big hold right at the lip
      const lip = surf(az, last.p.y + 0.35);
      if (lip && lip.n.y < 0.7) hand.push(putB(lip, 'jug', color, ri, 1.2));
      else { const h = holds[hand[hand.length - 1]]; h.kind = 'jug'; }
      // feet
      for (const hi of hand) {
        const hp = holds[hi].p;
        const fa = Math.atan2(hp.z - bz, hp.x - room.ox - bx) + (r() - 0.5) * 0.15;
        const fs = surf(fa, hp.y - 0.95 - r() * 0.2);
        if (fs && fs.p.y > 0.6 && fs.n.y < 0.6 && freeAt(fs.p, 0.16) && r() > grade * 0.07) putB(fs, grade <= 1 ? 'jug' : 'foot', color, ri, grade <= 1 ? 0.6 : 1);
      }
      const tag = surf(az - azStep(0.0), 0.36 + 0.75);
      const t0 = surf(Math.atan2(holds[hand[0]].p.z - bz, holds[hand[0]].p.x - room.ox - bx), 0.36 + 0.7);
      const tg = t0 ?? tag ?? s0;
      route(grade, hand, id, tg.p.clone().addScaledVector(tg.n, 0.012), tg.n, matched);
    }
    // spare holds all over
    for (let k = 0; k < spare; k++) {
      const s = surf(r() * Math.PI * 2, 0.7 + r() * (ry - 0.6));
      if (!s || s.n.y > 0.7 || s.n.y < -0.45 || !freeAt(s.p, 0.3)) continue;
      putB(s, r() < 0.45 ? 'foot' : r() < 0.6 ? 'jug' : kindFor(3), GRADES[Math.floor(r() * GRADES.length)][0], -1, 0.9);
    }
    boulders.push({ id, x: bx, z: bz });
  };
  mkBoulder('ridge', -5, -6, 7.5, 7.2, 5.6, 4, 5, 70, [1, 6]);
  mkBoulder('tower', 8.5, 2, 5.4, 6.0, 4.8, 2, 4, 55, [0, 5]);
  mkBoulder('island', -4, 9, 4.6, 3.8, 3.8, 1, 3, 30, [0, 3]);

  const holdMesh = new THREE.Mesh(mergeGeometries(holdParts)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
  holdMesh.castShadow = true;
  room.group.add(holdMesh);
  if (volParts.length) {
    const vm = new THREE.Mesh(mergeGeometries(volParts)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    vm.castShadow = vm.receiveShadow = true;
    room.group.add(vm);
  }
  // grade / TOP tapes (one draw per tape texture is fine: there are ~60)
  for (const t of tapes) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: t.tex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.copy(t.p);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.n);
    m.userData.noCollide = true;
    room.group.add(m);
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
      const tx = assets.loadNow(assets.art(t));
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
        hip: room.v(sx + 3, 0.5, sz - 5.5), facing: 0, firstPerson: true,
        hint: 'E  Stand up · D  Next send · Mouse  Look around',
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
    // horizontal bars growing from a shared left axis: grade · bar · count
    const x0 = 130, span = 760;
    const rowH = 480 / rows.length;
    rows.forEach((p, i) => {
      const bw = Math.max(6, (p.count / max) * span);
      const y = 130 + i * rowH;
      const bh = rowH - 10;
      g.fillStyle = `#${ROUTE_COLS[(rows.length - 1 - i) % ROUTE_COLS.length].toString(16).padStart(6, '0')}`;
      g.fillRect(x0, y, bw, bh);
      g.fillStyle = '#e8ecf2'; g.font = '700 32px "Avenir Next", sans-serif'; g.textBaseline = 'middle';
      g.textAlign = 'right'; g.fillText(p.grade.toUpperCase(), x0 - 18, y + bh / 2);
      g.textAlign = 'left'; g.fillText(String(p.count), x0 + bw + 14, y + bh / 2);
    });
    g.fillStyle = 'rgba(232,236,242,.35)'; g.fillRect(x0 - 2, 124, 2, 486);
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
  const shoeGeo = climbingShoe();
  const rubber = room.paint(0x1a1a1c, 0.75);
  const strap = room.paint(0x2a2c30, 0.6);
  const SHOE_COLS = [0xd8432f, 0x2f6fd8, 0xf2c230, 0x2fa86a, 0x8a3fd8, 0xff8a3d];
  for (let cx = 0; cx < 6; cx++) for (let cy = 0; cy < 4; cy++) {
    const z = D / 2 - 9 - cx * 0.6;
    const y = 0.2 + cy * 0.45;
    room.box(cubby, W / 2 - 0.3, y, z, 0.4, 0.04, 0.56, false);
    if ((cx * 7 + cy * 3) % 5 === 0) continue; // a few empty slots
    const upper = room.paint(SHOE_COLS[(cx + cy * 2) % SHOE_COLS.length], 0.55);
    for (const side of [-1, 1]) {
      const pair = new THREE.Group();
      pair.add(new THREE.Mesh(shoeGeo.upper, upper), new THREE.Mesh(shoeGeo.sole, rubber), new THREE.Mesh(shoeGeo.strap, strap));
      pair.position.set(W / 2 - 0.32, y + 0.02, z + side * 0.07);
      pair.rotation.y = Math.PI / 2; // toes out toward the room
      pair.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
      room.group.add(pair);
    }
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
  // standing height under any point: crash pads are 0.36 m, the floor is 0
  const groundY = (p: THREE.Vector3) => {
    const lx = p.x - room.ox;
    // (pads run right up to the wall base, so allow a little slack at the edges)
    return pads.some(([px, pz, pw, pd]) => Math.abs(lx - px) <= pw / 2 + 0.4 && Math.abs(p.z - pz) <= pd / 2 + 0.4) ? 0.36 : 0;
  };
  const climbing = new Climbing(game, holds, routes, groundY);
  climbing.onTopOut = (_p, boulder) => {
    if (!boulder) return;
    if (game.save.setFlag(`climb:top:${boulder}`)) game.ui.toast('Topped out!', `The ${boulder} boulder`, '🧗', 'goal');
    game.events.emit('progress', { key: `climb:${boulder}` });
  };
  climbing.onSend = () => drawBoard();
  game.debugRefs.climbing = climbing;
  // every problem starts at its tape: walk up and press E
  routes.forEach((rt) => {
    room.interactables.push({
      id: `route:${rt.id}`,
      position: rt.tag.clone().addScaledVector(rt.tagN, 0.3),
      radius: 1.7,
      verb: () => (game.save.flag(`climb:send:${rt.id}`) ? 'Climb again' : 'Climb'),
      label: () => `V${rt.grade} · ${rt.colour}${game.save.flag(`climb:flash:${rt.id}`) ? ' ⚡' : game.save.flag(`climb:send:${rt.id}`) ? ' ✓' : ''}`,
      enabled: () => !climbing.active,
      onInteract: () => climbing.startRoute(rt),
    });
  });
  // or just jump onto any wall and climb whatever's in reach
  room.interactables.push({
    id: 'climb',
    position: () => climbing.probe()?.point ?? room.v(0, -100, 0),
    radius: 1.4,
    facing: false,
    verb: 'Free climb',
    label: 'the wall',
    priority: -1,
    enabled: () => !climbing.active && climbing.probe() !== null,
    onInteract: () => { const s = climbing.probe(); if (s) climbing.startFree(s); },
  });
  room.updates.push(() => climbing.applyIK());
  room.onEnter(() => { game.player.jumpInterceptor = () => { const s = climbing.probe(); return s ? climbing.startFree(s) : false; }; });
  room.onExit(() => { game.player.jumpInterceptor = null; });

  // ---- problem board: sends by grade (redrawn after each send) ----
  const boardC = document.createElement('canvas');
  boardC.width = 1024; boardC.height = 640;
  const boardTex = new THREE.CanvasTexture(boardC);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const drawBoard = () => {
    const g = boardC.getContext('2d')!;
    g.fillStyle = '#16181d'; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = '#fff'; g.font = '800 60px "Avenir Next Condensed", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const sends = routes.filter((rt) => game.save.flag(`climb:send:${rt.id}`)).length;
    g.fillText('PROBLEMS', 40, 80);
    g.textAlign = 'right'; g.fillStyle = '#ffa53a'; g.fillText(`${sends} / ${routes.length}`, 984, 80);
    GRADES.forEach(([col, name], gr) => {
      const list = routes.filter((rt) => rt.grade === gr);
      if (!list.length) return;
      const y = 130 + gr * 62;
      g.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
      g.fillRect(40, y, 40, 40);
      g.fillStyle = '#e8ecf2'; g.font = '700 30px "Avenir Next", sans-serif'; g.textAlign = 'left';
      g.fillText(`V${gr}  ${name}`, 100, y + 31);
      list.forEach((rt, k) => {
        const x = 470 + k * 58;
        const sent = game.save.flag(`climb:send:${rt.id}`);
        const flash = game.save.flag(`climb:flash:${rt.id}`);
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3;
        g.strokeRect(x, y + 4, 40, 32);
        if (sent) { g.fillStyle = flash ? '#ffc23a' : '#5ee08f'; g.fillRect(x + 4, y + 8, 32, 24); }
      });
    });
    boardTex.needsUpdate = true;
  };
  drawBoard();
  room.art(boardTex, 4.0, 2.5, -6.5, 3.2, D / 2 - 0.08, Math.PI, { frame: 0x24262b, glow: 0.25 });

  room.exitTo('climb');
  return room.finish({ id: 'climb', name: 'Climbing Gym', music: 'climbing', ambience: 'gym', envIntensity: 0.55, boom: 4.6, spawn: { x: 0, z: D / 2 - 2, facing: Math.PI } });
}
