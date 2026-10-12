// Procedural weathering for architecture (applied via onBeforeCompile).
//
// World-space, so every building gets unique wear without new textures:
//  - rising damp + street grime band at the base (dark, desaturated)
//  - vertical rain streaks running down from ledges (noise stretched in y)
//  - large blotchy tonal variation (sun-bleaching / repaints)
//  - roughness follows the grime (dirt is matte)
// `strength` scales everything (0 = pristine).

import * as THREE from 'three';

const NOISE = /* glsl */ `
  float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float wNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float wFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * wNoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function weather<T extends THREE.MeshStandardMaterial>(m: T, strength = 1, key = 'w'): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uWeather = { value: strength };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNor = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWeather;\nvarying vec3 vWPos;\nvarying vec3 vWNor;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 wp = vWPos;
          float vertical = 1.0 - abs(vWNor.y);
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // large-scale tonal blotches
          float blot = wFbm(wp * 0.18);
          diffuseColor.rgb *= mix(0.72, 1.14, smoothstep(0.25, 0.75, blot));
          // grime band at the base (~1.4m), ragged edge
          float edge = 0.9 + wFbm(wp * 1.3) * 1.4;
          float base = (1.0 - smoothstep(0.0, edge, wp.y)) * vertical;
          // rain streaks: noise stretched vertically, stronger lower down each storey
          float streak = wNoise(vec3((wp.x + wp.z) * 3.2, wp.y * 0.22, 0.0));
          streak = smoothstep(0.45, 0.9, streak) * (0.5 + 0.5 * (1.0 - fract(wp.y / 3.3))) * vertical;
          float dirt = clamp(base * 0.9 + streak * 0.55, 0.0, 1.0) * uWeather;
          vec3 grime = mix(vec3(lum), diffuseColor.rgb, 0.45) * vec3(0.42, 0.4, 0.37);
          diffuseColor.rgb = mix(diffuseColor.rgb, grime, dirt);
          vWeatherDirt = dirt;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 1.0, vWeatherDirt * 0.6);`)
      .replace('uniform float uWeather;', 'uniform float uWeather;\nfloat vWeatherDirt = 0.0;');
  };
  m.customProgramCacheKey = () => `weather-${key}`;
  return m;
}

/**
 * Street surface wear: oil drips and tyre-darkened lanes, patched repairs,
 * and shallow puddles (glossy, darker, reflecting the sky) in dips.
 */
export function streetWear<T extends THREE.MeshStandardMaterial>(m: T): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nfloat sPuddle = 0.0;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 p = vWPos.xz;
          // patches of newer, darker asphalt
          float patchN = wNoise(vec3(p * 0.06, 3.0));
          diffuseColor.rgb *= mix(1.0, 0.68, smoothstep(0.55, 0.58, patchN));
          // oil / tyre grime blotches
          float oil = wFbm(vec3(p * 0.45, 7.0));
          diffuseColor.rgb *= mix(1.0, 0.62, smoothstep(0.5, 0.75, oil));
          // puddles
          float pn = wFbm(vec3(p * 0.11, 11.0));
          sPuddle = smoothstep(0.6, 0.63, pn);
          diffuseColor.rgb *= mix(1.0, 0.45, sPuddle);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.04, sPuddle);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal), sPuddle));`);
  };
  m.customProgramCacheKey = () => 'street-wear';
  return m;
}
