// The pocket park (NE corner of the block): lawns with wind-blown grass,
// gravel paths, a fountain, shade trees, hedges, flower beds, benches and a
// low iron fence. Exports points of interest for the pets' behaviours.

import * as THREE from 'three';
import type { Assets } from '../engine/Assets';
import type { Physics } from '../engine/Physics';
import { Batches, boxGeo, floorGeo } from './geo';
import { CURB_H, PARK } from './layout';
import type { Vegetation } from './Vegetation';
import { rng } from '../engine/math';

export interface ParkPOI {
  fountain: THREE.Vector3;
  sunSpot: THREE.Vector3;
  hideSpot: THREE.Vector3;
  lawn: THREE.Vector3;
  ballSpawn: THREE.Vector3;
  benches: THREE.Vector3[];
  gates: THREE.Vector3[];
  wander: THREE.Vector3[];
}

const Y = CURB_H;

export function buildPark(assets: Assets, physics: Physics, veg: Vegetation): { group: THREE.Group; poi: ParkPOI; update: (dt: number, t: number) => void; isPath: (x: number, z: number) => boolean } {
  const group = new THREE.Group();
  const B = new Batches();
  const r = rng(8080);
  const cx = (PARK.minX + PARK.maxX) / 2;
  const cz = (PARK.minZ + PARK.maxZ) / 2;
  const fountain = new THREE.Vector3(cx + 1, Y, cz);

  // ---- lawn + soil ----
  const lawn = assets.pbr('leafy_grass', { scale: 3, tint: 0xb8c49a });
  const g = floorGeo(PARK.maxX - PARK.minX, PARK.maxZ - PARK.minZ);
  g.translate(cx, Y + 0.006, cz);
  B.add(lawn, g, undefined, false, true);

  // ---- paths (polylines) ----
  const gravel = assets.pbr('gravel_floor', { scale: 2.2, tint: 0xe2d8c4 });
  const paths: Array<{ pts: THREE.Vector2[]; w: number }> = [
    { pts: [new THREE.Vector2(PARK.maxX, PARK.minZ + 2.5), new THREE.Vector2(fountain.x + 3, fountain.z - 2)], w: 2.4 },
    { pts: [new THREE.Vector2(cx - 4, PARK.minZ), new THREE.Vector2(cx - 3, PARK.minZ + 5), new THREE.Vector2(fountain.x - 2.2, fountain.z - 2.4)], w: 2.2 },
    { pts: [new THREE.Vector2(PARK.maxX, cz + 5), new THREE.Vector2(fountain.x + 3.2, fountain.z + 1.2)], w: 2.2 },
  ];
  // ring around the fountain
  const ring: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) ring.push(new THREE.Vector2(fountain.x + Math.cos((i / 24) * Math.PI * 2) * 3.6, fountain.z + Math.sin((i / 24) * Math.PI * 2) * 3.6));
  paths.push({ pts: ring, w: 1.8 });
  const segDist = (x: number, z: number, a: THREE.Vector2, b: THREE.Vector2) => {
    const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, new THREE.Vector2(x, z).sub(a).dot(ab) / ab.lengthSq()));
    return new THREE.Vector2(x, z).distanceTo(a.clone().addScaledVector(ab, t));
  };
  const isPath = (x: number, z: number) => {
    for (const p of paths) for (let i = 0; i < p.pts.length - 1; i++) if (segDist(x, z, p.pts[i], p.pts[i + 1]) < p.w / 2) return true;
    return Math.hypot(x - fountain.x, z - fountain.z) < 2.6;
  };
  for (const p of paths) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i];
      const b = p.pts[i + 1];
      const len = a.distanceTo(b) + p.w * 0.5;
      const sg = floorGeo(p.w, len);
      sg.rotateY(-Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2);
      sg.translate((a.x + b.x) / 2, Y + 0.012, (a.y + b.y) / 2);
      B.add(gravel, sg, undefined, false, true);
      // round joint
      const jg = new THREE.CircleGeometry(p.w / 2, 16);
      jg.rotateX(-Math.PI / 2);
      const juv = jg.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < juv.count; k++) juv.setXY(k, juv.getX(k) * p.w, juv.getY(k) * p.w);
      jg.translate(b.x, Y + 0.011, b.y);
      B.add(gravel, jg, undefined, false, true);
    }
  }

  // ---- fountain ----
  const stone = assets.pbr('brushed_concrete', { scale: 1.2, tint: 0xe6e0d4 });
  const basin = new THREE.CylinderGeometry(2.3, 2.45, 0.55, 40, 1, true);
  basin.translate(fountain.x, Y + 0.275, fountain.z);
  B.add(stone, basin);
  const rim = new THREE.TorusGeometry(2.32, 0.16, 8, 48);
  rim.rotateX(Math.PI / 2);
  rim.translate(fountain.x, Y + 0.56, fountain.z);
  B.add(stone, rim);
  const inner = new THREE.CylinderGeometry(2.15, 2.15, 0.5, 40, 1, true);
  inner.scale(-1, 1, 1);
  inner.translate(fountain.x, Y + 0.25, fountain.z);
  B.add(stone, inner);
  const pedestal = new THREE.CylinderGeometry(0.35, 0.5, 1.5, 20);
  pedestal.translate(fountain.x, Y + 0.75, fountain.z);
  B.add(stone, pedestal);
  const bowl = new THREE.CylinderGeometry(1.0, 0.3, 0.35, 28);
  bowl.translate(fountain.x, Y + 1.55, fountain.z);
  B.add(stone, bowl);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.15, 48), waterMaterial());
  water.rotation.x = -Math.PI / 2;
  water.position.set(fountain.x, Y + 0.42, fountain.z);
  group.add(water);
  const water2 = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), water.material);
  water2.rotation.x = -Math.PI / 2;
  water2.position.set(fountain.x, Y + 1.7, fountain.z);
  group.add(water2);
  physics.cylinder(fountain.x, Y + 0.3, fountain.z, 0.3, 2.45, { kind: 'static', surface: 'concrete' });
  physics.cylinder(fountain.x, Y + 0.9, fountain.z, 0.9, 0.55, { kind: 'static', surface: 'concrete' });
  const spray = sprayPoints(fountain.clone().add(new THREE.Vector3(0, 1.72, 0)));
  group.add(spray.points);

  // ---- iron fence on the street sides (north + east), with gates ----
  const iron = new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: 0.45, metalness: 0.7 });
  const gates = [new THREE.Vector3(PARK.maxX, Y, PARK.minZ + 2.5), new THREE.Vector3(cx - 4, Y, PARK.minZ), new THREE.Vector3(PARK.maxX, Y, cz + 5)];
  const fenceH = 0.95;
  const fenceRun = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const dirX = (bx - ax) / len;
    const dirZ = (bz - az) / len;
    let s = 0;
    while (s < len) {
      // break for gates
      const px = ax + dirX * s;
      const pz = az + dirZ * s;
      const nearGate = gates.some((gp) => Math.hypot(gp.x - px, gp.z - pz) < 1.6);
      if (!nearGate) {
        const picket = boxGeo(0.035, fenceH, 0.035);
        picket.translate(px, Y + fenceH / 2, pz);
        B.add(iron, picket);
        const finial = new THREE.ConeGeometry(0.035, 0.1, 6);
        finial.translate(px, Y + fenceH + 0.05, pz);
        B.add(iron, finial, undefined, false);
      }
      s += 0.14;
    }
    // rails, split around gates
    let segStart = 0;
    const flush = (s0: number, s1: number) => {
      if (s1 - s0 < 0.2) return;
      const mx = ax + dirX * (s0 + s1) / 2;
      const mz = az + dirZ * (s0 + s1) / 2;
      for (const ry of [0.12, fenceH - 0.08]) {
        const rail = boxGeo(Math.abs(dirX) * (s1 - s0) + 0.04, 0.04, Math.abs(dirZ) * (s1 - s0) + 0.04);
        rail.translate(mx, Y + ry, mz);
        B.add(iron, rail);
      }
      physics.aabb(Math.min(ax + dirX * s0, ax + dirX * s1) - 0.06, Y, Math.min(az + dirZ * s0, az + dirZ * s1) - 0.06,
        Math.max(ax + dirX * s0, ax + dirX * s1) + 0.06, Y + fenceH, Math.max(az + dirZ * s0, az + dirZ * s1) + 0.06, { kind: 'static', surface: 'metal', cameraIgnore: true });
    };
    for (const gp of gates) {
      const t = (gp.x - ax) * dirX + (gp.z - az) * dirZ;
      const off = Math.hypot(ax + dirX * t - gp.x, az + dirZ * t - gp.z);
      if (off < 0.5 && t > 0 && t < len) {
        flush(segStart, t - 1.6);
        segStart = t + 1.6;
        // gate posts
        for (const side of [-1.6, 1.6]) {
          const post = boxGeo(0.14, fenceH + 0.35, 0.14);
          post.translate(ax + dirX * (t + side), Y + (fenceH + 0.35) / 2, az + dirZ * (t + side));
          B.add(iron, post);
        }
      }
    }
    flush(segStart, len);
  };
  fenceRun(PARK.minX + 0.3, PARK.minZ + 0.3, PARK.maxX - 0.3, PARK.minZ + 0.3);
  fenceRun(PARK.maxX - 0.3, PARK.minZ + 0.3, PARK.maxX - 0.3, PARK.maxZ - 0.3);

  // ---- trees, hedges, flowers ----
  veg.trees([
    { x: PARK.minX + 4, y: Y, z: PARK.minZ + 4.5, s: 1 },
    { x: PARK.maxX - 5, y: Y, z: PARK.minZ + 7, s: 0.9 },
    { x: PARK.minX + 4.5, y: Y, z: PARK.maxZ - 4.5, s: 1.05 },
    { x: PARK.maxX - 7, y: Y, z: PARK.maxZ - 3.5, s: 0.85 },
  ], 'park', 2);
  const hedges: Array<{ x: number; y: number; z: number; s: number }> = [];
  for (let z = PARK.minZ + 9; z < PARK.maxZ - 1; z += 1.5) hedges.push({ x: PARK.minX + 0.9, y: Y, z, s: 1.0 + r() * 0.2 });
  for (let x = PARK.minX + 9; x < PARK.maxX - 8; x += 1.5) hedges.push({ x, y: Y, z: PARK.maxZ - 0.9, s: 0.9 + r() * 0.2 });
  const hideSpot = new THREE.Vector3(PARK.minX + 2.6, Y, PARK.maxZ - 7);
  hedges.push({ x: hideSpot.x + 0.3, y: Y, z: hideSpot.z - 0.6, s: 1.5 }, { x: hideSpot.x + 1.4, y: Y, z: hideSpot.z + 0.4, s: 1.3 });
  veg.bushes(hedges, true);
  const beds: Array<[string, number, number, number]> = [
    ['flower_gazania', fountain.x - 5.5, fountain.z + 4.2, 0.4], ['periwinkle_plant', fountain.x + 5.2, fountain.z + 4.5, 1.2],
    ['flower_gazania', fountain.x + 5.5, fountain.z - 4.4, 2.2], ['periwinkle_plant', fountain.x - 5.3, fountain.z - 4.6, 3.0],
  ];
  for (const [id, x, z, ry] of beds) {
    const f = assets.prop(id, { castShadow: false });
    f.position.set(x, Y + 0.01, z);
    f.rotation.y = ry;
    group.add(f);
  }

  // ---- furniture ----
  const benches: THREE.Vector3[] = [];
  for (const a of [0.6, 2.2, 3.9, 5.3]) {
    const p = new THREE.Vector3(fountain.x + Math.cos(a) * 5.0, Y, fountain.z + Math.sin(a) * 5.0);
    const b = assets.prop('painted_wooden_bench');
    b.position.copy(p);
    b.rotation.y = -a - Math.PI / 2;
    group.add(b);
    physics.fromObject(b, 'bounds', { kind: 'static', surface: 'wood' });
    benches.push(p);
  }
  const picnic = assets.prop('wooden_picnic_table');
  picnic.position.set(PARK.maxX - 5.5, Y, PARK.maxZ - 8);
  picnic.rotation.y = 0.35;
  group.add(picnic);
  physics.fromObject(picnic, 'bounds', { kind: 'static', surface: 'wood' });
  const bin = assets.prop('metal_trash_can', { parts: ['metal_trash_can_rust', 'metal_trash_can_rust_handle_left', 'metal_trash_can_rust_handle_right'] });
  bin.position.set(gates[0].x - 1.6, Y, gates[0].z + 2.4);
  group.add(bin);
  physics.fromObject(bin, 'bounds', { kind: 'static', surface: 'metal' });
  const statue = assets.prop('concrete_cat_statue', { scale: 2.2 });
  statue.position.set(PARK.maxX - 1.6, Y, PARK.maxZ - 1.6);
  statue.rotation.y = -2.4;
  group.add(statue);
  physics.cylinder(statue.position.x, Y + 0.3, statue.position.z, 0.3, 0.3, { kind: 'static', surface: 'concrete' });
  // HuHu's sunny blanket
  const sunSpot = new THREE.Vector3(fountain.x - 6.5, Y, fountain.z + 1.5);
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshStandardMaterial({ map: plaidTexture(), roughness: 0.95 }));
  blanket.rotation.x = -Math.PI / 2;
  blanket.rotation.z = 0.3;
  blanket.position.set(sunSpot.x, Y + 0.02, sunSpot.z);
  blanket.receiveShadow = true;
  group.add(blanket);

  B.build(group);

  const wander: THREE.Vector3[] = [];
  for (let i = 0; i < 18; i++) {
    const x = PARK.minX + 3 + r() * (PARK.maxX - PARK.minX - 6);
    const z = PARK.minZ + 3 + r() * (PARK.maxZ - PARK.minZ - 6);
    if (Math.hypot(x - fountain.x, z - fountain.z) < 3.4) continue;
    wander.push(new THREE.Vector3(x, Y, z));
  }

  const poi: ParkPOI = {
    fountain, sunSpot, hideSpot,
    lawn: new THREE.Vector3(PARK.maxX - 7, Y, PARK.minZ + 12),
    ballSpawn: new THREE.Vector3(PARK.maxX - 6, Y + 0.2, PARK.minZ + 10),
    benches, gates, wander,
  };

  const update = (dt: number, t: number) => {
    (water.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    spray.update(dt);
  };
  return { group, poi, update, isPath };
}

