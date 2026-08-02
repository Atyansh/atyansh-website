// The Block — entry point. Boots renderer, world, character, camera, loop.
// Exposes window.__world test hooks used by the Puppeteer harness
// (screenshot bookmarks, teleport, scripted walk, frame stats).

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildBlock, sampleGroundY } from './graybox';
import { buildInteriorLevels, type InteriorLevel } from './environments';
import { loadCharacter } from './character';
import { PlayerController } from './controller';
import { FollowCamera } from './camera';
import { Input } from './input';
import { Hud } from './hud';
import type { DoorTrigger } from './types';

interface CamBookmark {
  pos: [number, number, number];
  look: [number, number, number];
}

// Fixed review shots for the screenshot harness (world coordinates)
const BOOKMARKS: Record<string, CamBookmark> = {
  corner: { pos: [-38, 3.2, 52], look: [-5, 5, 25] },
  marquee: { pos: [-11, 2.4, 44], look: [-11, 6, 30] },
  north: { pos: [10, 3.0, -50], look: [-15, 6, -25] },
  park: { pos: [50, 2.6, -2], look: [32, 2, -16] },
  alley: { pos: [2, 2.2, 44], look: [2, 3, -30] },
  overview: { pos: [-70, 55, 80], look: [0, 0, 0] },
  cinemaIn: { pos: [2000, 3.0, 22], look: [2000, 2.2, -24] },
  recordsIn: { pos: [2500, 2.6, 13], look: [2500, 1.6, -14] },
  arcadeIn: { pos: [3000, 2.6, 15], look: [3000, 1.6, -16] },
  climbIn: { pos: [5000, 5.0, 25], look: [5000, 4.5, -26] },
  climbBeta: { pos: [5000, 3.2, -16], look: [5000, 3.6, 28] },
  studioIn: { pos: [5500, 2.4, 10], look: [5500, 1.8, -13] },
  cinemaDoor: { pos: [2000, 1.8, 18], look: [2000, 1.9, 26] },
};

