#!/usr/bin/env node

/**
 * Pre-build token refresh script
 *
 * Refreshes OAuth tokens (MAL, IGDB, PSN) and the Goodreads session BEFORE
 * the Astro build starts.
 * This avoids race conditions when multiple pages try to refresh concurrently.
 *
 * In Cloud Build it also loads every credential from the SITE_SECRETS secret
 * (see site-secrets.cjs) and writes them all to .env.refresh for the build
 * step to source. Renewed tokens are collected in memory and saved back to
 * SITE_SECRETS in ONE write at the end.
 *
 * Locally it reads .env (pull-secrets.cjs syncs it first), saves renewed
 * tokens to SITE_SECRETS the same way, and updates .env.
 *
 * Usage:
 *   node scripts/refresh-tokens.cjs
 */

const fs = require('fs');
const path = require('path');
const { readSecrets, writeSecrets, isCloudBuild, SECRET_NAME } = require('./site-secrets.cjs');
const { shellQuote, envValue, applyEnvUpdates } = require('./env-file.cjs');
const { isToggledOn } = require('./site-config.cjs');

const ENV_FILE = path.join(process.cwd(), '.env');

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

// Every token that changed this run (for .env / .env.refresh)
const envUpdates = {};
// The subset to save to SITE_SECRETS, in one write after all refreshes finish
const secretUpdates = {};

/**
 * Record a refreshed token that must outlive this build. Saved to
 * SITE_SECRETS by saveSecretUpdates() at the end of main().
 */
function persistTokenUpdate(key, value) {
  secretUpdates[key] = value;
  envUpdates[key] = value;
  process.env[key] = value;
}

/**
 * Set a per-build token that only needs to live for the current build.
 * Writes to envUpdates (for .env.refresh) and process.env, but NOT Secret Manager.
 * Used for short-lived access tokens (e.g. PSN access token, 1h TTL).
 */
function setEphemeralToken(key, value) {
  envUpdates[key] = value;
  process.env[key] = value;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry for transient failures
 * Uses exponential backoff
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx server errors (transient)
      if (response.status >= 500 && attempt < retries) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`    Retrying (${attempt + 1}/${retries}) after ${delay}ms: Server error ${response.status}`);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Retry on network errors
      if (attempt < retries) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`    Retrying (${attempt + 1}/${retries}) after ${delay}ms: ${error.message}`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError;
}

/**
 * Write tokens to a file that can be sourced by bash.
 * In Cloud Build this carries every credential (not just refreshed ones)
 * from this script to the build step, since SITE_SECRETS is read here.
 */
function writeRefreshFile(updates) {
  if (Object.keys(updates).length === 0) {
    return;
  }

  const refreshFile = path.join(process.cwd(), '.env.refresh');
  const lines = Object.entries(updates)
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join('\n');

  fs.writeFileSync(refreshFile, lines + '\n');
  console.log(`  ✓ Wrote ${Object.keys(updates).length} token(s) to .env.refresh`);
}

/**
 * Update .env file with new token values
 */
function updateEnvFile(updates) {
  if (Object.keys(updates).length === 0) {
    return;
  }

  if (!fs.existsSync(ENV_FILE)) {
    console.log('  No .env file found, skipping local .env update');
    return;
  }

  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  fs.writeFileSync(ENV_FILE, applyEnvUpdates(content, updates));
  console.log(`  ✓ Updated .env file with ${Object.keys(updates).length} token(s)`);
}

// Amazon's sign-in for Goodreads, minus openid.pape.max_auth_age=0 (which the
// site's own sign-in link sends to force a password prompt). Without it, a
// still-valid session is re-signed silently: 302 back to /ap-handler/sign-in
// with fresh at-main / sess-at-main / session-token cookies, each expiring a
// year from now. A dead session gets the 200 sign-in form instead.
const GOODREADS_SIGNIN_URL = 'https://www.goodreads.com/ap/signin?' + new URLSearchParams({
  'language': 'en_US',
  'openid.assoc_handle': 'amzn_goodreads_web_na',
  'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
  'openid.mode': 'checkid_setup',
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.return_to': 'https://www.goodreads.com/ap-handler/sign-in',
});
const GOODREADS_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:157.0) Gecko/20100101 Firefox/157.0';
const GOODREADS_SESSION_FILE = path.join(process.cwd(), '.cache', 'goodreads-session.json');

function parseCookieHeader(header) {
  const jar = new Map();
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return jar;
}

