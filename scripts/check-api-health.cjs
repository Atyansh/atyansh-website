#!/usr/bin/env node

/**
 * API Health Check Script
 *
 * Runs after the build to check which API integrations succeeded/failed.
 * Sends a Discord DM (via bot) if any APIs have expired credentials.
 *
 * Only enabled integrations are checked (src/integrations.ts: toggle on in
 * src/site.config.ts AND required keys set). Disabled ones are reported as
 * skipped, never as failures, so a fork without e.g. Spotify gets no alerts
 * about it. Keys are looked up in process.env (.env locally) and, in Cloud
 * Build, in SITE_SECRETS, since this step doesn't get the build's env.
 *
 * Usage:
 *   node scripts/check-api-health.cjs                # report + DM on failure
 *   node scripts/check-api-health.cjs --report-only  # report, never DM
 *
 * Environment Variables (for Discord notifications):
 *   DISCORD_BOT_TOKEN - Discord bot token (for sending DMs)
 *   DISCORD_USER_ID - Your Discord user ID (DM recipient)
 */

const fs = require('fs');
const path = require('path');
const { readSecrets, isCloudBuild, SECRET_NAME } = require('./site-secrets.cjs');
const { loadSiteModules } = require('./site-config.cjs');

const CACHE_DIR = path.join(process.cwd(), '.cache');
const GOODREADS_EXPIRY_WARN_DAYS = 30;

/** Days until the Goodreads login expires, from goodreads-session.json, or null if unknown */
function goodreadsDaysLeft(data) {
  const expires = data && data.expiresAt ? Date.parse(data.expiresAt) : NaN;
  return Number.isFinite(expires) ? (expires - Date.now()) / (24 * 60 * 60 * 1000) : null;
}
// cloudbuild.yaml's build and test steps don't stop the build when they fail:
// they leave <step-id> here (holding the end of their log) so this script can
// DM about it, and the deploy step refuses to deploy.
const BUILD_FAILURES_DIR = path.join(process.cwd(), '.ci-failures');
const MAX_CACHE_AGE_HOURS = 1; // Only trust cache files created in the last hour (this build)

// Discord rejects (HTTP 400) a message over any of these
const DISCORD_LIMITS = {
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  embedTotal: 6000, // title + description + field names/values + footer
  content: 2000,
};

/** Names of the Spotify lists that came back empty */
function emptySpotifyLists(data) {
  const lists = {
    'top tracks': data.topTracks && data.topTracks.long,
    'top artists': data.topArtists && data.topArtists.long,
    'playlists': data.playlists,
    'recently played': data.recentlyPlayed,
  };
  return Object.entries(lists).filter(([, list]) => !Array.isArray(list) || list.length === 0).map(([name]) => name);
}

