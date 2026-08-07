#!/usr/bin/env node

/**
 * Pre-build token refresh script
 *
 * Refreshes OAuth tokens (MAL, IGDB, PSN) BEFORE the Astro build starts.
 * This avoids race conditions when multiple pages try to refresh concurrently.
 *
 * - Updates Secret Manager (for Cloud Build persistence)
 * - Updates .env file (for local development)
 *
 * Usage:
 *   node scripts/refresh-tokens.cjs
 */

const fs = require('fs');
const path = require('path');

// Load .env file for local development
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available in Cloud Build, that's fine
}

const ENV_FILE = path.join(process.cwd(), '.env');
const PROJECT_ID = 'personal-website-334502';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

// Track updates for .env file
const envUpdates = {};

/**
 * Persist a refreshed token to Secret Manager, envUpdates, and process.env
 */
async function persistTokenUpdate(key, value) {
  await updateSecretManager(key, value);
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

// Lazy singleton for SecretManagerServiceClient (avoids creating multiple gRPC clients)
let _secretManagerClient = null;
function getSecretManagerClient() {
  if (!_secretManagerClient) {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    _secretManagerClient = new SecretManagerServiceClient();
  }
  return _secretManagerClient;
}

/**
 * Update a secret in Google Cloud Secret Manager using the SDK
 */
async function updateSecretManager(secretName, value) {
  try {
    const client = getSecretManagerClient();

    const parent = `projects/${PROJECT_ID}/secrets/${secretName}`;

    const [newVersion] = await client.addSecretVersion({
      parent,
      payload: {
        data: Buffer.from(value, 'utf8'),
      },
    });

    console.log(`  ✓ Updated ${secretName} in Secret Manager`);
    await destroyOldVersions(client, parent, newVersion.name);
    return true;
  } catch (error) {
    console.log(`  ⚠ Could not update Secret Manager: ${error.message}`);
    return false;
  }
}

/**
 * Destroy every stale version of a secret except the one just added.
 * Only the latest version is ever read (builds use versions/latest), and
 * Secret Manager bills every ENABLED *and DISABLED* version at
 * ~$0.06/month — only DESTROYED versions are free. Merely disabling old
 * versions kept ~500 rotated-out tokens on the meter (~$31/month). The
 * old versions are dead tokens with no recovery value, so destroy them.
 */
async function destroyOldVersions(client, parent, keepName) {
  try {
    const [versions] = await client.listSecretVersions({ parent });
    const stale = versions.filter(v =>
      (v.state === 'ENABLED' || v.state === 'DISABLED') && v.name !== keepName);
    await Promise.all(stale.map(v => client.destroySecretVersion({ name: v.name })));
    if (stale.length > 0) {
      console.log(`  ✓ Destroyed ${stale.length} old version(s) of ${parent.split('/').pop()}`);
    }
  } catch (error) {
    // Non-fatal: the new version is already live
    console.log(`  ⚠ Could not destroy old secret versions: ${error.message}`);
  }
}

/**
 * Write refreshed tokens to a file that can be sourced by bash
 * This is used in Cloud Build where we need to pass tokens between steps
 */
function writeRefreshFile(updates) {
  if (Object.keys(updates).length === 0) {
    return;
  }

  const refreshFile = path.join(process.cwd(), '.env.refresh');
  const lines = Object.entries(updates)
    .map(([key, value]) => `export ${key}="${value}"`)
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

  // Always write the refresh file for Cloud Build
  writeRefreshFile(updates);

  if (!fs.existsSync(ENV_FILE)) {
    console.log('  No .env file found, skipping local .env update');
    return;
  }

  let content = fs.readFileSync(ENV_FILE, 'utf-8');

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(ENV_FILE, content);
  console.log(`  ✓ Updated .env file with ${Object.keys(updates).length} token(s)`);
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

async function main() {
  console.log('🔄 Pre-build token refresh\n');

  // Refresh all tokens in parallel
  const results = await Promise.allSettled([
    refreshMAL().then(r => { console.log('  MAL: done'); return r; }),
    refreshIGDB().then(r => { console.log('  IGDB: done'); return r; }),
    refreshPSN().then(r => { console.log('  PSN: done'); return r; }),
  ]);

  // Log any unexpected rejections
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const names = ['MAL', 'IGDB', 'PSN'];
      console.log(`  ✗ ${names[i]} unexpected error: ${result.reason?.message || result.reason}`);
    }
  });

  // Update .env file with any changes
  console.log('');
  updateEnvFile(envUpdates);

  console.log('\n✅ Token refresh complete\n');
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
