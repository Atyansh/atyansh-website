#!/usr/bin/env node

/**
 * Pre-build token refresh script
 *
 * Refreshes OAuth tokens (Trakt, MAL, IGDB) BEFORE the Astro build starts.
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

    await client.addSecretVersion({
      parent,
      payload: {
        data: Buffer.from(value, 'utf8'),
      },
    });

    console.log(`  ✓ Updated ${secretName} in Secret Manager`);
    return true;
  } catch (error) {
    console.log(`  ⚠ Could not update Secret Manager: ${error.message}`);
    return false;
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
 * Refresh Trakt tokens
 */
async function refreshTrakt() {
  const clientId = process.env.TRAKT_CLIENT_ID;
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;
  const refreshToken = process.env.TRAKT_REFRESH_TOKEN;
  const accessToken = process.env.TRAKT_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('  Skipping Trakt: missing credentials');
    return null;
  }

  // Check if token needs refresh based on expiry time (not API call, to avoid grace-window false positives)
  const expiresAt = Number(process.env.TRAKT_TOKEN_EXPIRES_AT || '0');
  const nowSecs = Math.floor(Date.now() / 1000);
  const hoursUntilExpiry = (expiresAt - nowSecs) / 3600;

  if (expiresAt > 0 && hoursUntilExpiry > 24) {
    console.log(`  Trakt: token valid (expires in ${Math.round(hoursUntilExpiry)}h), no refresh needed`);
    return null;
  }

  if (expiresAt === 0) {
    console.log('  Trakt: no expiry info, refreshing to be safe...');
  } else if (hoursUntilExpiry > 0) {
    console.log(`  Trakt: token expires in ${Math.round(hoursUntilExpiry)}h, refreshing proactively...`);
  } else {
    console.log(`  Trakt: token expired ${Math.round(-hoursUntilExpiry)}h ago, refreshing...`);
  }
  try {
    const response = await fetchWithRetry('https://api.trakt.tv/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ✗ Trakt refresh failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const expiresInHours = Math.round(data.expires_in / 3600);
    console.log(`  ✓ Trakt token refreshed (expires in ${expiresInHours} hours)`);

    // Compute expiry timestamp
    const expiresAtStr = String(Math.floor(Date.now() / 1000) + data.expires_in);

    // Persist all tokens in parallel
    await Promise.all([
      persistTokenUpdate('TRAKT_ACCESS_TOKEN', data.access_token),
      persistTokenUpdate('TRAKT_REFRESH_TOKEN', data.refresh_token),
      persistTokenUpdate('TRAKT_TOKEN_EXPIRES_AT', expiresAtStr),
    ]);

    return data;
  } catch (error) {
    console.log(`  ✗ Trakt refresh error: ${error.message}`);
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

async function main() {
  console.log('🔄 Pre-build token refresh\n');

  // Refresh all tokens in parallel
  const results = await Promise.allSettled([
    refreshTrakt().then(r => { console.log('  Trakt: done'); return r; }),
    refreshMAL().then(r => { console.log('  MAL: done'); return r; }),
    refreshIGDB().then(r => { console.log('  IGDB: done'); return r; }),
  ]);

  // Log any unexpected rejections
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const names = ['Trakt', 'MAL', 'IGDB'];
      console.log(`  ✗ ${names[i]} unexpected error: ${result.reason?.message || result.reason}`);
    }
  });

  // Update .env file with any changes
  console.log('');
  updateEnvFile(envUpdates);

  console.log('\n✅ Token refresh complete\n');
}

main().catch((error) => {
  console.error('Token refresh failed:', error);
  // Don't exit with error - let the build continue with existing tokens
  process.exit(0);
});
