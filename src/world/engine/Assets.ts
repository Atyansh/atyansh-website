// Asset loading + caching. Every runtime asset lives under /world/assets/
// (built by scripts/world-assets/*). Props load once and are cloned per use
// (geometry and materials shared). PBR materials are built from the
// diff/nor/arm WebP sets; procedural geometry carries UVs in metres, so a
// material's `scale` is simply "metres per texture tile".

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const ASSET_BASE = '/world/assets/';

export interface PbrOptions {
  /** metres per texture tile (procedural geometry has metre UVs) */
  scale?: number;
  /** independent X/Y tile sizes */
  scaleX?: number;
  scaleY?: number;
  tint?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  envIntensity?: number;
  side?: THREE.Side;
}

export interface PropOptions {
  /** Pick named sub-nodes of a multi-part set */
  parts?: string[];
  /** Shift so the bounding box is centred on X/Z with its base at y=0 */
  ground?: boolean;
  scale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class Assets {
  readonly manager = new THREE.LoadingManager();
  private gltfLoader: GLTFLoader;
  private texLoader: THREE.TextureLoader;
  private hdrLoader: HDRLoader;
  private glbs = new Map<string, Promise<GLTF>>();
  private ready = new Map<string, GLTF>();
  private textures = new Map<string, THREE.Texture>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  anisotropy = 8;
  onProgress: ((loaded: number, total: number, url: string) => void) | null = null;

  constructor() {
    this.manager.onProgress = (url, loaded, total) => this.onProgress?.(loaded, total, url);
    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    this.texLoader = new THREE.TextureLoader(this.manager);
    this.hdrLoader = new HDRLoader(this.manager);
  }

  glb(path: string): Promise<GLTF> {
    const url = path.startsWith('/') ? path : ASSET_BASE + path;
    let p = this.glbs.get(url);
    if (!p) {
      p = this.gltfLoader.loadAsync(url).then((g) => {
        this.ready.set(url, g);
        return g;
      });
      this.glbs.set(url, p);
    }
    return p;
  }

  /** Preload props so `prop()` can be called synchronously during level build */
  async preloadProps(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.glb(`props/${id}.glb`)));
  }

  /** Synchronous prop clone — the prop must have been preloaded */
  prop(id: string, opts: PropOptions = {}): THREE.Object3D {
    const g = this.ready.get(`${ASSET_BASE}props/${id}.glb`);
    if (!g) throw new Error(`prop ${id} not preloaded`);
    let obj: THREE.Object3D;
    if (opts.parts) {
      obj = new THREE.Group();
      g.scene.updateMatrixWorld(true);
      for (const name of opts.parts) {
        const src = g.scene.getObjectByName(name);
        if (!src) continue;
        const c = src.clone(true);
        src.matrixWorld.decompose(c.position, c.quaternion, c.scale);
        obj.add(c);
      }
    } else {
      obj = g.scene.clone(true);
    }
    if (opts.scale) obj.scale.setScalar(opts.scale);
    if (opts.ground || opts.parts) {
      const wrapper = new THREE.Group();
      wrapper.add(obj);
      const b = new THREE.Box3().setFromObject(obj);
      const c = b.getCenter(new THREE.Vector3());
      obj.position.x -= c.x;
      obj.position.z -= c.z;
      obj.position.y -= b.min.y;
      obj = wrapper;
    }
    const cast = opts.castShadow ?? true;
    const recv = opts.receiveShadow ?? true;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = cast;
        m.receiveShadow = recv;
      }
    });
    return obj;
  }

  /**
   * Many copies of a prop as InstancedMeshes (one draw call per sub-mesh).
   * Returns the group plus the template's local bounds for colliders.
   */
  instanced(id: string, transforms: THREE.Matrix4[], opts: PropOptions = {}): { group: THREE.Group; bounds: THREE.Box3 } {
    const template = this.prop(id, opts);
    template.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(template);
    const group = new THREE.Group();
    if (!transforms.length) return { group, bounds };
    template.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const local = m.matrixWorld.clone();
      const inst = new THREE.InstancedMesh(m.geometry, m.material, transforms.length);
      transforms.forEach((t, i) => inst.setMatrixAt(i, t.clone().multiply(local)));
      inst.castShadow = m.castShadow;
      inst.receiveShadow = m.receiveShadow;
      inst.computeBoundingSphere();
      group.add(inst);
    });
    return { group, bounds };
  }

  texture(path: string, srgb = true, repeatX = 1, repeatY = 1): THREE.Texture {
    const url = path.startsWith('/') || path.startsWith('blob:') ? path : ASSET_BASE + path;
    const key = `${url}|${repeatX}|${repeatY}`;
    let t = this.textures.get(key);
    if (!t) {
      const base = this.textures.get(`${url}|base`) ?? this.texLoader.load(url);
      this.textures.set(`${url}|base`, base);
      t = repeatX === 1 && repeatY === 1 ? base : base.clone();
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = this.anisotropy;
      t.needsUpdate = true;
      this.textures.set(key, t);
    }
    return t;
  }

  /** PBR material from a Poly Haven set (cached per option combination) */
  pbr(id: string, o: PbrOptions = {}): THREE.MeshStandardMaterial {
    const key = `${id}|${JSON.stringify(o)}`;
    let m = this.materials.get(key);
    if (m) return m;
    const sx = 1 / (o.scaleX ?? o.scale ?? 2);
    const sy = 1 / (o.scaleY ?? o.scale ?? 2);
    const arm = this.texture(`tex/${id}_arm.webp`, false, sx, sy);
    m = new THREE.MeshStandardMaterial({
      map: this.texture(`tex/${id}_diff.webp`, true, sx, sy),
      normalMap: this.texture(`tex/${id}_nor.webp`, false, sx, sy),
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      color: o.tint ?? 0xffffff,
      roughness: o.roughness ?? 1,
      metalness: o.metalness ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    m.aoMapIntensity = 0.8;
    m.normalScale.setScalar(o.normalScale ?? 1);
    if (o.envIntensity !== undefined) m.envMapIntensity = o.envIntensity;
    this.materials.set(key, m);
    return m;
  }

  hdr(path: string): Promise<THREE.DataTexture> {
    return this.hdrLoader.loadAsync(ASSET_BASE + path);
  }

  /** Image texture from world-data art (posters/covers), lazily loaded */
  art(url: string): THREE.Texture {
    const key = `art|${url}`;
    let t = this.textures.get(key);
    if (!t) {
      t = new THREE.TextureLoader().load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.textures.set(key, t);
    }
    return t;
  }
}
