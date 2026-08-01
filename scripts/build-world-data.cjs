#!/usr/bin/env node

/**
 * The Block — world data export (runs as npm postbuild)
 *
 * Reads the site's API caches and produces the self-contained artifact the
 * 3D world consumes (design brief §5): dist/world/world-data.json plus
 * self-hosted copies of poster/cover art under dist/world/art/, so the world
 * makes zero runtime calls to third-party CDNs and textures never hit CORS.
 *
 * Never fails the build: missing caches or failed downloads just produce a
 * smaller world-data.json (the world renders empty frames for those spots).
 */

const fs = require('fs');
const path = require('path');

const CACHE = '.cache';
const OUT_DIR = path.join('dist', 'world');
const ART_DIR = path.join(OUT_DIR, 'art');
// Persistent download cache: survives rebuilds locally and rides the
// build-cache GCS sync in CI, so ~800 images aren't re-fetched every build.
const DL_CACHE = path.join(CACHE, 'world-art');

function readCache(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CACHE, `${name}.json`), 'utf-8'));
  } catch {
    console.log(`  (no ${name} cache — skipping)`);
    return null;
  }
}

const crypto = require('crypto');

async function fetchCached(url) {
  const key = crypto.createHash('md5').update(url).digest('hex');
  const cached = path.join(DL_CACHE, `${key}.jpg`);
  if (fs.existsSync(cached)) return cached;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null; // not an image
    fs.writeFileSync(cached, buf);
    return cached;
  } catch {
    return null;
  }
}

/** Download all items (bounded concurrency), copy into dist, keep order */
async function collect(category, items) {
  const queue = items.filter((it) => it.url);
  const results = new Array(queue.length).fill(null);
  let next = 0;
  const workers = Array.from({ length: 10 }, async () => {
    for (;;) {
      const idx = next++;
      if (idx >= queue.length) return;
      results[idx] = await fetchCached(queue[idx].url);
    }
  });
  await Promise.all(workers);
  const out = [];
  queue.forEach((item, idx) => {
    if (!results[idx]) return;
    const file = `${category}-${out.length}.jpg`;
    fs.copyFileSync(results[idx], path.join(ART_DIR, file));
    out.push({ title: item.title, art: `/world/art/${file}`, ...item.extra });
  });
  console.log(`  ${category}: ${out.length}/${queue.length} items`);
  return out;
}

async function main() {
  if (!fs.existsSync('dist')) {
    console.log('world-data: no dist/, skipping');
    return;
  }
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.mkdirSync(DL_CACHE, { recursive: true });
  console.log('Building world-data...');

  const letterboxd = readCache('letterboxd-data');
  const tmdb = readCache('tmdb-tv-data');
  const spotify = readCache('spotify-data');
  const steam = readCache('steam-data');
  const igdb = readCache('igdb-covers');
  const books = readCache('goodreads-data');
  const anime = readCache('myanimelist-data');
  const kaya = readCache('kaya-data');

  const data = {};

  if (letterboxd?.movies) {
    data.movies = await collect('movies',
      letterboxd.movies.map((m) => ({ title: m.title, url: m.posterImage })));
  }
  if (tmdb?.shows) {
    data.tv = await collect('tv',
      tmdb.shows.map((s) => ({ title: s.title, url: s.posterImage?.replace('/t/p/w500/', '/t/p/w342/') })));
  }
  if (spotify?.savedAlbums) {
    data.music = await collect('music',
      spotify.savedAlbums.map((a) => ({
        title: a.name, url: (a.images?.[1] ?? a.images?.[0])?.url,
        extra: { artist: a.artists?.[0]?.name },
      })));
  }
  if (steam?.games && igdb) {
    const sorted = [...steam.games].sort((a, b) => b.playtime_forever - a.playtime_forever);
    data.games = await collect('games',
      sorted.map((g) => ({
        title: g.name,
        url: igdb[`steam:${g.appid}`]?.url?.replace('t_cover_big_2x', 't_cover_big'),
        extra: { hours: Math.round(g.playtime_forever / 60) },
      })).filter((g) => g.url));
  }
  if (books?.books) {
    data.books = await collect('books',
      books.books.map((b) => ({ title: b.title, url: b.coverImage })));
  }
  if (anime?.anime) {
    data.anime = await collect('anime',
      anime.anime.map((a) => ({ title: a.title, url: a.imageUrl?.replace(/l\.jpg$/, '.jpg') })));
  }
  if (kaya?.pyramid) {
    data.climbing = kaya.pyramid
      .map((p) => ({
        grade: String(p.grade?.name ?? p.grade),
        ordering: p.grade?.ordering ?? 0,
        count: p.ascent_count,
      }))
      .filter((p) => p.count > 0 && p.grade !== 'v?')
      .sort((a, b) => a.ordering - b.ordering)
      .map(({ grade, count }) => ({ grade, count }));
  }

  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'world-data.json'), JSON.stringify(data));
  const size = fs.readdirSync(ART_DIR).length;
  console.log(`world-data.json written (${size} art files)`);
}

main().catch((e) => {
  console.error('world-data failed (non-fatal):', e.message);
  process.exit(0);
});
