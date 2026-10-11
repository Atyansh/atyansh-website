# THE BLOCK — Design Brief v2

An explorable third-person city block that is an alternate, playable front-end
to atyansh.com, served unlisted at `/world`. v2 replaces the v1 gray-box
prototype wholesale: new engine, real physics, real assets, real game loop.

## 1. Why v2 (re-evaluation of v1)

v1 proved the concept and taught the requirements, but hit a ceiling:

| v1 problem | Root cause | v2 answer |
|---|---|---|
| Hitboxes wrong everywhere (slanted walls, boulders, furniture) | Hand-rolled 2D circle-vs-rectangle collision | Rapier3D physics: exact colliders (rotated cuboids, convex hulls, trimeshes) + kinematic character controller with autostep, slopes, ground snap |
| Looks like boxes | Canvas-texture boxes, no props, no materials | PBR material library + CC0 props (Poly Haven), procedural facades with depth and interior-mapped windows, HDRI image-based lighting |
| Nothing to do | Walk / jump / enter only | Defined game loop: goals, collectibles, activities per building, pets with personalities, save system |
| Hard to extend | Monolithic files, everything in `boot()` | Engine / game / world / UI layers, one module per system |

Kept from v1: the data export pipeline (`scripts/build-world-data.cjs`), the
building lineup, fixed-quality policy, frame pacing caps, the self-testing
harness approach, and everything the playtests taught (camera floor clamp,
real-scale boulders, closed exit doors, one video decoder at a time).

## 2. The game

**Fantasy**: stepping into the website — a sunny GTA-style city block where
every building is a section of the site, furnished with the real data, and
the owner's actual pets live in the park.

**Core loop**: explore → discover → interact → collect. Every building has a
signature *activity*, the park has the pets, and hidden collectibles reward
exploring every corner, including rooftops.

**Progression** (tracked on the in-game phone, saved to localStorage):

1. *Grand Tour* — step inside all eight buildings (passport stamps).
2. *Friends of the Park* — earn BaoBao's trust, wake and pet HuHu, play
   fetch with Chance.
3. *Send It* — top out all three boulders in the climbing gym.
4. *High Score* — beat the arcade cabinet's target score.
5. *Gotta Watch 'Em All* — pull anime cards from the café's gacha machine.
6. *Golden Records* — find the hidden golden records across the block.
7. Completing goals unlocks cosmetic rewards (outfit colours, photo filters).

**Activities**

| Building | Data | Activity |
|---|---|---|
| Cinema | 309 Letterboxd films | Poster gallery lobby; screening room — sit and watch the "now showing" reel |
| Records | Spotify albums, top tracks | Flip through crates (inspect browser); listening booth plays the music theme |
| Arcade | Steam games + playtime | Playable cabinet game with saved high score; playtime leaderboard |
| Library | Goodreads books | Browse shelves (inspect browser with author, date, blurb); currently-reading display |
| Anime café | MAL anime | Gacha capsule machine: pull and collect cards from the real list |
| TV lounge | TMDB shows | Sit on the couch, channel-surf the show reel |
| Climbing gym | Kaya stats, pyramid, send videos | Free climbing on walls/boulders with IK limbs, top-out mantles; beta theater |
| Studio | Projects, blog | Project displays; newsstand kiosk with the blog |
| Park | Pets | BaoBao (shy — approach slowly), HuHu (naps in the sun), Chance (fetch, belly rubs) |

**Non-goals**: combat, vehicles to drive, multiplayer, links out to the 2D
site (the world is self-contained), photorealism claims.

## 3. Player

- Quaternius Universal Animation Library 1+2 (CC0) mannequin rig; UAL1 clips
  retargeted offline onto the UAL2 skeleton (shared `A_TPose` reference) so
  one skeleton carries ~85 clips.
- States: idle / walk / jog / sprint (speed-blended), jump start-loop-land,
  crouch, sit, kneel-to-pet, interact, throw, climb (procedural, IK hands and
  feet on holds), ledge mantle (`ClimbUp_1m`).
- Rapier kinematic character controller (capsule, autostep 0.35m, max slope
  45°, snap-to-ground).
- Camera: spring arm with sphere-cast collision, floor ride, shoulder offset,
  sprint FOV kick, cinematic framing for seated/inspect states.

## 4. World

- One city block, perimeter street, alley, pocket park, all sized to scale.
- Procedural facades: PBR walls (brick/plaster/concrete), recessed windows
  with frames and sills, cornices, belt courses, storefront glazing;
  upper windows use an interior-mapping shader (fake rooms with depth).
- Streets: PBR asphalt, painted markings, crosswalks, curbs, manholes;
  sidewalks with paving; street lamps, benches, hydrants, bins, utility
  boxes, AC units, fire escapes, rooftop water towers.
- Surrounding city: instanced low-detail blocks so no sightline ends in void;
  the playable area is bounded by road-closure barriers.
- Park: instanced wind-animated grass, procedural trees with wind, shrubs,
  flowers, paths, fountain, benches.
- Life: pets, a handful of NPCs (benches, phone calls, staff in interiors,
  sidewalk walkers), pigeons that scatter when you run at them.
- Time of day: matched HDRI set (Qwantani morning → night); sun direction
  derived from each HDRI; night switches on street lights, windows and signs.

## 5. Interiors

Separate levels (Enter at a door → fade → level), each a distinct designed
space with real furniture props, PBR surfaces, its own lighting scheme and
exact physics colliders. All share one physics world (levels sit far apart),
only the active one renders.

## 6. UI

DOM overlay, styled as one system: title screen with flyover, loading
progress, HUD (minimap, interaction prompt with key glyphs, goal tracker,
toasts), phone (Map + fast travel, Goals, Collection, Camera/photo mode,
Wardrobe, Settings), pause menu, inspect browser for content items.

## 7. Audio

Music: the site's own per-page songs via `src/audio/AudioEngine` (each
building plays its section's theme). Synthesized SFX and ambience (no audio
files): surface-aware footsteps, jump/land, UI, collectibles, pet sounds,
arcade, gacha, city/park/interior beds. Audio starts on the title-screen
click; M mutes; volumes in settings.

## 8. Tech

- three.js r185 WebGLRenderer, TypeScript strict, Vite via Astro, code-split
  to `/world` only.
- Rapier3D (compat build, WASM inlined) for physics.
- Asset pipeline (`scripts/world-assets/`): fetch CC0 sources, retarget
  animations, optimize with glTF-Transform (meshopt geometry, WebP
  textures) → `public/world/assets/`.
- Post: GTAO, bloom, ACES tonemap, colour grade, vignette, grain, SMAA.
- Directional sun shadow map following the player, texel-snapped.
- Frame pacing: 60 fps cap, 30 fps idle throttle, pixel ratio ≤ 1.5.

## 9. Testing

Puppeteer harness (`scripts/world-shots.cjs`): camera-bookmark screenshots,
scripted interactions via `window.__world` hooks, console-error capture, and
a 30 s walk FPS probe. Every milestone is screenshot-reviewed.

## 10. Milestones

1. Asset pipeline + engine core (renderer, loop, input, physics, assets, UI shell)
2. Player + camera on a test pad
3. Exterior city + park + sky/time of day
4. Interiors + activities
5. Pets, NPCs, birds
6. Game systems: goals, collectibles, phone, save, photo mode
7. Audio
8. Polish, performance, docs

## 11. Credits

All third-party assets are CC0; see `docs/WORLD_CREDITS.md`.
