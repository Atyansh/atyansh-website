// The Block — entry point. Boots renderer, world, character, camera, loop.
// Exposes window.__world test hooks used by the Puppeteer harness
// (screenshot bookmarks, teleport, scripted walk, frame stats).

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildBlock } from './graybox';
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
};

export async function boot(container: HTMLElement): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Light distance haze only — bright day, long sightlines
  scene.fog = new THREE.FogExp2(0xc4d7ea, 0.0016);

  // GTA-5-style bright daylight: physical sky + strong warm sun
  const sky = new Sky();
  sky.scale.setScalar(2000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1, THREE.MathUtils.degToRad(44), THREE.MathUtils.degToRad(28),
  );
  const skyU = (sky.material as THREE.ShaderMaterial).uniforms;
  skyU.sunPosition.value.copy(sunDir);
  skyU.turbidity.value = 6;
  skyU.rayleigh.value = 2.2;
  skyU.mieCoefficient.value = 0.004;
  skyU.mieDirectionalG.value = 0.8;
  scene.add(sky);

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
  scene.add(new THREE.HemisphereLight(0x9ec2ee, 0x6b6f66, 1.3));

  const block = buildBlock();
  scene.add(block.group);

  const character = await loadCharacter();
  scene.add(character.root);

  const spawn = new THREE.Vector3(-11, 0, 40); // street in front of the cinema
  const controller = new PlayerController(block.colliders, spawn);
  const followCam = new FollowCamera(
    container.clientWidth / container.clientHeight,
    block.cameraBlockers,
  );
  const input = new Input(renderer.domElement);
  const hud = new Hud(container);

  // ---- Door proximity + enter ----
  let nearDoor: DoorTrigger | null = null;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && nearDoor) {
      window.location.href = nearDoor.route;
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
      controller.position.set(x, 0, z);
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
    playerPos(): [number, number, number] {
      return [controller.position.x, controller.position.y, controller.position.z];
    },
  };
  (window as unknown as { __world: typeof hooks }).__world = hooks;

  // ---- Resize ----
  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    followCam.setAspect(container.clientWidth / container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  // ---- Main loop ----
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
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

    controller.update(dt, move, sprint, followCam.yaw);
    character.update(dt, controller.speed);
    character.root.position.copy(controller.position);
    character.root.rotation.y = controller.heading;

    followCam.update(
      dt, controller.position, controller.heading, controller.speed,
      input.consumeMouse(),
    );

    // Door proximity
    nearDoor = null;
    for (const d of block.doors) {
      const dx = d.x - controller.position.x;
      const dz = d.z - controller.position.z;
      if (dx * dx + dz * dz < d.radius * d.radius) { nearDoor = d; break; }
    }
    hud.showDoorPrompt(nearDoor ? nearDoor.name : null);
    hud.setLocked(input.pointerLocked || camOverride !== null || script !== null);

    let cam = followCam.camera;
    if (camOverride) {
      cam.position.set(...camOverride.pos);
      cam.lookAt(...camOverride.look);
      cam = followCam.camera;
    }
    renderer.render(scene, cam);
  });
}
