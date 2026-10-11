// Rapier3D wrapper. One physics world holds every level (interiors live far
// apart in space), so level transitions never rebuild collision. Colliders
// carry a tag for gameplay queries: footstep surface, climbability, and
// whether the camera / character controller should ignore them.

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Surface } from './Events';

export type ColliderKind = 'static' | 'pet' | 'ball' | 'npc' | 'player' | 'prop';

export interface ColliderTag {
  kind: ColliderKind;
  surface?: Surface;
  climbable?: boolean;
  /** Camera boom passes through (foliage, thin props, glass) */
  cameraIgnore?: boolean;
  /** Arbitrary owner object (pet, interactable…) */
  owner?: unknown;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider;
  tag: ColliderTag;
}

const STATIC: ColliderTag = { kind: 'static' };
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export class Physics {
  readonly R = RAPIER;
  world!: RAPIER.World;
  private tags = new Map<number, ColliderTag>();

  static async create(): Promise<Physics> {
    await RAPIER.init();
    const p = new Physics();
    p.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    p.world.timestep = 1 / 60;
    return p;
  }

  tagOf(c: RAPIER.Collider): ColliderTag {
    return this.tags.get(c.handle) ?? STATIC;
  }

  private add(desc: RAPIER.ColliderDesc, tag: ColliderTag = STATIC, body?: RAPIER.RigidBody): RAPIER.Collider {
    const c = this.world.createCollider(desc, body);
    this.tags.set(c.handle, tag);
    return c;
  }

  remove(c: RAPIER.Collider): void {
    this.tags.delete(c.handle);
    this.world.removeCollider(c, false);
  }

  /** Oriented box: world-space center, half extents, optional rotation */
  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, quat?: THREE.Quaternion, tag?: ColliderTag): RAPIER.Collider {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    return this.add(d, tag);
  }

  /** Axis-aligned box from min/max corners */
  aabb(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, tag?: ColliderTag): RAPIER.Collider {
    return this.box((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2,
      (maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2, undefined, tag);
  }

  cylinder(cx: number, cy: number, cz: number, halfHeight: number, radius: number, tag?: ColliderTag): RAPIER.Collider {
    return this.add(RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(cx, cy, cz), tag);
  }

  /** Convex hull of world-space points */
  hull(points: Float32Array, tag?: ColliderTag): RAPIER.Collider | null {
    const d = RAPIER.ColliderDesc.convexHull(points);
    return d ? this.add(d, tag) : null;
  }

  trimesh(vertices: Float32Array, indices: Uint32Array, tag?: ColliderTag): RAPIER.Collider {
    return this.add(RAPIER.ColliderDesc.trimesh(vertices, indices), tag);
  }

  /**
   * Colliders from an Object3D's meshes (world transforms must be current).
   *  - 'box':  one oriented box per mesh from its local bounding box
   *  - 'hull': one convex hull per mesh
   *  - 'trimesh': exact triangles (static scenery only)
   *  - 'bounds': a single axis-aligned box around the whole object
   */
  fromObject(obj: THREE.Object3D, mode: 'box' | 'hull' | 'trimesh' | 'bounds', tag?: ColliderTag): RAPIER.Collider[] {
    obj.updateWorldMatrix(true, true);
    if (mode === 'bounds') {
      const b = new THREE.Box3().setFromObject(obj);
      if (b.isEmpty()) return [];
      return [this.aabb(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, tag)];
    }
    const out: RAPIER.Collider[] = [];
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry;
      if (mode === 'box') {
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox!;
        mesh.matrixWorld.decompose(_v, _q, _s);
        const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        const h = bb.getSize(new THREE.Vector3()).multiply(_s).multiplyScalar(0.5);
        out.push(this.box(c.x, c.y, c.z, Math.max(0.01, Math.abs(h.x)), Math.max(0.01, Math.abs(h.y)), Math.max(0.01, Math.abs(h.z)), _q.clone(), tag));
        return;
      }
      const pos = g.getAttribute('position');
      const verts = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        verts[i * 3] = _v.x; verts[i * 3 + 1] = _v.y; verts[i * 3 + 2] = _v.z;
      }
      if (mode === 'hull') {
        const c = this.hull(verts, tag);
        if (c) out.push(c);
      } else {
        const idx = g.index
          ? new Uint32Array(g.index.array)
          : Uint32Array.from({ length: pos.count }, (_, i) => i);
        out.push(this.trimesh(verts, idx, tag));
      }
    });
    return out;
  }

  /** Dynamic ball (fetch toy) */
  dynamicBall(x: number, y: number, z: number, radius: number, tag: ColliderTag): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.35).setAngularDamping(0.8).setCcdEnabled(true));
    const collider = this.add(
      RAPIER.ColliderDesc.ball(radius).setRestitution(0.62).setFriction(0.7).setDensity(0.6), tag, body);
    return { body, collider };
  }

  /** Kinematic capsule (player / NPCs) */
  kinematicCapsule(x: number, y: number, z: number, halfHeight: number, radius: number, tag: ColliderTag): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const collider = this.add(RAPIER.ColliderDesc.capsule(halfHeight, radius), tag, body);
    return { body, collider };
  }

  private predicate(ignore?: ColliderKind[], extra?: (t: ColliderTag) => boolean) {
    return (c: RAPIER.Collider) => {
      const t = this.tagOf(c);
      if (ignore && ignore.includes(t.kind)) return false;
      return extra ? extra(t) : true;
    };
  }

  raycast(from: THREE.Vector3, dir: THREE.Vector3, max: number, opts: { exclude?: RAPIER.Collider; ignore?: ColliderKind[]; filter?: (t: ColliderTag) => boolean } = {}): RayHit | null {
    const ray = new RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRayAndGetNormal(ray, max, true, undefined, undefined, opts.exclude, undefined,
      this.predicate(opts.ignore, opts.filter));
    if (!hit) return null;
    const d = hit.timeOfImpact;
    return {
      point: from.clone().addScaledVector(dir, d),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: d,
      collider: hit.collider,
      tag: this.tagOf(hit.collider),
    };
  }

  /** Sphere sweep; returns distance to first contact or null */
  sphereCast(from: THREE.Vector3, dir: THREE.Vector3, radius: number, max: number, opts: { exclude?: RAPIER.Collider; ignore?: ColliderKind[]; filter?: (t: ColliderTag) => boolean } = {}): number | null {
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(
      { x: from.x, y: from.y, z: from.z }, { x: 0, y: 0, z: 0, w: 1 }, { x: dir.x, y: dir.y, z: dir.z },
      shape, 0, max, true, undefined, undefined, opts.exclude, undefined, this.predicate(opts.ignore, opts.filter));
    return hit ? hit.time_of_impact : null;
  }

  step(): void {
    this.world.step();
  }
}
