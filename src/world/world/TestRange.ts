// Dev-only test range (/world?level=test): ledges at every mantle height,
// stairs, a ramp and a few props — for tuning movement, camera and lighting
// in isolation.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';

export function buildTestRange(game: Game): Level {
  const { assets, physics } = game;
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), assets.pbr('concrete_tiles_02', { scale: 3 }));
  ground.geometry.attributes.uv.array.forEach((_, i, a) => { (a as Float32Array)[i] *= 80; });
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  physics.aabb(-40, -1, -40, 40, 0, 40, { kind: 'static', surface: 'concrete' });

  const blockMat = assets.pbr('brick_wall_02', { scale: 1.6 });
  const box = (x: number, z: number, w: number, h: number, d: number, mat: THREE.Material = blockMat) => {
    const g = new THREE.BoxGeometry(w, h, d);
    // metre UVs per face
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const sx = ax > 0.5 ? d : w;
      const sy = ay > 0.5 ? d : h;
      uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
    }
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    physics.aabb(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { kind: 'static', surface: 'concrete' });
  };
  [0.5, 0.9, 1.3, 1.7, 2.0, 3.0].forEach((h, i) => box(-12 + i * 4.5, -8, 3, h, 3));
  // stairs
  for (let s = 0; s < 8; s++) box(10, 4 + s * 0.4, 3, 0.18 * (s + 1), 0.4, assets.pbr('brushed_concrete', { scale: 2 }));
  // ramp
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 8), assets.pbr('brushed_concrete', { scale: 2 }));
  ramp.position.set(-14, 1.3, 6);
  ramp.rotation.x = -0.32;
  ramp.castShadow = ramp.receiveShadow = true;
  group.add(ramp);
  ramp.updateMatrixWorld();
  physics.fromObject(ramp, 'box', { kind: 'static', surface: 'concrete' });

  const place = (id: string, x: number, z: number, ry = 0, opts = {}) => {
    const o = assets.prop(id, opts);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    group.add(o);
    physics.fromObject(o, 'bounds', { kind: 'static', surface: 'metal' });
    return o;
  };
  place('street_lamp_01', 3, 3);
  place('painted_wooden_bench', 0, 6, Math.PI);
  place('fire_hydrant', 5, 7, 0, { parts: ['fire_hydrant', 'fire_hydrant_cap_01', 'fire_hydrant_cap_02', 'fire_hydrant_cap_03', 'fire_hydrant_chain'] });
  place('metal_trash_can', -3, 7, 0, { parts: ['metal_trash_can', 'metal_trash_can_handle_left', 'metal_trash_can_handle_right'] });
  place('Sofa_01', 6, -2, -Math.PI / 2);
  place('covered_car', -6, 14, 0.3);

  return {
    id: 'test', name: 'Test Range', group, interior: false, music: 'home', ambience: 'street',
    spawn: { position: new THREE.Vector3(0, 0, 10), facing: Math.PI },
    interactables: [],
  };
}
