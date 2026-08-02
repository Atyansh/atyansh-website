// GTA-style third-person follow camera: mouse orbit, shoulder offset,
// wall-aware boom (raycast shortening), gentle auto-recenter while moving.

import * as THREE from 'three';

const BOOM_LENGTH = 5.2;
const MIN_BOOM = 1.2;
const PIVOT_HEIGHT = 1.55;      // over player origin (about the head)
const SHOULDER = 0.55;          // lateral offset, right shoulder
const MOUSE_SENS = 0.0023;
const PITCH_MIN = -0.9;
const PITCH_MAX = 0.55;
const RECENTER_RATE = 0.9;      // yaw pull toward heading while moving fast
const COLLISION_MARGIN = 0.25;

export class FollowCamera {
  camera: THREE.PerspectiveCamera;
  yaw = Math.PI;                // start behind the player facing -Z->+Z scene
  pitch = 0.12;
  /** Ground height sampler — keeps the boom from dipping below the floor.
      Swapped on level transitions along with the blockers. */
  groundFn: ((x: number, z: number) => number) | null = null;
  private ray = new THREE.Raycaster();
  private currentBoom = BOOM_LENGTH;

  constructor(aspect: number, public blockers: THREE.Object3D[]) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 400);
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerHeading: number,
    playerSpeed: number,
    mouse: { dx: number; dy: number },
  ): void {
    this.yaw -= mouse.dx * MOUSE_SENS;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + mouse.dy * MOUSE_SENS, PITCH_MIN, PITCH_MAX,
    );

    // Auto-recenter behind the player while moving (GTA-style), but only when
    // the user isn't actively looking around this frame.
    if (playerSpeed > 1.0 && Math.abs(mouse.dx) < 1) {
      const behind = playerHeading + Math.PI;
      let diff = behind - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const pull = RECENTER_RATE * Math.min(1, (playerSpeed - 1.0) / 3);
      this.yaw += diff * (1 - Math.exp(-pull * dt));
    }

    const pivot = new THREE.Vector3(
      playerPos.x, playerPos.y + PIVOT_HEIGHT, playerPos.z,
    );
    // Shoulder offset in camera space
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    pivot.addScaledVector(right, SHOULDER);

    // Desired camera position on the orbit sphere
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const desired = pivot.clone().addScaledVector(dir, BOOM_LENGTH);

    // Boom collision: shorten if a blocker sits between pivot and camera
    let boom = BOOM_LENGTH;
    this.ray.set(pivot, dir);
    this.ray.far = BOOM_LENGTH + COLLISION_MARGIN;
    const hits = this.ray.intersectObjects(this.blockers, false);
    if (hits.length > 0) {
      boom = Math.max(MIN_BOOM, hits[0].distance - COLLISION_MARGIN);
    }
    // Snap in fast, ease out slow — hiding inside walls is worse than a jump cut
    if (boom < this.currentBoom) this.currentBoom = boom;
    else this.currentBoom += (boom - this.currentBoom) * Math.min(1, dt * 4);

    this.camera.position.copy(pivot).addScaledVector(dir, this.currentBoom);

    // Floor ride: never let the camera sink below the ground it's over.
    // Aim along the orbit sight line rather than hard at the pivot, so once
    // the camera is riding the floor further pitch still tilts the view up
    // past the character (how third-person cameras handle looking skyward).
    if (this.groundFn) {
      const gy = this.groundFn(this.camera.position.x, this.camera.position.z);
      this.camera.position.y = Math.max(this.camera.position.y, gy + 0.35);
    }
    const aim = this.camera.position.clone().addScaledVector(dir, -10);
    this.camera.lookAt(aim);
    void desired;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