// API configuration
const APIs = [
  {
    name: 'Spotify',
    cacheFile: 'spotify-data.json',
    checkFn: (data) => emptySpotifyLists(data).length === 0,
    failReason: (data) => `Cache exists but these lists are empty: ${emptySpotifyLists(data).join(', ')}`,
    renewal: 'Auto-refreshes tokens. If still failing: run node scripts/get-spotify-token.cjs',
    requiresApiKey: true,
    selfHealing: true, // Uses refresh token to get new access token each build
  },
  {
    name: 'MyAnimeList',
    cacheFile: 'myanimelist-data.json',
    checkFn: (data) => data.anime && data.anime.length > 0,
    renewal: 'Auto-refreshes tokens. If still failing: run node scripts/get-mal-token.cjs',
    requiresApiKey: true,
    selfHealing: true, // Refresh token auto-persists to Secret Manager
  },
  {
    name: 'Steam',
    cacheFile: 'steam-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Check STEAM_API_KEY and STEAM_ID in SITE_SECRETS',
    requiresApiKey: true,
    selfHealing: false, // API key doesn't expire
  },
  {
    name: 'PlayStation Network',
    cacheFile: 'psn-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Auto-refreshes via refresh token (~10d window). If that also fails: log out + log back in at playstation.com, get fresh NPSSO from https://ca.account.sony.com/api/v1/ssocookie, set PSN_NPSSO in .env, then node scripts/push-secrets.cjs PSN_NPSSO',
    requiresApiKey: true,
    selfHealing: true, // Auto-refreshes via refresh token for ~10d; NPSSO bootstrap only needed when that expires
  },
  {
    name: 'IGDB (Game Covers)',
    cacheFile: 'igdb-covers.json',
    checkFn: (data) => {
      // IGDB cache structure: { "platform:game": { url, timestamp }, ... }
      const keys = Object.keys(data);
      return keys.length > 0 && keys.some(key => data[key]?.url);
    },
    // IGDB cache doesn't have top-level timestamp, extract most recent from game entries
    getTimestamp: (data) => {
      const timestamps = Object.values(data)
        .filter(entry => entry && typeof entry === 'object' && entry.timestamp)
        .map(entry => entry.timestamp);
      return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    },
    // Covers are reused for 7 days (igdb.ts), so a healthy build may look
    // nothing up. The newest entry going past that means lookups are failing.
    maxAgeHours: 8 * 24,
    renewal: 'Auto-refreshes tokens. If still failing: check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET',
    requiresApiKey: true,
    selfHealing: true, // Uses client credentials to auto-refresh and persist to Secret Manager
  },
  {
    name: 'Letterboxd',
    cacheFile: 'letterboxd-data.json',
    checkFn: (data) => data.movies && data.movies.length > 0,
    renewal: 'Check LETTERBOXD_USERNAME in SITE_SECRETS (web scraping)',
    requiresApiKey: false,
  },
  {
    name: 'Goodreads',
    cacheFile: 'goodreads-data.json',
    checkFn: (data) => data.books && data.books.length > 0,
    renewal: 'The Goodreads login has expired or was signed out (password change, sign out of all devices). Sign in at goodreads.com, copy the whole Cookie request header from DevTools (Network tab), set GOODREADS_COOKIE in .env (single-quoted), then node scripts/push-secrets.cjs GOODREADS_COOKIE',
    requiresApiKey: true,
    selfHealing: false,
  },
  {
    // Alerts only as the login nears its one-year expiry. A refused silent
    // re-sign-in is the normal state (Amazon only allows it for about an
    // hour after a password login), so that alone isn't an alert; and if the
    // login dies early, the "Goodreads" check above alerts when shelves fail.
    name: 'Goodreads (login expiry)',
    cacheFile: 'goodreads-session.json',
    checkFn: (data) => goodreadsDaysLeft(data) === null || goodreadsDaysLeft(data) > GOODREADS_EXPIRY_WARN_DAYS,
    failReason: (data) => `The Goodreads login expires on ${data.expiresAt.slice(0, 10)} (${Math.max(0, Math.floor(goodreadsDaysLeft(data)))} days left); the books page stops updating after that`,
    renewal: 'Sign in at goodreads.com, copy the whole Cookie request header from DevTools (Network tab), set GOODREADS_COOKIE in .env (single-quoted), then node scripts/push-secrets.cjs GOODREADS_COOKIE',
    requiresApiKey: true,
    selfHealing: false,
  },
  {
    name: 'Nintendo Switch',
    cacheFile: 'nintendo-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Exophase scraping may have failed - check EXOPHASE_USERNAME in SITE_SECRETS',
    requiresApiKey: false,
  },
  {
    name: 'Kaya (Climbing)',
    cacheFile: 'kaya-data.json',
    // Stats and videos come from separate queries — check both, or a broken
    // ascents query ships a page with stats but no videos without alerting.
    checkFn: (data) => data.pyramid && data.pyramid.length > 0
      && data.ascentsWithVideos && data.ascentsWithVideos.length > 0,
    renewal: 'Check the build log for "Kaya GraphQL errors" (public GraphQL API; KAYA_USERNAME in SITE_SECRETS)',
    requiresApiKey: false,
  },
  {
    // Ascents come from the logged-in query; if it failed, the page still built
    // from the capped public queries, but the token needs attention.
    name: 'Kaya (Logged-in)',
    cacheFile: 'kaya-data.json',
    // A missing or stale file is "Kaya (Climbing)"'s alert, not this one's
    onlyWhenFresh: true,
    checkFn: (data) => !data.authError,
    failReason: (data) => `Logged-in fetch failed, fell back to public queries: ${data.authError}`,
    renewal: 'In Firefox on a Mac, sign in at kaya-app.kayaclimb.com, run copy(localStorage.getItem("refresh_token")) in the console, set KAYA_REFRESH_TOKEN in .env, then node scripts/push-secrets.cjs KAYA_REFRESH_TOKEN',
    requiresApiKey: true,
    selfHealing: false,
  },
  {
    name: 'TMDB (TV Shows)',
    cacheFile: 'tmdb-tv-data.json',
    checkFn: (data) => {
      if (!data.shows || data.shows.length === 0) return false;
      const showsWithPosters = data.shows.filter(s => s.posterImage && s.posterImage.length > 0);
      // At least 50% should have posters if TMDB is healthy
      return showsWithPosters.length >= data.shows.length * 0.5;
    },
    renewal: 'Token is long-lived; if revoked, re-run node scripts/setup-tmdb.cjs and sync TMDB_ACCESS_TOKEN',
    requiresApiKey: true,
    selfHealing: false,
  },
];

