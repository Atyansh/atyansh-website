# The Block — Credits

Every third-party asset in `/world` is **CC0 (public domain)** except the
Rocketbox avatars, which are **MIT** (notice below). Attribution for the CC0
assets is not required; it is given here because it is deserved.

| Asset | Source | Licence | Used for |
|---|---|---|---|
| Universal Animation Library (Standard) | [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 1.0 | 21 locomotion/interaction clips, retargeted onto the UAL2 rig |
| Universal Animation Library 2 (Standard) | [Quaternius](https://opengameart.org/content/universal-animation-library-2) | CC0 1.0 | 13 clips; fallback mannequin |
| Microsoft Rocketbox Avatar Library (32 adults) | [Microsoft](https://github.com/microsoft/Microsoft-Rocketbox) | MIT | The player's looks and every townsperson; the animation set is retargeted onto their Biped skeletons |
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

### Microsoft Rocketbox licence

> MIT License — Copyright (c) Microsoft Corporation.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Rebuilding assets

```bash
node scripts/world-assets/build-character.mjs     # needs .cache/world-src/ual{,2} (see script header)
node scripts/world-assets/fetch-polyhaven.mjs     # skies, textures, models → public/world/assets/
node scripts/world-assets/build-rocketbox.mjs     # avatars → public/world/assets/characters/rb/ (downloads ~2 GB of sources)
node scripts/world-assets/retarget-rocketbox.mjs public/world/assets/characters/rb/p_hoodie.glb public/world/assets/characters/rb/anims_m.glb
node scripts/world-assets/retarget-rocketbox.mjs public/world/assets/characters/rb/f01.glb public/world/assets/characters/rb/anims_f.glb
node scripts/build-world-data.cjs --dev           # world-data.json + art for `astro dev`
```