function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float r = length(vUv - 0.5);
        float rip = sin(r * 60.0 - uTime * 4.0) * 0.5 + 0.5;
        float n = sin(p.x * 3.1 + uTime * 1.3) * sin(p.y * 2.7 - uTime * 1.1);
        vec3 deep = vec3(0.10, 0.24, 0.26);
        vec3 shallow = vec3(0.32, 0.55, 0.55);
        vec3 c = mix(deep, shallow, 0.5 + 0.25 * n);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        c = mix(c, vec3(0.78, 0.86, 0.95), fres * 0.7 + rip * 0.06);
        c += smoothstep(0.92, 1.0, rip) * 0.08;
        gl_FragColor = vec4(c, 0.88);
      }`,
  });
}

function sprayPoints(origin: THREE.Vector3): { points: THREE.Points; update: (dt: number) => void } {
  const N = 260;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const r = rng(5);
  const reset = (i: number) => {
    const a = r() * Math.PI * 2;
    const sp = 0.5 + r() * 0.7;
    pos.set([origin.x, origin.y + 0.15, origin.z], i * 3);
    vel.set([Math.cos(a) * sp, 2.4 + r() * 1.0, Math.sin(a) * sp], i * 3);
    life[i] = r() * 1.2;
  };
  for (let i = 0; i < N; i++) reset(i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdfeff5, size: 0.06, transparent: true, opacity: 0.75, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const update = (dt: number) => {
    for (let i = 0; i < N; i++) {
      life[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (life[i] < 0 || pos[i * 3 + 1] < origin.y - 1.3) reset(i);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, update };
}

function plaidTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b23a3a';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(30,40,70,0.55)';
  for (let i = 0; i < 256; i += 64) { g.fillRect(i, 0, 22, 256); g.fillRect(0, i, 256, 22); }
  g.fillStyle = 'rgba(255,240,200,0.35)';
  for (let i = 30; i < 256; i += 64) { g.fillRect(i, 0, 4, 256); g.fillRect(0, i, 256, 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