/** "<shortName> Website Monitor" (src/site.config.ts) */
function monitorName(modules = loadSiteModules()) {
  return modules ? `${modules.siteConfig.shortName} Website Monitor` : 'Website Monitor';
}

/**
 * Split the API entries into the ones to check and the ones to skip because
 * their integration is disabled (src/integrations.ts). Pure.
 *
 * `env` is where to look for keys; `envKnown: false` means it couldn't be
 * read (SITE_SECRETS unreachable in Cloud Build), so only the site.config
 * toggles count and every toggled-on integration is checked, as before the
 * registry. Without the registry (`modules` null) everything is checked.
 */
function selectAPIs(apis, { env = process.env, envKnown = true, modules = loadSiteModules() } = {}) {
  if (!modules) return { active: apis, skipped: [] };
  const lookup = envKnown ? env : new Proxy({}, { get: () => 'unknown' });
  const active = [];
  const skipped = [];
  for (const api of apis) {
    if (modules.integrations.isHealthCheckEnabled(api.name, lookup, modules.siteConfig.integrations)) {
      active.push(api);
    } else {
      skipped.push({ name: api.name, reason: 'Integration disabled (site.config.ts toggle off or env keys not set)' });
    }
  }
  return { active, skipped };
}

/**
 * Check health of all APIs
 */
