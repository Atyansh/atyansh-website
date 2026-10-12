#!/usr/bin/env node

/**
 * The Block — world data export (runs as npm postbuild; `--dev` for local)
 *
 * Reads the site's API caches + content collections and produces the
 * self-contained artifact the 3D world consumes: world-data.json plus
 * self-hosted copies of all poster/cover art and a curated set of climbing
 * send videos, so the world makes zero runtime calls to third-party CDNs.
 *
 *   node scripts/build-world-data.cjs          → dist/world/   (production)
 *   node scripts/build-world-data.cjs --dev    → public/world/ (dev server; gitignored)
 *
 * Never fails the build: missing caches or failed downloads just produce a
 * smaller world-data.json (the world renders fallbacks for those spots).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEV = process.argv.includes('--dev');
const CACHE = '.cache';
const OUT_DIR = DEV ? path.join('public', 'world') : path.join('dist', 'world');
const ART_DIR = path.join(OUT_DIR, 'art');
// Persistent download cache: survives rebuilds and rides the build-cache
// GCS sync in CI, so ~800 images aren't re-fetched every build.
const DL_CACHE = path.join(CACHE, 'world-art');

function readCache(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CACHE, `${name}.json`), 'utf-8'));
  } catch {
    console.log(`  (no ${name} cache — skipping)`);
    return null;
  }
}

async function fetchCached(url, ext = 'jpg') {
  const key = crypto.createHash('md5').update(url).digest('hex');
  const cached = path.join(DL_CACHE, `${key}.${ext}`);
  if (fs.existsSync(cached)) return cached;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(20000),
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

/** Download all items (bounded concurrency), copy into the output, keep order */
async function collect(category, items) {
  const queue = items.filter((it) => it.url);
  const results = new Array(queue.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    for (;;) {
      const idx = next++;
      if (idx >= queue.length) return;
      results[idx] = await fetchCached(queue[idx].url);
    }
  }));
  const out = [];
  queue.forEach((item, idx) => {
    if (!results[idx]) return;
    // content-addressed name: an unchanged image keeps its path across
    // builds, so nightly deploys don't re-upload/re-version shifted indices
    const file = `${category}-${path.basename(results[idx], '.jpg')}.jpg`;
    fs.copyFileSync(results[idx], path.join(ART_DIR, file));
    const { url, ...rest } = item;
    void url;
    out.push({ ...rest, art: `/world/art/${file}` });
  });
  console.log(`  ${category}: ${out.length}/${queue.length} items`);
  return out;
}

const yearOf = (d) => {
  const y = d ? new Date(d).getUTCFullYear() : NaN;
  return Number.isFinite(y) ? y : undefined;
};
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