/** Apply Set-Cookie headers to a jar; returns the Expires of at-main if set */
function applySetCookies(jar, setCookies) {
  let atMainExpires = null;
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(';');
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    const expires = attrs.map(a => a.trim()).find(a => /^expires=/i.test(a));
    const expiresAt = expires ? new Date(expires.slice(8)) : null;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      jar.delete(name);
    } else {
      jar.set(name, pair.slice(eq + 1).trim());
      if (name === 'at-main') atMainExpires = expiresAt;
    }
  }
  return atMainExpires;
}

const serializeJar = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

/** Status for the "Goodreads (session renewal)" health check */
function recordGoodreadsSession(fields) {
  try {
    fs.mkdirSync(path.dirname(GOODREADS_SESSION_FILE), { recursive: true });
    fs.writeFileSync(GOODREADS_SESSION_FILE, JSON.stringify({ timestamp: Date.now(), ...fields }, null, 2));
  } catch (error) {
    console.log(`  ⚠ Goodreads: could not write session status: ${error.message}`);
  }
}

/**
 * Renew the Goodreads session so it never reaches its one-year expiry.
 *
 * Goodreads itself never re-issues the Amazon login cookies, so without this
 * GOODREADS_COOKIE would die a year after it was pasted. Re-signing in
 * silently each build moves the expiry to a year from now. The old cookie
 * keeps working after a renewal, so a failed persist is harmless.
 *
 * Writes .cache/goodreads-session.json either way so the health check can
 * alert on a failed renewal long before the cookie actually stops working.
 */
async function refreshGoodreads() {
  const cookie = process.env.GOODREADS_COOKIE;
  const userId = process.env.GOODREADS_USER_ID;
  if (!cookie || !userId) {
    console.log('  Goodreads: GOODREADS_COOKIE or GOODREADS_USER_ID not set, skipping');
    return null;
  }

  const record = recordGoodreadsSession;

  try {
    const jar = parseCookieHeader(cookie);
    const headers = () => ({ 'Cookie': serializeJar(jar), 'User-Agent': GOODREADS_USER_AGENT });

    const signIn = await fetchWithRetry(GOODREADS_SIGNIN_URL, { headers: headers(), redirect: 'manual' });
    const location = signIn.headers.get('location') || '';
    if (signIn.status !== 302 || !location.includes('/ap-handler/sign-in')) {
      throw new Error(`silent sign-in was refused (HTTP ${signIn.status}${location ? ` → ${location.split('?')[0]}` : ''}); the session has expired or was signed out`);
    }

    const expiresAt = applySetCookies(jar, signIn.headers.getSetCookie());
    if (!expiresAt) {
      throw new Error('sign-in succeeded but issued no new at-main cookie');
    }
    // Goodreads' own 6-hour session cookie; it's re-minted on every request
    jar.delete('_session_id2');

    // Only persist cookies proven to work
    const check = await fetchWithRetry(
      `https://www.goodreads.com/review/list/${userId}?shelf=read&per_page=1`,
      { headers: headers(), redirect: 'manual' },
    );
    if (check.status !== 200) {
      throw new Error(`renewed cookies were rejected by the shelf page (HTTP ${check.status})`);
    }

    persistTokenUpdate('GOODREADS_COOKIE', serializeJar(jar));
    console.log(`  ✓ Goodreads session renewed (now expires ${expiresAt.toISOString().slice(0, 10)})`);
    record({ renewed: true, expiresAt: expiresAt.toISOString() });
    return true;
  } catch (error) {
    console.log(`  ✗ Goodreads session renewal failed: ${error.message}`);
    record({ renewed: false, error: error.message });
    return null;
  }
}

/**
 * Refresh MyAnimeList tokens
 */
async function refreshMAL() {
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;
  const refreshToken = process.env.MAL_REFRESH_TOKEN;
  const accessToken = process.env.MAL_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('  Skipping MAL: missing credentials');
    return null;
  }

  // Test if current token works
  try {
    const testResponse = await fetchWithRetry('https://api.myanimelist.net/v2/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (testResponse.ok) {
      console.log('  MAL: token valid, no refresh needed');
      return null;
    }
  } catch (e) {
    // Token test failed, proceed with refresh
  }

  // Refresh the token
  console.log('  MAL: refreshing token...');
  try {
    const response = await fetchWithRetry('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.log(`  ✗ MAL refresh failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const expiresInDays = Math.round(data.expires_in / 86400);
    console.log(`  ✓ MAL token refreshed (expires in ${expiresInDays} days)`);

    // Persist all tokens in parallel
    await Promise.all([
      persistTokenUpdate('MAL_ACCESS_TOKEN', data.access_token),
      persistTokenUpdate('MAL_REFRESH_TOKEN', data.refresh_token),
    ]);

    return data;
  } catch (error) {
    console.log(`  ✗ MAL refresh error: ${error.message}`);
    return null;
  }
}

