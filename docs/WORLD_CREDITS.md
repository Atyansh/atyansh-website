# The Block — Credits

Every third-party asset in `/world` is **CC0 (public domain)**. Attribution is
not required by the licences; it is given here because it is deserved.

| Asset | Source | Licence | Used for |
|---|---|---|---|
| Universal Animation Library (Standard) | [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 1.0 | 21 locomotion/interaction clips, retargeted onto the UAL2 rig |
| Universal Animation Library 2 (Standard) | [Quaternius](https://opengameart.org/content/universal-animation-library-2) | CC0 1.0 | Player + NPC mannequins (male/female), 13 clips |
| 3D models (49 props) | [Poly Haven](https://polyhaven.com/models) | CC0 1.0 | Street lamps, benches, hydrants, bins, cars, barriers, fire escape, furniture, TVs, registers, plants… |
| PBR textures (26 sets) | [Poly Haven](https://polyhaven.com/textures) | CC0 1.0 | Asphalt, paving, brick, plaster, stucco, metal, wood floors, terrazzo, tiles, rubber, plywood, grass, gravel, bark |
| HDRIs (4) | [Poly Haven](https://polyhaven.com/hdris) — Kloofendal 48d Partly Cloudy, Qwantani Sunset, Qwantani Dusk 2, Qwantani Night (pure skies) by Greg Zaal / Jarod Guest | CC0 1.0 | Sky backdrops + image-based lighting for the four times of day |

Libraries: [three.js](https://threejs.org) (MIT), [Rapier](https://rapier.rs)
(Apache-2.0), [glTF-Transform](https://gltf-transform.dev) (MIT, build only),
[meshoptimizer](https://github.com/zeux/meshoptimizer) (MIT).

Everything else — buildings, facades, interior-mapped windows, streets, trees,
grass, the pets (BaoBao, HuHu, Chance), pigeons, signage, BLOCK BREAKER, the
gacha machine, all sound effects and ambience — is procedural, generated in
code at load time. Every poster, cover, album, game, book, show, climbing video
and project in the world is real data from atyansh.com.

## Rebuilding assets

```bash
node scripts/world-assets/build-character.mjs     # needs .cache/world-src/ual{,2} (see script header)
node scripts/world-assets/fetch-polyhaven.mjs     # skies, textures, models → public/world/assets/
node scripts/build-world-data.cjs --dev           # world-data.json + art for `astro dev`
```