async function checkAPIHealth(cacheDir = CACHE_DIR, apis = APIs) {
  const results = {
    healthy: [],
    failed: [],
    skipped: [],
    timestamp: new Date().toISOString(),
  };

  console.log('🔍 Checking API health...\n');

  for (const api of apis) {
    const cacheFilePath = path.join(cacheDir, api.cacheFile);

    try {
      // Check if cache file exists
      if (!fs.existsSync(cacheFilePath)) {
        if (api.onlyWhenFresh) {
          results.skipped.push({ name: api.name, reason: 'No fresh cache file (reported by its main entry)' });
          console.log(`⏭️  ${api.name}: skipped (no fresh cache file)`);
          continue;
        }
        const reason = api.requiresApiKey
          ? 'Cache file not found - API credentials may be missing or expired'
          : 'Cache file not found - web scraping may have failed';

        results.failed.push({
          name: api.name,
          reason,
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`❌ ${api.name}: Cache file missing`);
        continue;
      }

      // Read and parse cache file
      const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
      const data = JSON.parse(cacheData);

      // Check cache timestamp - only trust fresh cache from this build
      // Use custom getTimestamp function if provided (for special cache structures like IGDB)
      const cacheTimestamp = api.getTimestamp ? api.getTimestamp(data) : (data.timestamp || 0);
      const cacheAge = Date.now() - cacheTimestamp;
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      if (cacheAgeHours > (api.maxAgeHours ?? MAX_CACHE_AGE_HOURS)) {
        if (api.onlyWhenFresh) {
          results.skipped.push({ name: api.name, reason: 'Cache is stale (reported by its main entry)' });
          console.log(`⏭️  ${api.name}: skipped (stale cache)`);
          continue;
        }
        results.failed.push({
          name: api.name,
          reason: `Cache is stale (${Math.round(cacheAgeHours)}h old) - API likely failed but old cache still exists`,
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`❌ ${api.name}: Cache too old (${Math.round(cacheAgeHours)}h)`);
        continue;
      }

      // Check if data is valid using the API-specific check function
      const isValid = api.checkFn(data);

      if (!isValid) {
        results.failed.push({
          name: api.name,
          reason: api.failReason ? api.failReason(data) : 'Cache exists but contains no data - API call may have failed',
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`⚠️  ${api.name}: ${api.failReason ? api.failReason(data) : 'Empty data in cache'}`);
        continue;
      }

      // All checks passed - API is healthy
      results.healthy.push({
        name: api.name,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        cacheAgeMinutes: Math.round(cacheAge / (1000 * 60)),
        requiresApiKey: api.requiresApiKey,
        selfHealing: api.selfHealing || false,
      });
      console.log(`✅ ${api.name}: OK (${Math.round(cacheAge / (1000 * 60))}m old)`);

    } catch (error) {
      results.failed.push({
        name: api.name,
        reason: `Error reading cache: ${error.message}`,
        renewal: api.renewal,
        requiresApiKey: api.requiresApiKey,
        selfHealing: api.selfHealing || false,
      });
      console.log(`❌ ${api.name}: Error - ${error.message}`);
    }
  }

  return results;
}

/**
 * Generate text report
 */
function generateReport(results) {
  const total = results.healthy.length + results.failed.length;
  const healthPercentage = total > 0 ? Math.round((results.healthy.length / total) * 100) : 100;

  let report = '';
  report += '═══════════════════════════════════════════════\n';
  report += '          API HEALTH REPORT\n';
  report += '═══════════════════════════════════════════════\n\n';
  report += `Generated: ${new Date(results.timestamp).toLocaleString('en-US')}\n`;
  report += `Health Score: ${results.healthy.length}/${total} APIs (${healthPercentage}%)\n\n`;

  if (results.failed.length > 0) {
    // Separate failures by urgency
    const manualInterventionNeeded = results.failed.filter(f => f.requiresApiKey && !f.selfHealing);
    const selfHealingFailed = results.failed.filter(f => f.requiresApiKey && f.selfHealing);
    const scrapingFailures = results.failed.filter(f => !f.requiresApiKey);

    if (manualInterventionNeeded.length > 0) {
      report += '🚨 ACTION REQUIRED (Manual Intervention):\n';
      report += '───────────────────────────────────────────────\n';
      manualInterventionNeeded.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }

    if (selfHealingFailed.length > 0) {
      report += '⚠️  SELF-HEALING FAILED (May need investigation):\n';
      report += '───────────────────────────────────────────────\n';
      selfHealingFailed.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }

    if (scrapingFailures.length > 0) {
      report += '❌ FAILED APIs (Web Scraping):\n';
      report += '───────────────────────────────────────────────\n';
      scrapingFailures.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }
  }

  if (results.skipped && results.skipped.length > 0) {
    report += `⏭️  Skipped: ${results.skipped.map(s => s.name).join(', ')}\n\n`;
  }

  if (results.healthy.length > 0) {
    report += '✅ HEALTHY APIs:\n';
    report += '───────────────────────────────────────────────\n';
    results.healthy.forEach((api) => {
      let type = api.requiresApiKey ? 'API' : 'Scraping';
      if (api.selfHealing) type += ', Auto-refresh';
      report += `\n• ${api.name} (${type})\n`;
      report += `  Last updated: ${new Date(api.lastUpdated).toLocaleString('en-US')}\n`;
      report += `  Cache age: ${api.cacheAgeMinutes} minutes\n`;
    });
    report += '\n';
  }

  report += '═══════════════════════════════════════════════\n';

  return report;
}

function truncate(text, max) {
  const str = String(text);
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

/** Failures most urgent first, each with its category label */
/**
 * Build steps that failed this run, from BUILD_FAILURES_DIR.
 * @returns {{ step: string, logTail: string }[]}
 */
function readBuildFailures(dir = BUILD_FAILURES_DIR) {
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => !f.startsWith('.')).sort();
  } catch {
    return [];
  }
  return files.map(step => {
    let logTail = '';
    try {
      logTail = fs.readFileSync(path.join(dir, step), 'utf8').trim();
    } catch {
      // Marker without a readable log is still a failure
    }
    return { step, logTail };
  });
}

function orderedFailures(results) {
  const manual = results.failed.filter(f => f.requiresApiKey && !f.selfHealing);
  const selfHealing = results.failed.filter(f => f.requiresApiKey && f.selfHealing);
  const scraping = results.failed.filter(f => !f.requiresApiKey);
  return [
    ...manual.map(api => ({ api, label: '🚨 Action required' })),
    ...selfHealing.map(api => ({ api, label: '⚠️ Self-healing failed' })),
    ...scraping.map(api => ({ api, label: '❌ Scraping failed' })),
  ];
}

/**
 * The alert as a Discord message: one embed field per failed API, within
 * Discord's limits (25 fields, 1024 chars per value, 6000 per embed).
 * Joining every failure into one field used to exceed 1024 on bad days, and
 * Discord rejected the whole alert. Pure.
 */
function buildDiscordPayload(results) {
  const total = results.healthy.length + results.failed.length;
  const healthPercentage = total > 0 ? Math.round((results.healthy.length / total) * 100) : 0;

  const buildFailures = results.buildFailures || [];
  const embed = {
    title: buildFailures.length > 0
      ? `🛑 Website build failed (${buildFailures.map(f => f.step).join(', ')}): not deployed`
      : `⚠️ API Health Alert: ${results.failed.length} API(s) Failed`,
    color: 0xff4444,
    description: `Health Score: **${results.healthy.length}/${total} APIs (${healthPercentage}%)**`,
    fields: [],
    timestamp: new Date(results.timestamp || Date.now()).toISOString(),
    footer: { text: monitorName() },
  };

  const failureFields = [
    ...buildFailures.map(({ step, logTail }) => ({
      name: truncate(`🛑 Build step failed: ${step}`, DISCORD_LIMITS.fieldName),
      // Keep the END of the log: that's where the error is
      value: truncate(`The live site keeps the previous deploy. Last log lines:\n${logTail ? logTail.slice(-(DISCORD_LIMITS.fieldValue - 80)) : '(no log captured)'}`, DISCORD_LIMITS.fieldValue),
    })),
    ...orderedFailures(results).map(({ api, label }) => ({
      name: truncate(`${label}: ${api.name}`, DISCORD_LIMITS.fieldName),
      value: truncate(`${api.reason}\nFix: ${api.renewal}`, DISCORD_LIMITS.fieldValue),
    })),
  ];
  const healthyFields = results.healthy.length > 0
    ? [{ name: '✅ Healthy APIs', value: truncate(results.healthy.map(api => api.name).join(', '), DISCORD_LIMITS.fieldValue) }]
    : [];

  const fieldsKeeping = (count) => {
    const fields = failureFields.slice(0, count);
    if (count < failureFields.length) {
      fields.push({ name: `…and ${failureFields.length - count} more`, value: 'See the build log for the full report' });
    }
    return [...fields, ...healthyFields];
  };
  const embedSize = (fields) => embed.title.length + embed.description.length + embed.footer.text.length
    + fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);

  // Drop failures from the least urgent end until it fits, with a margin
  let kept = failureFields.length;
  while (kept > 0 && (fieldsKeeping(kept).length > DISCORD_LIMITS.fields
    || embedSize(fieldsKeeping(kept)) > DISCORD_LIMITS.embedTotal - 100)) {
    kept--;
  }
  embed.fields = fieldsKeeping(kept);

  return {
    content: buildFailures.length > 0 ? 'Website build failed:' : 'API health check detected failures:',
    embeds: [embed],
  };
}

/** The alert as plain text (≤ 2000 chars), for when the embed is rejected. Pure. */
function buildPlainTextMessage(results) {
  const total = results.healthy.length + results.failed.length;
  const lines = [
    ...(results.buildFailures || []).map(({ step }) => `🛑 Website build failed at ${step}: not deployed (the live site keeps the previous deploy)`),
    `⚠️ API Health Alert: ${results.failed.length} of ${total} API(s) failed`,
    ...orderedFailures(results).map(({ api, label }) => truncate(`• ${label}: ${api.name} — ${api.reason}`, 300)),
    'Full report in the build log.',
  ];
  return truncate(lines.join('\n'), DISCORD_LIMITS.content);
}

/**
 * Send a Discord DM via the bot. Never throws.
 */
async function sendDiscordNotification(results) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_USER_ID = process.env.DISCORD_USER_ID;

  if (!DISCORD_BOT_TOKEN || !DISCORD_USER_ID) {
    console.log('⚠️  Discord credentials not configured (need DISCORD_BOT_TOKEN and DISCORD_USER_ID)');
    return false;
  }

  const headers = {
    'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Step 1: Open a DM channel with the user
  let channelId;
  try {
    const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipient_id: DISCORD_USER_ID }),
    });

    if (!dmResponse.ok) {
      const errorText = await dmResponse.text();
      console.error(`❌ Failed to open DM channel: ${dmResponse.status} - ${errorText}`);
      return false;
    }

    const dmChannel = await dmResponse.json();
    channelId = dmChannel.id;
  } catch (error) {
    console.error(`❌ Failed to open DM channel: ${error.message}`);
    return false;
  }

  // Step 2: Send the DM (the embed, or plain text if that is rejected)
  try {
    console.log('📨 Sending Discord DM...');

    const post = (payload) => fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const response = await post(buildDiscordPayload(results));
    if (response.ok) {
      console.log('✅ Discord DM sent successfully');
      return true;
    }
    console.error(`❌ Failed to send Discord DM: ${response.status} - ${await response.text()}`);

    // The embed was rejected (most likely a limit); a plain message still
    // gets the alert through
    console.log('📨 Retrying as a plain-text message...');
    const fallback = await post({ content: buildPlainTextMessage(results) });
    if (!fallback.ok) {
      console.error(`❌ Plain-text Discord DM also failed: ${fallback.status} - ${await fallback.text()}`);
      return false;
    }
    console.log('✅ Plain-text Discord DM sent');
    return true;
  } catch (error) {
    console.error(`❌ Failed to send Discord DM: ${error.message}`);
    return false;
  }
}

