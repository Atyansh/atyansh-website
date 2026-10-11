// Assembles the street level: buildings, streets, park, vegetation, skyline,
// door interactables and the per-frame city updates.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import type { Interactable } from '../game/Interaction';
import { CityBuilder } from './Facades';
import { buildStreets } from './Street';
import { buildPark, type ParkPOI } from './Park';
import { Vegetation, windUniforms } from './Vegetation';
import { buildSkyline } from './Skyline';
import { NightLights } from './NightLights';
import { cityUniforms } from './WindowMaterial';
import { CORNER_BLOCKS, CURB, CURB_H, LOTS, OUTER_FRONT, OUTER_LOTS, PARK, type Lot } from './layout';
import type { ArtItem } from '../data';

export interface CityLevel extends Level {
  park: ParkPOI;
  doors: Array<{ lot: Lot; position: THREE.Vector3; facing: number }>;
  lights: NightLights;
  kiosk: THREE.Vector3;
}

export function buildCity(game: Game): CityLevel {
  const { assets, physics, data } = game;
  const group = new THREE.Group();
  group.name = 'street';
  const lights = new NightLights(game.scene);

  // ---- what each storefront shows (real data) ----
  const pick = (items: ArtItem[] | undefined, i: number) => (items && items[i] ? assets.art(items[i].art) : null);
  const display = (lot: Lot, slot: number): THREE.Texture | null => {
    switch (lot.id) {
      case 'cinema': return pick(data.movies, 4 + slot);
      case 'records': return pick(data.music, slot);
      case 'arcade': return pick(data.games, slot);
      case 'books': return pick(data.books, slot);
      case 'anime': return pick(data.anime, slot);
      case 'tv': return pick(data.tv, slot);
      default: return null;
    }
  };

  const corners: Lot[] = CORNER_BLOCKS.map((c, i) => ({
    id: `corner${i}`, name: '', x: c.x, z: c.z, w: 24, d: 24, h: c.h, facing: 's', style: i % 2 ? 'concrete' : 'brickDark', ground: 'blank', accent: 0, backdrop: true,
  }));
  const all = [...LOTS, ...OUTER_LOTS, ...corners];
  const city = new CityBuilder(assets, physics, lights, display, all);
  for (const lot of all) city.build(lot);
  const cinema = LOTS.find((l) => l.id === 'cinema')!;
  city.cinemaFront(cinema, [0, 1, 2, 3].map((i) => pick(data.movies, i)).filter((t): t is THREE.Texture => !!t));
  city.gymMural(LOTS.find((l) => l.id === 'climb')!);
  city.finalize(group);

  // ---- streets, vegetation, park, skyline ----
  const streets = buildStreets(assets, physics, lights, all);
  group.add(streets.group);
  const poster = data.movies?.[0];
  if (poster) {
    streets.busPosterSlot.map = assets.art(poster.art);
    streets.busPosterSlot.emissiveMap = streets.busPosterSlot.map;
    streets.busPosterSlot.needsUpdate = true;
  }
  const veg = new Vegetation(assets, physics);
  veg.trees(streets.treeSpots.map((t) => ({ x: t.x, y: CURB_H, z: t.z, s: t.s })), 'street', 3);
  const park = buildPark(assets, physics, veg);
  group.add(park.group);
  veg.grass([{ minX: PARK.minX + 0.4, maxX: PARK.maxX - 0.4, minZ: PARK.minZ + 0.4, maxZ: PARK.maxZ - 0.4, y: CURB_H + 0.01 }], 150,
    (x, z) => park.isPath(x, z));
  group.add(veg.group);
  group.add(buildSkyline(lights));

  // ---- doors ----
  const interactables: Interactable[] = [];
  for (const door of city.doors) {
    const id = door.lot.enter!;
    interactables.push({
      id: `door:${id}`,
      position: door.position.clone().add(new THREE.Vector3(0, 1, 0)),
      radius: 2.4,
      verb: 'Enter',
      label: door.lot.name,
      priority: 1,
      enabled: () => game.levels.has(id),
      onInteract: () => { void game.goTo(id); },
    });
  }

  // ---- fire escape on the deli's alley wall → its roof (golden record up there) ----
  {
    const deli = LOTS.find((l) => l.id === 'deli')!;
    const wallX = deli.x + deli.w / 2; // east face, on the alley
    const roofY = CURB_H + deli.h;
    const fe = assets.prop('modular_fire_escape');
    // bottom platform ≈2.3m up (drop-ladder height): walk under it, not through it
    fe.position.set(wallX + 0.72, CURB_H + 5.55, deli.z - 1.5);
    fe.rotation.y = -Math.PI / 2;
    group.add(fe);
    physics.fromObject(fe, 'box', { kind: 'static', surface: 'metal', cameraIgnore: true });
    const bottom = new THREE.Vector3(wallX + 0.9, CURB_H, deli.z + 2.2);
    const top = new THREE.Vector3(deli.x + 1.0, roofY, deli.z + 2.2);
    const climbTo = (dest: THREE.Vector3, facing: number) => {
      game.beginActivity({ name: 'ladder', update: () => {} });
      game.player.character.play('Mantle', { loop: true, timeScale: 0.9 });
      void game.ui.fade(true).then(() => {
        game.player.teleport(dest, facing);
        game.rig.snapBehind(facing);
        game.endActivity();
        void game.ui.fade(false);
      });
    };
    interactables.push(
      { id: 'fire-escape:up', position: bottom.clone().add(new THREE.Vector3(0, 1, 0)), radius: 1.6, verb: 'Climb', label: 'the fire escape', onInteract: () => climbTo(top, Math.PI / 2) },
      { id: 'fire-escape:down', position: top.clone().add(new THREE.Vector3(0, 1, 0)), radius: 1.6, verb: 'Climb down', label: 'the fire escape', onInteract: () => climbTo(bottom.clone().add(new THREE.Vector3(0.6, 0, 0)), Math.PI / 2) },
    );
  }

  // ---- alley dressing ----
  {
    const ax0 = 0 - 1; // ALLEY.minX
    const ax1 = 5;     // ALLEY.maxX
    const put = (id: string, x: number, z: number, ry: number, opts: Record<string, unknown> = {}, y = CURB_H, collide = true) => {
      const o = assets.prop(id, opts);
      o.position.set(x, y, z);
      o.rotation.y = ry;
      group.add(o);
      if (collide) physics.fromObject(o, 'bounds', { kind: 'static', surface: 'metal' });
    };
    put('wooden_crate_01', ax0 + 0.5, 12, 0.2);
    put('wooden_crate_01', ax0 + 0.5, 12, 0.5, {}, CURB_H + 0.35, false);
    put('plastic_crate_01', ax0 + 0.5, 13.2, 0.1);
    put('plastic_crate_01', ax0 + 0.9, 13.1, 0.7);
    for (const [dx, dz] of [[0.4, 5], [0.7, 5.6], [0.3, 6.3]]) put('trashbag', ax1 - dx, dz, dz * 3, {}, CURB_H, false);
    put('metal_trash_can', ax1 - 0.5, 7.4, Math.PI / 2, { parts: ['metal_trash_can_rust', 'metal_trash_can_rust_handle_left', 'metal_trash_can_rust_handle_right', 'metal_trash_can_rust_lid'] });
    put('utility_box_01', ax0 + 0.28, -6, Math.PI / 2);
    put('power_box_01', ax1 - 0.05, -10, -Math.PI / 2, {}, CURB_H + 1.8, false);
    put('security_light', ax0 + 0.05, -2, Math.PI / 2, {}, CURB_H + 3.6, false);
    put('security_light', ax1 - 0.05, 16, -Math.PI / 2, {}, CURB_H + 3.6, false);
    put('exterior_aircon_unit', ax1 - 0.3, -16, -Math.PI / 2, { parts: ['exterior_aircon_unit_rusted'] }, CURB_H + 2.4, false);
    put('tree_stump_01', PARK.maxX - 3.2, PARK.maxZ - 11, 0.7, { scale: 0.8 });
  }

  // ---- time of day ----
  game.sky.onChange.push((_t, night) => {
    lights.set(night);
    cityUniforms.tSky.value = (game.sky.dome.material as THREE.ShaderMaterial).uniforms.tSky.value;
  });
  lights.set(game.sky.night);
  cityUniforms.tSky.value = (game.sky.dome.material as THREE.ShaderMaterial).uniforms.tSky.value;

  const level: CityLevel = {
    id: 'street',
    name: 'The Block',
    group,
    interior: false,
    music: 'home',
    ambience: 'street',
    spawn: { position: new THREE.Vector3(-14, CURB_H, CURB.z - 1.5), facing: Math.PI },
    interactables,
    boom: 4.4,
    shadowExtent: 48,
    bounds: { minX: -OUTER_FRONT.x, maxX: OUTER_FRONT.x, minZ: -OUTER_FRONT.z, maxZ: OUTER_FRONT.z },
    park: park.poi,
    doors: city.doors,
    lights,
    kiosk: streets.kiosk,
    update: (dt, t) => {
      streets.update(dt, t);
      park.update(dt, t);
      windUniforms.time.value = t;
      cityUniforms.time.value = t;
      lights.update(game.player.position, true);
    },
    onExit: () => lights.update(game.player.position, false),
  };
  return level;
}