export async function boot(container: HTMLElement): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  // 1.5 instead of full retina 2: the post stack (GTAO especially) runs at
  // canvas resolution, and 1.5² is ~44% fewer pixels for a difference that
  // is nearly invisible on a high-DPI panel.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.appendChild(renderer.domElement);

  // Post stack (brief §7): GTAO grounding, gentle bloom, vignette + grain
  const composer = new EffectComposer(renderer);
  let composerCam: THREE.PerspectiveCamera | null = null;
  const vignetteGrain = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float d = distance(vUv, vec2(0.5));
        c.rgb *= smoothstep(0.95, 0.42, d) * 0.18 + 0.86;      // vignette
        c.rgb += (hash(vUv * 971.0 + time) - 0.5) * 0.012;      // grain
        gl_FragColor = c;
      }`,
  }), 'tDiffuse');

  const scene = new THREE.Scene();
  // Light distance haze only — bright day, long sightlines
  scene.fog = new THREE.FogExp2(0xaec8e8, 0.0012);

  // GTA-5-style bright daylight: physical sky + strong warm sun
  const sky = new Sky();
  sky.scale.setScalar(2000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1, THREE.MathUtils.degToRad(44), THREE.MathUtils.degToRad(28),
  );
  const skyU = (sky.material as THREE.ShaderMaterial).uniforms;
  skyU.sunPosition.value.copy(sunDir);
  skyU.turbidity.value = 2.5;
  skyU.rayleigh.value = 1.6;
  skyU.mieCoefficient.value = 0.004;
  skyU.mieDirectionalG.value = 0.8;
  scene.add(sky);

  // Image-based lighting from the sky itself: sun-tinted ambient with real
  // directionality, and something for glass/metal to reflect.
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(2000);
    const u = (envSky.material as THREE.ShaderMaterial).uniforms;
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = 2.5;
    u.rayleigh.value = 1.6;
    // No mie scattering in the env sky: kills the sun DISK so the IBL is the
    // blue dome only — direct sun stays the DirectionalLight's job.
    u.mieCoefficient.value = 0.00001;
    envScene.add(envSky);
    // Not used for scene-wide lighting (it washed out the frame — the sky
    // dome integrates to a huge diffuse term). Stashed for selective use as
    // envMap on glass/metal materials in the facade pass.
    scene.userData.skyEnv = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
  }

  const sun = new THREE.DirectionalLight(0xfff2dd, 3.2);
  sun.position.copy(sunDir).multiplyScalar(160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9ec2ee, 0x6b6f66, 1.3);
  scene.add(hemi);

  const worldData = await fetch('/world/world-data.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const block = buildBlock(scene.userData.skyEnv as THREE.Texture, worldData ?? undefined);
  scene.add(block.group);

  const levels = buildInteriorLevels(worldData ?? undefined);
  for (const lvl of levels.values()) scene.add(lvl.group);

  const character = await loadCharacter();
  scene.add(character.root);

  const spawn = new THREE.Vector3(-11, 0, 40); // street in front of the cinema
  const controller = new PlayerController(block.colliders, spawn, sampleGroundY);
  const followCam = new FollowCamera(
    container.clientWidth / container.clientHeight,
    block.cameraBlockers,
  );
  const input = new Input(renderer.domElement);
  const hud = new Hud(container);

  // ---- Levels: Enter at a door goes inside; Enter at the exit returns ----
  let nearDoor: DoorTrigger | null = null;
  let activeLevel: InteriorLevel | null = null;
  let returnPoint: { x: number; z: number; heading: number } | null = null;
  const outdoorLight = { sun: sun.intensity, hemi: hemi.intensity };

  const enterLevel = (lvl: InteriorLevel): void => {
    returnPoint = {
      x: controller.position.x, z: controller.position.z,
      heading: controller.heading,
    };
    hud.fade(() => {
      activeLevel = lvl;
      controller.setLevel(lvl.colliders, lvl.groundFn, lvl.spawn.x, lvl.spawn.z, lvl.spawn.heading);
      followCam.blockers = lvl.blockers;
      followCam.yaw = lvl.spawn.heading + Math.PI;
      sun.intensity = 0.05;
      hemi.intensity = 0.5;
      lvl.onEnter?.();
    });
  };
  const exitLevel = (): void => {
    const rp = returnPoint;
    hud.fade(() => {
      activeLevel?.onExit?.();
      activeLevel = null;
      controller.setLevel(
        block.colliders, sampleGroundY,
        rp?.x ?? -11, rp?.z ?? 40, rp?.heading ?? 0,
      );
      followCam.blockers = block.cameraBlockers;
      followCam.yaw = (rp?.heading ?? 0) + Math.PI;
      sun.intensity = outdoorLight.sun;
      hemi.intensity = outdoorLight.hemi;
    });
  };

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter') return;
    if (activeLevel) {
      const dx = activeLevel.exit.x - controller.position.x;
      const dz = activeLevel.exit.z - controller.position.z;
      if (dx * dx + dz * dz < activeLevel.exit.radius ** 2) {
        exitLevel();
        return;
      }
      const it = activeLevel.interact?.find((i) =>
        (i.x - controller.position.x) ** 2 + (i.z - controller.position.z) ** 2 < i.radius ** 2);
      it?.action();
    } else if (nearDoor && levels.has(nearDoor.buildingId)) {
      enterLevel(levels.get(nearDoor.buildingId)!);
    }
  });

  // ---- Test hooks ----
  const frameTimes: number[] = [];
  let camOverride: CamBookmark | null = null;
  let script: { targets: Array<[number, number]>; i: number; sprint: boolean } | null = null;

  const hooks = {
    ready: true,
    snap(name: keyof typeof BOOKMARKS | 'player'): void {
      camOverride = name === 'player' ? null : BOOKMARKS[name] ?? null;
    },
    bookmarks: Object.keys(BOOKMARKS),
    teleport(x: number, z: number): void {
      controller.position.set(x, controller.groundFn(x, z), z);
    },
    enter(id: string): void {
      const lvl = levels.get(id);
      if (lvl) enterLevel(lvl);
    },
    exit(): void {
      if (activeLevel) exitLevel();
    },
    /** Scripted walk through waypoints (used by the FPS probe) */
    autowalk(sprint = false): void {
      script = {
        targets: [
          [-40, 40], [-52, 20], [-52, -20], [-30, -40], [20, -40],
          [52, -20], [52, 20], [20, 40], [-11, 40],
        ],
        i: 0,
        sprint,
      };
    },
    stopwalk(): void { script = null; },
    stats(): { median: number; p99: number; frames: number } {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const q = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0;
      return { median: q(0.5), p99: q(0.99), frames: sorted.length };
    },
    resetStats(): void { frameTimes.length = 0; },
    hideHud(): void { hud.hide(); },
    playerY(): number { return controller.position.y; },
    playerPos(): [number, number, number] {
      return [controller.position.x, controller.position.y, controller.position.z];
    },
  };
  (window as unknown as { __world: typeof hooks }).__world = hooks;

  // ---- Resize ----
  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);
    followCam.setAspect(container.clientWidth / container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  // ---- Main loop ----
  // Frame pacing: cap at 60fps (a ProMotion display would otherwise run this
  // at 120), and drop to 30fps once the player has been idle for 2s — any
  // input snaps back instantly. Simulation uses real clock dt, so pacing
  // never changes game speed. The gym is exempt from the idle drop so the
  // beta-wall videos stay smooth.
  const clock = new THREE.Clock();
  let lastRender = -Infinity;
  let lastActive = 0;
  renderer.setAnimationLoop((now: number) => {
    const active = input.hasActivity() || script !== null
      || controller.speed > 0.01 || !controller.grounded;
    if (active) lastActive = now;
    const idle = now - lastActive > 2000 && activeLevel?.id !== 'climb';
    const interval = idle ? 1000 / 30 : 1000 / 60;
    if (now - lastRender < interval - 0.5) return;
    lastRender = now;

    const dt = Math.min(clock.getDelta(), 0.05);
    frameTimes.push(dt * 1000);
    if (frameTimes.length > 4000) frameTimes.shift();

    // Scripted walk (harness) overrides user input
    let move = input.moveVector();
    let sprint = input.sprinting;
    if (script) {
      const [tx, tz] = script.targets[script.i];
      const dx = tx - controller.position.x;
      const dz = tz - controller.position.z;
      if (Math.hypot(dx, dz) < 1.5) {
        script.i = (script.i + 1) % script.targets.length;
      }
      // Steer in camera-relative input space (inverse of the controller's
      // heading formula: desired = yaw + PI - atan2(mx, my))
      const desired = Math.atan2(dx, dz);
      const a = followCam.yaw + Math.PI - desired;
      move = { x: Math.sin(a), y: Math.cos(a) };
      sprint = script.sprint;
    }

    controller.update(dt, move, sprint, followCam.yaw, script ? false : input.consumeJump());
    character.update(dt, controller.speed, controller.grounded);
    character.root.position.copy(controller.position);
    character.root.rotation.y = controller.heading;

    followCam.update(
      dt, controller.position, controller.heading, controller.speed,
      input.consumeMouse(),
    );

    // Door / exit proximity prompts
    nearDoor = null;
    if (activeLevel) {
      const dx = activeLevel.exit.x - controller.position.x;
      const dz = activeLevel.exit.z - controller.position.z;
      if (dx * dx + dz * dz < activeLevel.exit.radius ** 2) {
        hud.showDoorPrompt('exit to street');
      } else {
        const it = activeLevel.interact?.find((i) =>
          (i.x - controller.position.x) ** 2 + (i.z - controller.position.z) ** 2 < i.radius ** 2);
        hud.showDoorPrompt(it ? it.label : null);
      }
    } else {
      for (const d of block.doors) {
        const dx = d.x - controller.position.x;
        const dz = d.z - controller.position.z;
        if (dx * dx + dz * dz < d.radius * d.radius) { nearDoor = d; break; }
      }
      hud.showDoorPrompt(nearDoor && levels.has(nearDoor.buildingId) ? nearDoor.name : null);
    }
    hud.setLocked(input.pointerLocked || camOverride !== null || script !== null);

    const cam = followCam.camera;
    if (camOverride) {
      cam.position.set(...camOverride.pos);
      cam.lookAt(...camOverride.look);
    }

    // Only the cell the camera is in gets rendered (and lit): every visible
    // light in the scene is compiled into every material's shader, so leaving
    // all eight interiors on would make the street pay for ~40 unseen lights.
    const camX = camOverride ? camOverride.pos[0] : controller.position.x;
    for (const lvl of levels.values()) {
      lvl.group.visible = lvl === activeLevel || Math.abs(camX - lvl.spawn.x) < 250;
    }
    if (composerCam !== cam) {
      composerCam = cam;
      composer.passes.length = 0;
      composer.addPass(new RenderPass(scene, cam));
      const gtao = new GTAOPass(scene, cam, container.clientWidth, container.clientHeight);
      gtao.output = GTAOPass.OUTPUT.Default;
      composer.addPass(gtao);
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.08, 0.5, 1.0,
      ));
      composer.addPass(vignetteGrain);
      composer.addPass(new OutputPass());
    }
    (vignetteGrain.material as THREE.ShaderMaterial).uniforms.time.value = clock.elapsedTime % 10;
    composer.render();
  });
}
