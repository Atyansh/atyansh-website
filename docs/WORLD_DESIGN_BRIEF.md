# PROJECT: THE BLOCK — Design Brief v1

An explorable 3D city block that is an alternate front-end to atyansh.com. A
visitor walks a neon-lit night street as a third-person character; every
building is one of the site's content sections, its interior furnished with
the visitor-facing data the site already fetches daily. This document sets
targets and constraints, not implementation. The builder owns architecture,
tooling, and iteration, and is expected to self-test visually.

## 1. Vision

- **Fantasy**: stepping into the website. GTA-style third-person navigation of
  one dense, rain-slicked, neon-soaked city block at night. Buildings are
  legible from the street — the cinema announces itself with a lit marquee
  showing real movie posters; the arcade spills glowing cabinet light onto the
  sidewalk; the climbing gym has a floodlit wall visible through glass.
- **Tone**: stylized-realistic urban night. Not photoreal, not cartoon
  low-poly. References: GTA's environmental mood, Sifu's stylized materials,
  neon-noir demo scenes. Confident lighting is the art style: emissive
  signage, wet-street reflections, volumetric glow, warm interiors against
  cool night.
- **It is a place, not a menu**: content surfaces diegetically (posters on
  walls, records in bins, covers on cabinets). Deep links to the regular site
  pages appear as in-world interactions, never as floating UI chrome.

## 2. Non-goals (v1)

- No vehicles, no combat, no missions, no NPC dialogue.
- No ambient life in v1 — no pedestrians or background creatures. The block is
  a quiet night; the only living things are the pets in the park.
- No multiplayer. No persistence beyond localStorage (settings, last position).
- No replacement of the regular site: `/world` is an optional, unlisted
  layer; the 2D site remains canonical.
- No photorealism claims: quality bar is "cohesive and intentional," judged by
  screenshots, not by proximity to AAA.

## 3. The Block

One rectangular city block, walkable perimeter street plus one cut-through
alley. Fixed nighttime. Light rain state permitted if it serves the look
(wet ground is required regardless). Building lineup, each with a street-legible
exterior and an enterable interior furnished from build data:

| Building | Site section | Exterior identity | Interior data furnishing |
|---|---|---|---|
| **Cinema** | /movies | Lit marquee + poster cases | Lobby: real Letterboxd posters as one-sheets; ratings as star plaques |
| **TV lounge** | /tv | Storefront wall of glowing CRTs | Couch den; TMDB posters as screens; currently-watched glow |
| **Record shop** | /music | Neon record sign, listening-booth window | Album-art bins from Spotify data; top-tracks wall chart |
| **Arcade** | /games | Cabinet glow, chiptune spill | Cabinets skinned with real game covers; playtime high-score board |
| **Bookstore** | /books | Warm window light, stacked books | Goodreads covers on shelves; currently-reading on the counter |
| **Anime café** | /anime | Lantern + poster wall | MAL covers as wall scrolls; episode-progress shelf |
| **Climbing gym** | /climbing | Glass front, floodlit wall | Real grade-pyramid as the routes on the wall, color-coded by grade |
| **Newsstand** | /blog | Corner kiosk | Blog posts as magazine covers |
| **Studio office** | /work, /projects | Blueprint window, drafting light | Project posters; architecture diagram as a wall print |
| **Observatory rooftop** | /euler | Rooftop dome + equations in neon | Accessible via stairwell; Euler problems as star-chart plaques |
| **The park corner** | /pets | Small lit pocket park | Atyansh's actual pets, stylized but recognizable: BaoBao (gray tabby cat), HuHu (orange tabby cat), Chance (small Chorkie dog). Correct colorings/markings, idle behaviors (nap, stretch, wander a few steps), name reveal on approach |

Interacting with any furnished item (walk close + prompt) deep-links to the
corresponding page on the 2D site.

## 4. Player & camera

- Third-person character, GTA-style follow camera: orbit on mouse/right-stick,
  shoulder offset, collision-aware (never clips through walls), smooth
  auto-recenter while walking.
- Locomotion: idle / walk / jog, analog blend between them; turn-in-place;
  simple step-up for curbs and stairs. No jump required in v1 unless the
  observatory stairwell design wants it.
- **Animation quality is a headline requirement.** Vendored CC0/free-licensed
  humanoid rig + animation clips (e.g. Mixamo-class walk/jog/idle/turn set)
  are permitted and encouraged — procedural-only characters are not up to the
  bar. Blend trees for speed and turning; foot sliding is a defect.
- The character is an anonymous stylized figure (not a likeness). Palette
  coheres with the world.
