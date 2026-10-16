// The Block — entry point (dynamically imported by src/pages/world.astro).

import * as THREE from 'three';
import { Game } from './game/Game';
import { UI } from './ui/UI';
import { loadWorldData } from './data';
import { buildTestRange } from './world/TestRange';
import { buildCity } from './world/City';
import { buildInteriors } from './interiors';
import { Pets } from './game/pets/Pets';
import { Progress, GoldenRecords } from './game/Progress';
import { Minimap } from './ui/Minimap';
import { Phone } from './ui/Phone';
import { PhotoMode } from './game/PhotoMode';
import { WorldAudio } from './audio/WorldAudio';
import { Life } from './game/Life';
import { PhonePose } from './game/PhonePose';
import { outfitById, NPC_AVATARS } from './game/outfits';
import type { TimeOfDay } from './world/Sky';

const PROPS = [
  'street_lamp_01', 'painted_wooden_bench', 'fire_hydrant',
  'metal_trash_can', 'trashbag', 'utility_box_01', 'power_box_01', 'exterior_aircon_unit', 'modular_fire_escape',
  'covered_car', 'concrete_road_barrier', 'rollershutter_door', 'security_light',
  'wooden_crate_01', 'plastic_crate_01', 'wooden_picnic_table',
  'concrete_cat_statue', 'tree_stump_01', 'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'flower_gazania',
  'periwinkle_plant', 'Sofa_01', 'sofa_02', 'sofa_03', 'ArmChair_01', 'mid_century_lounge_chair',
  'modern_arm_chair_01', 'CoffeeTable_01', 'modern_coffee_table_01', 'side_table_01',
  'bar_chair_round_01', 'Television_01', 'television_02', 'gaming_console', 'CashRegister_01',
  'CoffeeCart_01', 'desk_lamp_arm_01', 'classic_laptop',
  'metal_office_desk', 'modern_ceiling_lamp_01', 'hanging_industrial_lamp', 'boombox', 'cassette_player', 'wall_clock', 'WetFloorSign_01',
  'ceiling_fan', 'outdoor_table_chair_set_01',
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
  const [pm, pf] = await Promise.all([
    game.assets.glb('characters/rb/anims_m.glb').catch(() => undefined),
    game.assets.glb('characters/rb/anims_f.glb').catch(() => undefined),
    game.loadAvatar(outfitById(game.save.settings.outfit).avatar),
    ...[...NPC_AVATARS.m, ...NPC_AVATARS.f].map((id) => game.loadAvatar(id)),
  ]);
  game.people = { m: pm, f: pf };
  game.data = data;
  const tod = (params.get('time') as TimeOfDay | null) ?? game.save.settings.timeOfDay;
  await game.sky.set(tod);

  // ---- levels ----
  const city = buildCity(game);
  game.addLevel(city);
  buildInteriors(game);
  const pets = new Pets(game, city.park);
  game.systems.push(pets);
  game.systems.push(new Life(game));
  const records = new GoldenRecords(game);
  game.systems.push(records);
  const progress = new Progress(game);
  const minimap = new Minimap(game, ui.minimapCanvas);
  game.systems.push({ update: (dt) => minimap.update(dt) });
  const phone = new Phone(game);
  phone.pose = new PhonePose(game);
  game.systems.push({ update: (dt) => phone.pose!.update(dt) });
  phone.progress = progress;
  ui.phone = phone;
  const photo = new PhotoMode(game);
  const audio = new WorldAudio(game);
  game.events.on('sfx', ({ name }) => { if (name === 'settings') audio.applyVolumes(); });
  phone.onCamera = () => photo.start();
  const markers = game as unknown as { petMarkers: () => Array<{ x: number; z: number }>; recordMarkers: () => Array<{ x: number; z: number }> };
  markers.petMarkers = () => pets.list.map((p) => ({ x: p.pos.x, z: p.pos.z }));
  markers.recordMarkers = () => records.remaining();
  // remember where the player was (Continue resumes there)
  let saveT = 0;
  game.systems.push({ update: (dt) => {
    saveT += dt;
    if (saveT < 5 || game.state !== 'playing' || game.activity) return;
    saveT = 0;
    const pp = game.player.position;
    game.save.data.lastPosition = { level: game.level.id, x: pp.x, y: pp.y, z: pp.z, yaw: game.player.facing };
    game.save.write();
  } });
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
    const last = game.save.data.lastPosition;
    if (!fresh && last && game.levels.has(last.level)) {
      void game.goTo(last.level, { position: new THREE.Vector3(last.x, last.y, last.z), facing: last.yaw }, false);
    }
    game.save.data.started = true;
    game.save.write();
    game.cameraOverride = null;
    ui.hideTitle();
    ui.setHudVisible(true);
    ui.setFpsVisible(game.save.settings.showFps);
    game.state = 'playing';
    game.focus.sync();
    void audio.start();
    ui.showBanner(game.level.name, 'atyansh.com');
  };
  ui.onStart = startPlaying;

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
      if (!id) { const r = game.interaction.current; r?.act(); return r?.it.id ?? null; }
      const it = list.find((x) => x.id.startsWith(id));
      it?.onInteract();
      return it?.id ?? null;
    },
    petPose: (id: string, pose: string, x?: number, z?: number, heading = 0) => {
      pets.frozen = true;
      pets.lookOverride = game.renderer.camera.position;
      const p = pets.list.find((q) => q.id === id)!;
      p.rig.setPose(pose as never);
      p.speed = 0;
      if (x !== undefined && z !== undefined) { p.pos.x = x; p.pos.z = z; p.heading = heading; }
    },
    pets: () => pets.list.map((p) => ({ id: p.id, mood: p.mood, pose: p.rig.pose, trust: +p.trust.toFixed(2), pos: p.pos.toArray().map((v) => +v.toFixed(2)) })),
    /** Wireframe every automatic collider (debug) */
    showAuto: () => {
      const mat = new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false });
      const g = new THREE.Group();
      game.physics.world.forEachCollider((c) => {
        if (game.physics.tagOf(c).owner !== 'auto') return;
        const h = (c.shape as unknown as { halfExtents: { x: number; y: number; z: number } }).halfExtents;
        const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2)), mat);
        const t = c.translation(), r = c.rotation();
        box.position.set(t.x, t.y, t.z);
        box.quaternion.set(r.x, r.y, r.z, r.w);
        box.renderOrder = 999;
        g.add(box);
      });
      game.scene.add(g);
      return game.autoStats;
    },
    levelPos: () => ({ level: game.level.id, p: game.player.position.toArray().map((v) => +v.toFixed(2)), state: game.player.state, activity: game.activity?.name ?? null }),
  };
  (window as unknown as { __world: typeof hooks }).__world = hooks;
}
