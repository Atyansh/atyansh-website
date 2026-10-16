// Interior-mapped window glass.
//
// Each window ray-casts into a virtual room box behind the glass (classic
// "interior mapping"): side walls, floor, ceiling and back wall are shaded
// from a per-window seed — wall paint, floor tone, a ceiling light, blinds,
// a back-wall picture and a silhouette of furniture. The glass blends that
// with a Fresnel reflection of the real sky backdrop. At night a seeded
// subset of rooms switch on (warm/cool) and bloom gently.
//
// Per-window data comes in through the `win` attribute:
//   x,y = window size (m) · z = seed · w = room style (0 home, 1 office, 2 dark)

import * as THREE from 'three';

export const cityUniforms = {
  night: { value: 0 },
  time: { value: 0 },
  tSky: { value: null as THREE.Texture | null },
};

export function createWindowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */ `
      attribute vec4 win;
      varying vec3 vPosW;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying vec4 vWin;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosW = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vUv = uv;
        vWin = win;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float night;
      uniform float time;
      uniform sampler2D tSky;
      varying vec3 vPosW;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying vec4 vWin;
      #include <fog_pars_fragment>

      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      vec3 palette(float s) {
        vec3 a[6];
        a[0] = vec3(0.86, 0.82, 0.74); a[1] = vec3(0.72, 0.78, 0.70); a[2] = vec3(0.70, 0.74, 0.82);
        a[3] = vec3(0.88, 0.76, 0.62); a[4] = vec3(0.80, 0.80, 0.80); a[5] = vec3(0.62, 0.66, 0.60);
        return a[int(floor(s * 5.99))];
      }
      vec3 skyLookup(vec3 d) {
        d.y = max(d.y, 0.02);
        float u = atan(d.z, d.x) * 0.15915494 + 0.5;
        float el = asin(clamp(d.y, -1.0, 1.0)) * 0.63661977;
        return texture2D(tSky, vec2(u, el)).rgb;
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
        vec3 V = normalize(vPosW - cameraPosition);
        float seed = vWin.z;
        float style = vWin.w;
        vec2 size = vWin.xy;
        float depth = 3.2 + h1(seed * 3.1) * 2.5;
        // Room in metres: wider and taller than the window opening (parallax)
        float RW = size.x * 2.0;
        float RH = max(size.y * 1.45, 2.6);
        vec3 rd = vec3(dot(V, T) / RW, V.y / RH, dot(V, -N) / depth);
        vec3 ro = vec3(((vUv.x - 0.5) * size.x + RW * 0.5) / RW, (vUv.y * size.y + (RH - size.y) * 0.45) / RH, 0.0);
        vec3 tPlane = vec3(
          (rd.x > 0.0 ? 1.0 - ro.x : -ro.x) / (abs(rd.x) < 1e-4 ? 1e-4 : rd.x),
          (rd.y > 0.0 ? 1.0 - ro.y : -ro.y) / (abs(rd.y) < 1e-4 ? 1e-4 : rd.y),
          (1.0 - ro.z) / max(rd.z, 1e-4)
        );
        float t = min(min(tPlane.x, tPlane.y), tPlane.z);
        vec3 hit = ro + rd * t;

        vec3 wall = palette(h1(seed * 7.7));
        vec3 col;
        float lightOn = step(0.42, h1(seed * 13.3)) * night;
        if (tPlane.y <= t + 1e-4) {
          if (rd.y < 0.0) {
            // floor: wood/carpet with a rug
            col = mix(vec3(0.36, 0.26, 0.18), vec3(0.42, 0.40, 0.38), step(0.5, h1(seed * 2.3)));
            vec2 rug = abs(vec2(hit.x - 0.5, hit.z - 0.55));
            if (rug.x < 0.28 && rug.y < 0.25) col = mix(col, vec3(0.55, 0.25, 0.2), 0.6);
          } else {
            // ceiling with a light fixture
            col = vec3(0.86);
            float d = length(vec2(hit.x - 0.5, hit.z - 0.5));
            col += smoothstep(0.12, 0.0, d) * (0.4 + lightOn * 3.0);
          }
        } else if (tPlane.x <= t + 1e-4) {
          col = wall * 0.85;
          // furniture silhouette: a cabinet / shelf low on one side wall
          if (hit.y < 0.38 && hit.z > 0.3 && hit.z < 0.8 && h1(seed * 5.1) > 0.4) col *= 0.45;
        } else {
          col = wall;
          // back-wall picture frame
          vec2 pic = abs(vec2(hit.x - (0.3 + h1(seed) * 0.4), hit.y - 0.6));
          if (pic.x < 0.12 && pic.y < 0.09) col = mix(vec3(0.2, 0.25, 0.35), vec3(0.8, 0.5, 0.3), h1(seed * 9.0));
          // sofa / desk silhouette
          if (hit.y < 0.3 && abs(hit.x - 0.5) < 0.3) col *= style > 0.5 ? 0.6 : 0.5;
        }
        // depth falloff + interior light level
        float lit = mix(0.22, 0.32, style > 0.5 ? 1.0 : 0.0);
        if (style > 1.5) lit = 0.06;
        vec3 lightCol = mix(vec3(1.0, 0.82, 0.58), vec3(0.85, 0.92, 1.0), step(0.75, h1(seed * 4.4)));
        col *= mix(lit, 1.6, lightOn) * mix(vec3(1.0), lightCol, lightOn);
        col *= mix(1.0, 0.55, smoothstep(0.0, 1.0, hit.z));

        // blinds from the top
        float blind = h1(seed * 17.0) * 0.6;
        if (vUv.y > 1.0 - blind) {
          vec3 b = mix(vec3(0.9, 0.88, 0.82), vec3(0.55, 0.6, 0.65), step(0.6, h1(seed * 21.0)));
          float slat = 0.85 + 0.15 * step(0.5, fract(vUv.y * size.y * 12.0));
          col = b * slat * mix(0.35, 1.2, lightOn);
        }

        // glass reflection
        float cosT = clamp(dot(-V, N), 0.0, 1.0);
        float fres = 0.06 + 0.94 * pow(1.0 - cosT, 5.0);
        vec3 refl = skyLookup(reflect(V, N)) * 1.25;
        float reflAmt = mix(0.55, 0.85, fres) * (1.0 - lightOn * 0.6);
        vec3 outCol = mix(col, refl, reflAmt * 0.8);
        gl_FragColor = vec4(outCol, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

/** Bind shared uniforms (night, time, sky) to a window material */
export function bindCityUniforms(m: THREE.ShaderMaterial): void {
  m.uniforms.night = cityUniforms.night;
  m.uniforms.time = cityUniforms.time;
  m.uniforms.tSky = cityUniforms.tSky;
}
