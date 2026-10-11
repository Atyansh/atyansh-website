// The Block — entry point (dynamically imported by src/pages/world.astro).

import * as THREE from 'three';
import { Game } from './game/Game';
import { UI } from './ui/UI';
import { loadWorldData } from './data';
import { buildTestRange } from './world/TestRange';
import { buildCity } from './world/City';
import { buildInteriors } from './interiors';
import type { TimeOfDay } from './world/Sky';

const PROPS = [
  'street_lamp_01', 'street_lamp_02', 'painted_wooden_bench', 'modular_street_seating', 'fire_hydrant',
  'metal_trash_can', 'trashbag', 'utility_box_01', 'power_box_01', 'exterior_aircon_unit', 'modular_fire_escape',
  'covered_car', 'concrete_road_barrier', 'planter_box_01', 'rollershutter_door', 'security_light',
  'wooden_crate_01', 'plastic_crate_01', 'shrub_01', 'shrub_02', 'shrub_03', 'shrub_04', 'wooden_picnic_table',
  'concrete_cat_statue', 'tree_stump_01', 'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'flower_gazania',
  'periwinkle_plant', 'grass_medium_01', 'Sofa_01', 'sofa_02', 'sofa_03', 'ArmChair_01', 'mid_century_lounge_chair',
  'modern_arm_chair_01', 'CoffeeTable_01', 'modern_coffee_table_01', 'round_wooden_table_01', 'side_table_01',
  'bar_chair_round_01', 'metal_stool_01', 'Television_01', 'television_02', 'gaming_console', 'CashRegister_01',
  'CoffeeCart_01', 'steel_frame_shelves_01', 'wooden_bookshelf_worn', 'Shelf_01', 'desk_lamp_arm_01', 'classic_laptop',
  'metal_office_desk', 'modern_ceiling_lamp_01', 'hanging_industrial_lamp', 'mounted_fluorescent_lights',
  'filmstrip_projector_8mm', 'boombox', 'cassette_player', 'wall_clock', 'book_encyclopedia_set_01', 'WetFloorSign_01',
  'ceiling_fan', 'hanging_picture_frame_01', 'outdoor_table_chair_set_01',
];

export async function boot(container: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const game = new Game(container);
  const ui = new UI(container);
  ui.game = game;
  await game.init(ui);
  game.start();

  // ---- load ----
  let done = 0;
  const total = PROPS.length + 2;
  const tick = () => ui.setProgress(++done / total);
  game.assets.onProgress = (loaded, t) => ui.setProgress(Math.min(0.95, loaded / Math.max(t, total)));
  const [gltf, data] = await Promise.all([
    game.assets.glb('characters/mannequin.glb').then((g) => { tick(); return g; }),
    loadWorldData().then((d) => { tick(); return d; }),
    game.assets.preloadProps(PROPS),
  ]);
  game.characterGltf = gltf;
  game.data = data;
  const tod = (params.get('time') as TimeOfDay | null) ?? game.save.settings.timeOfDay;
  await game.sky.set(tod);

  // ---- levels ----
  const city = buildCity(game);
  game.addLevel(city);
  buildInteriors(game);
  if (params.get('level') === 'test') game.addLevel(buildTestRange(game));
  const startId = params.get('level') === 'test' ? 'test' : 'street';
  const start = game.levels.get(startId)!;
  game.createPlayer(start.spawn.position, start.spawn.facing);
  await game.goTo(startId, undefined, false);
  ui.setProgress(1);

  // ---- title ----
  const titleCam = (dt: number, cam: THREE.PerspectiveCamera) => {
    // slow crane shot down Atyansh Ave toward the cinema
    const t = game.time * 0.04;
    cam.position.set(-34 + Math.sin(t) * 22, 7 + Math.sin(t * 0.7) * 2, 41);
    cam.lookAt(-12 + Math.sin(t) * 10, 5, 22);
    cam.fov = 55;
    void dt;
  };
  game.cameraOverride = titleCam;
  game.state = 'title';
  ui.hideLoading();
  ui.showTitle(game.save.data.started);

  const startPlaying = (fresh: boolean) => {
    if (fresh) game.save.reset();
    game.save.data.started = true;
    game.save.write();
    game.cameraOverride = null;
    ui.hideTitle();
    ui.setHudVisible(true);
    ui.setFpsVisible(game.save.settings.showFps);
    game.state = 'playing';
    game.input.lock();
    ui.showBanner(game.level.name, 'atyansh.com');
  };
  ui.onStart = startPlaying;
  // Clicking the canvas while paused resumes (and re-locks the pointer)
  game.renderer.domElement.addEventListener('click', () => {
    if (game.state === 'paused') game.resume();
    else if (game.state === 'playing' && !game.input.pointerLocked) game.input.lock();
  });

  // ---- harness hooks ----
  const hooks = {
    ready: true,
    game,
    play: () => startPlaying(false),
    stats: () => game.stats(),
    camera: (pos: [number, number, number], look: [number, number, number], fov = 62) => {
      game.cameraOverride = (_dt, cam) => {
        cam.position.set(...pos);
        cam.lookAt(...look);
        cam.fov = fov;
      };
    },
    freeCamera: () => { game.cameraOverride = null; },
    teleport: (x: number, y: number, z: number, facing = 0) => game.player.teleport(new THREE.Vector3(x, y, z), facing),
    goTo: (id: string) => game.goTo(id),
    time: (t: TimeOfDay) => game.setTimeOfDay(t),
    hideUi: () => { ui.root.style.display = 'none'; },
    /** Trigger the nearest/named interactable as if E was pressed */
    interact: (id?: string) => {
      const list = [...game.level.interactables, ...game.globalInteractables];
      const it = id ? list.find((x) => x.id.startsWith(id)) : game.interaction.current;
      it?.onInteract();
      return it?.id ?? null;
    },
    levelPos: () => ({ level: game.level.id, p: game.player.position.toArray().map((v) => +v.toFixed(2)), state: game.player.state, activity: game.activity?.name ?? null }),
  };
  (window as unknown as { __world: typeof hooks }).__world = hooks;
}