/**
 * Refresh IGDB token (uses client credentials, not refresh token)
 */
async function refreshIGDB() {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  const accessToken = process.env.IGDB_ACCESS_TOKEN;

  if (!clientId || !clientSecret) {
    console.log('  Skipping IGDB: missing credentials');
    return null;
  }

  // Test if current token works
  try {
    const testResponse = await fetchWithRetry('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: 'fields name; limit 1;',
    });

    if (testResponse.ok) {
      console.log('  IGDB: token valid, no refresh needed');
      return null;
    }
  } catch (e) {
    // Token test failed, proceed with refresh
  }

  // Get new token using client credentials
  console.log('  IGDB: refreshing token...');
  try {
    const response = await fetchWithRetry('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      console.log(`  ✗ IGDB refresh failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const expiresInDays = Math.round(data.expires_in / 86400);
    console.log(`  ✓ IGDB token refreshed (expires in ${expiresInDays} days)`);

    await persistTokenUpdate('IGDB_ACCESS_TOKEN', data.access_token);

    return data;
  } catch (error) {
    console.log(`  ✗ IGDB refresh error: ${error.message}`);
    return null;
  }
}

/**
 * Refresh PSN tokens.
 *
 * PSN session flow:
 *   NPSSO (user cookie, ~weeks)  →  access_token (1h)  +  refresh_token (~10d)
 *
 * The NPSSO is fragile — it can be invalidated when you log out of PSN on
 * any device. The refresh token is more stable, so we prefer it: bootstrap
 * from NPSSO once, then rotate the refresh token on every build. This lets
 * the NPSSO go stale without breaking the site, as long as builds run
 * within the refresh window (~10 days).
 */
async function refreshPSN() {
  const npsso = process.env.PSN_NPSSO;
  const refreshToken = process.env.PSN_REFRESH_TOKEN;

  if (!npsso && !refreshToken) {
    console.log('  Skipping PSN: no NPSSO or refresh token configured');
    return null;
  }

  // Lazy require so we fail gracefully if psn-api isn't installed
  let psnApi;
  try {
    psnApi = require('psn-api');
  } catch (e) {
    console.log('  ⚠ psn-api not installed, skipping PSN refresh');
    return null;
  }

  const expiresAt = Number(process.env.PSN_REFRESH_TOKEN_EXPIRES_AT || '0');
  const nowSecs = Math.floor(Date.now() / 1000);
  const hoursUntilExpiry = (expiresAt - nowSecs) / 3600;

  // Try refresh token path if we have one and it's not about to expire
  if (refreshToken && expiresAt > 0 && hoursUntilExpiry > 24) {
    console.log(`  PSN: using refresh token (expires in ${Math.round(hoursUntilExpiry)}h)`);
    try {
      const tokens = await psnApi.exchangeRefreshTokenForAuthTokens(refreshToken);
      console.log(`  ✓ PSN access token refreshed (valid ${Math.round(tokens.expiresIn / 60)}m)`);

      const newExpiresAt = String(Math.floor(Date.now() / 1000) + tokens.refreshTokenExpiresIn);

      await Promise.all([
        persistTokenUpdate('PSN_REFRESH_TOKEN', tokens.refreshToken),
        persistTokenUpdate('PSN_REFRESH_TOKEN_EXPIRES_AT', newExpiresAt),
      ]);
      setEphemeralToken('PSN_ACCESS_TOKEN', tokens.accessToken);

      return tokens;
    } catch (error) {
      console.log(`  ⚠ PSN refresh token exchange failed: ${error.message}`);
      console.log('  PSN: falling back to NPSSO exchange');
    }
  } else if (refreshToken) {
    console.log(`  PSN: refresh token near expiry (${Math.round(hoursUntilExpiry)}h), using NPSSO to get fresh one`);
  } else {
    console.log('  PSN: no refresh token, bootstrapping from NPSSO');
  }

  // Fallback / bootstrap: exchange NPSSO for fresh auth tokens
  if (!npsso) {
    console.log('  ✗ PSN: no NPSSO available for fallback');
    return null;
  }

  try {
    const code = await psnApi.exchangeNpssoForCode(npsso);
    const tokens = await psnApi.exchangeCodeForAccessToken(code);
    console.log(`  ✓ PSN bootstrapped from NPSSO (refresh token valid ${Math.round(tokens.refreshTokenExpiresIn / 86400)}d)`);

    const newExpiresAt = String(Math.floor(Date.now() / 1000) + tokens.refreshTokenExpiresIn);

    await Promise.all([
      persistTokenUpdate('PSN_REFRESH_TOKEN', tokens.refreshToken),
      persistTokenUpdate('PSN_REFRESH_TOKEN_EXPIRES_AT', newExpiresAt),
    ]);
    setEphemeralToken('PSN_ACCESS_TOKEN', tokens.accessToken);

    return tokens;
  } catch (error) {
    console.log(`  ✗ PSN NPSSO exchange failed: ${error.message}`);
    console.log('  Fix: get a new NPSSO from https://ca.account.sony.com/api/v1/ssocookie (log out + log back in first)');
    return null;
  }
}