// Content-collection frontmatter (no YAML dependency: simple key: value)
function frontmatters(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => /\.mdx?$/.test(f) && !f.startsWith('_'))
      .map((f) => (fs.readFileSync(path.join(dir, f), 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/) ?? [])[1] ?? '');
  } catch {
    return [];
  }
}
const field = (fm, key) => (fm.match(new RegExp(`^${key}:\\s*['"]?(.*?)['"]?\\s*$`, 'm')) ?? [])[1];
const list = (fm, key) => {
  const inline = (fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm')) ?? [])[1];
  if (inline) return inline.split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const block = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-.*\\n?)+)`, 'm'));
  return block ? block[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim()).filter(Boolean) : [];
};

async function main() {
  if (!DEV && !fs.existsSync('dist')) {
    console.log('world-data: no dist/, skipping');
    return;
  }
  fs.rmSync(ART_DIR, { recursive: true, force: true }); // drop stale names from older builds
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.mkdirSync(DL_CACHE, { recursive: true });
  console.log(`Building world-data → ${OUT_DIR}`);

  const letterboxd = readCache('letterboxd-data');
  const tmdb = readCache('tmdb-tv-data');
  const spotify = readCache('spotify-data');
  const steam = readCache('steam-data');
  const igdb = readCache('igdb-covers');
  const goodreads = readCache('goodreads-data');
  const mal = readCache('myanimelist-data');
  const kaya = readCache('kaya-data');

  const data = {};

  if (letterboxd?.movies) {
    data.movies = await collect('movies', letterboxd.movies.map((m) => ({
      title: m.title, year: m.year ?? yearOf(m.releaseDate), url: m.posterImage,
    })));
  }
  if (tmdb?.shows) {
    data.tv = await collect('tv', tmdb.shows.map((s) => ({
      title: s.title, year: s.year ?? yearOf(s.firstAiredAt), url: s.posterImage?.replace('/t/p/w500/', '/t/p/w342/'),
    })));
  }
  if (spotify?.savedAlbums) {
    data.music = await collect('music', spotify.savedAlbums.map((a) => ({
      title: a.name, artist: a.artists?.[0]?.name, year: yearOf(a.release_date), url: (a.images?.[1] ?? a.images?.[0])?.url,
    })));
    const tracks = spotify.topTracks?.medium ?? spotify.topTracks?.long ?? spotify.topTracks?.short ?? [];
    data.topTracks = tracks.slice(0, 12).map((t) => ({ title: t.name, artist: t.artists?.[0]?.name ?? '' }));
    const artists = spotify.topArtists?.medium ?? spotify.topArtists?.long ?? spotify.topArtists?.short ?? [];
    data.topArtists = artists.slice(0, 10).map((a) => a.name);
  }
  // Games across Steam (hours), Nintendo (hours) and PlayStation (trophies)
  const psn = readCache('psn-data');
  const nintendo = readCache('nintendo-data');
  if (igdb || nintendo) {
    const cover = (k) => igdb?.[k]?.url?.replace('t_cover_big_2x', 't_cover_big');
    const all = [];
    for (const g of steam?.games ?? []) {
      all.push({ title: g.name, platform: 'Steam', hours: Math.round(g.playtime_forever / 60), url: cover(`steam:${g.appid}`) });
    }
    for (const g of nintendo?.games ?? []) {
      all.push({ title: g.name, platform: 'Switch', hours: Math.round((g.totalPlayTime ?? 0) / 3600),
        url: cover(`nintendo:${g.name.toLowerCase()}`) ?? g.imageUri });
    }
    for (const g of psn?.games ?? []) {
      const t = g.earnedTrophies ?? {};
      all.push({ title: g.name, platform: 'PlayStation', trophies: (t.bronze ?? 0) + (t.silver ?? 0) + (t.gold ?? 0) + (t.platinum ?? 0),
        url: cover(`psn:${g.name.toLowerCase()}`) });
    }
    all.sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1) || (b.trophies ?? 0) - (a.trophies ?? 0));
    data.games = await collect('games', all.filter((g) => g.url));
  }
  if (goodreads?.books) {
    data.books = await collect('books', goodreads.books.map((b) => ({
      title: b.title, author: b.author, status: b.status, date: b.dateRead?.slice(0, 10),
      year: yearOf(b.publishedDate), blurb: clip((b.description ?? '').replace(/<[^>]+>/g, '').trim(), 320), url: b.coverImage,
    })));
  }
  if (mal?.anime) {
    data.anime = await collect('anime', mal.anime.map((a) => ({
      title: a.englishTitle || a.title, episodes: a.episodes, watched: a.episodesWatched, status: a.status,
      year: a.year ?? yearOf(a.startDate), url: a.imageUrl?.replace(/l\.(jpg|webp)$/, '.$1'),
    })));
  }
  if (kaya?.pyramid) {
    data.climbing = kaya.pyramid
      .map((p) => ({ grade: String(p.grade?.name ?? p.grade), ordering: p.grade?.ordering ?? 0, count: p.ascent_count }))
      .filter((p) => p.count > 0 && p.grade !== 'v?')
      .sort((a, b) => a.ordering - b.ordering)
      .map(({ grade, count }) => ({ grade, count }));
  }
  if (kaya?.stats) data.climbStats = kaya.stats;
  if (kaya?.ascentsWithVideos?.length) {
    // Beta theater: the hardest sends plus the most recent ones, self-hosted
    const ord = (a) => a.climb?.grade?.ordering ?? 0;
    const byHard = [...kaya.ascentsWithVideos].sort((a, b) => ord(b) - ord(a) || new Date(b.date) - new Date(a.date));
    const byRecent = [...kaya.ascentsWithVideos].sort((a, b) => new Date(b.date) - new Date(a.date));
    const picks = [];
    const seen = new Set();
    for (const a of [...byHard.slice(0, 5), ...byRecent]) {
      if (!a.video?.video_url || seen.has(a.id)) continue;
      seen.add(a.id);
      picks.push(a);
      if (picks.length >= 8) break;
    }
    const vids = [];
    for (const a of picks) {
      const [vf, tf] = await Promise.all([
        fetchCached(a.video.video_url, 'mp4'),
        a.video.thumb_url ? fetchCached(a.video.thumb_url) : null,
      ]);
      if (!vf) continue;
      const vname = `climb-${path.basename(vf, '.mp4')}.mp4`;
      fs.copyFileSync(vf, path.join(ART_DIR, vname));
      let thumb;
      if (tf) {
        thumb = `climb-thumb-${path.basename(tf, '.jpg')}.jpg`;
        fs.copyFileSync(tf, path.join(ART_DIR, thumb));
      }
      vids.push({
        grade: String(a.climb?.grade?.name ?? ''), date: String(a.date ?? '').slice(0, 10), gym: a.climb?.gym?.name ?? '',
        video: `/world/art/${vname}`, thumb: thumb ? `/world/art/${thumb}` : undefined,
      });
    }
    data.climbVideos = vids;
    console.log(`  climbVideos: ${vids.length} sends`);
  }

  // Content collections
  data.projects = frontmatters('src/content/projects')
    .map((fm) => ({
      title: field(fm, 'title'), description: field(fm, 'description'), tech: list(fm, 'technologies'),
      featured: /featured:\s*true/.test(fm), start: field(fm, 'startDate'),
    }))
    .filter((p) => p.title)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || String(b.start ?? '').localeCompare(String(a.start ?? '')));
  data.posts = frontmatters('src/content/blog')
    .filter((fm) => !/draft:\s*true/.test(fm))
    .map((fm) => ({ title: field(fm, 'title'), description: field(fm, 'description'), date: field(fm, 'pubDate') }))
    .filter((p) => p.title);
  data.euler = frontmatters('src/content/eulerProblems')
    .map((fm) => ({ n: Number(field(fm, 'problemNumber')), title: field(fm, 'title'), difficulty: Number(field(fm, 'difficulty')) || undefined, solved: !/solved:\s*false/.test(fm) }))
    .filter((e) => e.n && e.solved)
    .sort((a, b) => a.n - b.n)
    .map(({ n, title, difficulty }) => ({ n, title, difficulty }));
  data.pets = frontmatters('src/content/pets')
    .map((fm) => ({ name: field(fm, 'name'), species: field(fm, 'species'), breed: field(fm, 'breed'), birthday: field(fm, 'birthday'), favorites: list(fm, 'favoriteThings') }))
    .filter((p) => p.name);
  console.log(`  projects ${data.projects.length}, posts ${data.posts.length}, euler ${data.euler.length}, pets ${data.pets.length}`);

  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'world-data.json'), JSON.stringify(data));
  console.log(`world-data.json written (${fs.readdirSync(ART_DIR).length} art files)`);
}

main().catch((e) => {
  console.error('world-data failed (non-fatal):', e.message);
  process.exit(0);
});