- Controls: WASD + mouse (pointer lock) on desktop is the designed-for path.
  Touch/gamepad support only if purely additive — they must never constrain
  or degrade the desktop experience.

## 5. Data integration

- A build step exports a `world-data.json` (+ self-hosted copies of needed
  poster/cover images to avoid CORS/texture issues) from the existing caches.
  The world consumes only this artifact — no live API calls at runtime.
- Every image in the world is real data: if the movies page shows it, the
  cinema can hang it. Counts, titles and ratings must be real. No lorem.
- Data freshness inherits the daily build; the world is rebuilt/redeployed
  with the site.

## 6. Audio

- Reuse `src/audio/` (AudioEngine, songs, instruments): each building/district
  plays its existing page theme (arcade → games chiptune, record shop → music
  groove), crossfading on entry/exit exactly as the engine already supports
  via `setMood`. Street ambience underneath (rain, distant city, neon hum —
  procedural or synthesized, no audio files).
- Audio is opt-in via an in-world diegetic control (e.g. a boombox by the
  entrance) and respects the site's existing `?audio=on` flag if present.

## 7. Visual quality bar

Screenshot-judged. Acceptance means all of:

- Wet asphalt with real reflections of signage (SSR or planar; puddle detail
  encouraged) — this is the signature shot.
- Emissive neon and marquee lighting that actually illuminates surroundings
  (bloom + local lights); readable text on signage.
- Dynamic shadows from at least the key street lights; interiors relit on
  entry with their own warm scheme.
- Volumetric or convincingly faked light shafts / fog glow around major signs.
- Post stack: tonemapped HDR, bloom, subtle vignette + grain; no raw-Three.js
  default look anywhere.
- Cohesion: one palette discipline across all buildings (cool night base,
  per-building accent hues). A screenshot of any corner should look composed.

## 8. Performance & quality policy

- **One fixed high-quality experience.** No reduced-effects tiers: the visual
  bar in §7 is the only rendering path. WebGPU-first wherever it buys
  quality. Devices that can't run it get a graceful non-interactive fallback
  (captioned video flythrough or a "visit on a desktop browser" card) — never
  a degraded world and never a blank page.
- Target: 60 fps at 1440p on an Apple-Silicon laptop. Phones are not a design
  constraint; if the experience happens to run well on a given phone, fine,
  but nothing may be sacrificed for it.
- Payload size is not a gating budget — build the good thing. Apply ordinary
  sense (stream textures lazily, don't ship unused data), but when size and
  quality conflict, quality wins. `/world` remains fully code-split — zero
  bytes added to the regular site's pages.

## 9. Tech constraints

- three.js + TypeScript (strict), Vite-built, living in this repo under
  `src/world/`, served at `/world` as part of the existing Astro build and
  Firebase deploy. No server runtime, no external network calls at runtime
  (self-contained assets only).
- Vendored third-party assets must be license-clean (CC0 or equivalently
  redistributable), recorded in `docs/WORLD_CREDITS.md`.
- No new services, no new billing surfaces.

## 10. Self-testing & acceptance

- The builder maintains a Puppeteer harness: headless WebGL screenshots of a
  fixed camera-bookmark tour (street corner, cinema marquee, each interior,
  character close-up) produced on demand; visual regressions are judged
  against the quality bar above.
- An FPS probe (scripted 30-second walk loop) reports median/1% frame times
  per milestone.
- Playability check: full walk of the block, enter every building, trigger
  every deep link, on desktop + touch emulation.

## 11. Milestones

- **M0 — Gray-box**: block layout, character controller + camera with real
  animations, collision, building shells with door triggers. Feel-first.
- **M1 — The Look**: lighting/material/post pass on the street exterior until
  the signature wet-neon screenshot holds up. No interiors yet.
- **M2 — Buildings**: all interiors furnished from real `world-data.json`;
  deep links working.
- **M3 — Audio + polish**: AudioEngine districts, ambience, touch controls,
  fallbacks, perf pass, /world entry portal on the homepage.

Each milestone ends with a screenshot set + FPS report reviewed before the
next begins.

## 12. Resolved decisions

1. **Ambient life**: none in v1. Empty, quiet block; pets only.
2. **Pets**: the actual pets, stylized from their photos (see §3 table) —
   recognizability is the point.
3. **Time**: locked night. Build-seeded daily variation is a possible later
   addition, not v1.
4. **Entry**: `/world` is unlisted — no links from the site, no sitemap entry,
   `noindex` meta. Shared by URL only, in the ?audio=on tradition.