/**
 * Save every renewed token to SITE_SECRETS in a single write.
 */
async function saveSecretUpdates() {
  const keys = Object.keys(secretUpdates);
  if (keys.length === 0) {
    console.log(`  No renewed tokens to save to ${SECRET_NAME}`);
    return;
  }
  try {
    await writeSecrets(secretUpdates);
  } catch (error) {
    // Rotating refresh tokens (MAL, PSN) may now be invalid upstream, so say
    // exactly what was lost
    console.log(`  ✗ Could not save to ${SECRET_NAME}: ${error.message}`);
    console.log(`    Not saved: ${keys.join(', ')}`);
    if (keys.includes('GOODREADS_COOKIE')) {
      recordGoodreadsSession({ renewed: false, error: `renewed, but could not save to ${SECRET_NAME}: ${error.message}` });
    }
  }
}

/**
 * readSecrets() with retries: if SITE_SECRETS can't be loaded, the whole
 * build runs without credentials, so a transient Secret Manager error
 * shouldn't be the end of it.
 */
async function readSecretsWithRetry({ attempts = 3, delayMs = 2000, read = readSecrets } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= attempts) throw error;
      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(`  ⚠ Could not load ${SECRET_NAME} (attempt ${attempt}/${attempts}): ${error.message}; retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

async function main() {
  console.log('🔄 Pre-build token refresh\n');

  // In Cloud Build every credential comes from SITE_SECRETS. Locally they come
  // from .env (synced from SITE_SECRETS by pull-secrets.cjs).
  let loaded = {};
  if (isCloudBuild()) {
    try {
      loaded = (await readSecretsWithRetry()).values;
      Object.assign(process.env, loaded);
      console.log(`  ✓ Loaded ${Object.keys(loaded).length} credentials from ${SECRET_NAME}\n`);
    } catch (error) {
      console.log(`  ✗ Could not load ${SECRET_NAME}: ${error.message}`);
      console.log('    Every integration will serve last-known-good data this build\n');
      return;
    }
  }

  // Refresh all tokens in parallel. Each only records its new values in
  // memory, so they can't race each other; one save happens afterwards.
  // Integrations switched off in src/site.config.ts are left alone; ones
  // without credentials skip themselves.
  const refreshers = [
    ['MAL', 'myanimelist', refreshMAL],
    ['IGDB', 'igdb', refreshIGDB],
    ['PSN', 'psn', refreshPSN],
    ['Goodreads', 'goodreads', refreshGoodreads],
  ];
  const results = await Promise.allSettled(refreshers.map(async ([name, id, refresh]) => {
    if (!isToggledOn(id)) {
      console.log(`  Skipping ${name}: switched off in src/site.config.ts`);
      return null;
    }
    const r = await refresh();
    console.log(`  ${name}: done`);
    return r;
  }));

  // Log any unexpected rejections
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.log(`  ✗ ${refreshers[i][0]} unexpected error: ${result.reason?.message || result.reason}`);
    }
  });

  console.log('');
  await saveSecretUpdates();

  if (isCloudBuild()) {
    // Hand every credential (renewed ones included) to the build step
    writeRefreshFile({ ...loaded, ...envUpdates });
  } else {
    updateEnvFile(envUpdates);
  }

  console.log('\n✅ Token refresh complete\n');
}

if (require.main === module) {
  // Load .env file for local development (not on import, e.g. from tests)
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available in Cloud Build, that's fine
  }

  // The Secret Manager gRPC client can throw async errors that escape the
  // per-call try/catch (e.g. ADC lookup failures on local machines). Those
  // must not kill the prebuild — persist failures are already tolerated.
  process.on('uncaughtException', (error) => {
    console.log(`  ⚠ Ignoring async error: ${error.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    console.log(`  ⚠ Ignoring async rejection: ${reason?.message || reason}`);
  });

  main().catch((error) => {
    console.error('Token refresh failed:', error);
    // Don't exit with error - let the build continue with existing tokens
    process.exit(0);
  });
}

module.exports = {
  parseCookieHeader,
  applySetCookies,
  serializeJar,
  shellQuote,
  envValue,
  applyEnvUpdates,
  readSecretsWithRetry,
  GOODREADS_SIGNIN_URL,
};