/**
 * The keys this step can see. In Cloud Build that means reading SITE_SECRETS
 * directly rather than relying on the build step's .env.refresh (the alert
 * matters most when that step failed); its Discord credentials are copied
 * into process.env unless `reportOnly`. Locally it's process.env (.env).
 * @returns {Promise<{ env: object, envKnown: boolean }>}
 */
async function loadEnvForCheck({ reportOnly = false } = {}) {
  if (!isCloudBuild()) return { env: process.env, envKnown: true };
  try {
    const { values } = await readSecrets();
    if (!reportOnly) {
      for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_USER_ID']) {
        if (values[key] && !process.env[key]) process.env[key] = values[key];
      }
    }
    return { env: { ...values, ...process.env }, envKnown: true };
  } catch (error) {
    console.log(`⚠️  Could not read ${SECRET_NAME}: ${error.message} (checking every integration toggled on in site.config.ts)`);
    return { env: process.env, envKnown: false };
  }
}

/**
 * Main function
 */
async function main() {
  const reportOnly = process.argv.includes('--report-only');
  console.log(`Starting API health check${reportOnly ? ' (report only)' : ''}...\n`);
  const { env, envKnown } = await loadEnvForCheck({ reportOnly });

  const { active, skipped } = selectAPIs(APIs, { env, envKnown });
  for (const { name } of skipped) console.log(`⏭️  ${name}: skipped (integration disabled)`);
  const results = await checkAPIHealth(CACHE_DIR, active);
  results.skipped.push(...skipped);
  results.buildFailures = readBuildFailures();
  const report = generateReport(results);

  console.log('\n' + report);

  // Save report to file
  const reportPath = path.join(CACHE_DIR, 'api-health-report.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  for (const { step } of results.buildFailures) {
    console.log(`🛑 Build step failed: ${step} (site will not be deployed)`);
  }

  // Send Discord DM if the build or any API failed
  if (reportOnly) {
    console.log('Report only: no notification sent\n');
  } else if (results.failed.length > 0 || results.buildFailures.length > 0) {
    console.log('⚠️  Detected failures, sending notification...\n');
    await sendDiscordNotification(results);
  } else {
    console.log('✅ All APIs healthy, no notification needed\n');
  }

  // Don't fail the build - just notify
  process.exit(0);
}

if (require.main === module) {
  // Load .env file for local testing (Cloud Build uses Secret Manager)
  try {
    require('dotenv').config();
  } catch (error) {
    // dotenv not installed, skip (happens in Cloud Build)
  }

  main().catch((error) => {
    console.error('Error running health check:', error);
    process.exit(0);
  });
}

module.exports = {
  APIs,
  DISCORD_LIMITS,
  selectAPIs,
  monitorName,
  checkAPIHealth,
  buildDiscordPayload,
  buildPlainTextMessage,
  readBuildFailures,
  sendDiscordNotification,
  generateReport,
};
