#!/usr/bin/env node

/**
 * TMDB TV Setup
 *
 * One-time setup for tracking TV shows on TMDB:
 *   1. Authorizes your TMDB account (v4 user access token — never expires)
 *   2. Creates a public "TV Shows I've Watched" list on your TMDB account
 *
 * Add shows to the list / rate them on themoviedb.org (or the TMDB app) and
 * the site picks them up on the next build. No token refresh needed.
 *
 * Prerequisites:
 *   TMDB_READ_TOKEN in .env — the "API Read Access Token" from
 *   https://www.themoviedb.org/settings/api
 *
 * Usage:
 *   node scripts/setup-tmdb.cjs
 */

const { loadEnv, validateEnvVars, openBrowser, printTokenSuccess } = require('./oauth-helpers.cjs');

loadEnv();

validateEnvVars(['TMDB_READ_TOKEN'],
  'TMDB_READ_TOKEN is the "API Read Access Token" shown at https://www.themoviedb.org/settings/api');

const READ_TOKEN = process.env.TMDB_READ_TOKEN;
const V4 = 'https://api.themoviedb.org/4';
const LIST_NAME = "TV Shows I've Watched";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(url, { method = 'GET', bearer, body } = {}) {
  const headers = { 'Content-Type': 'application/json;charset=utf-8' };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${url} -> ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * v4 user authorization: request token -> user approves in browser -> access token.
 * The access token is long-lived (valid until manually revoked), so the daily
 * build never needs a refresh flow.
 */
async function authorize() {
  if (process.env.TMDB_ACCESS_TOKEN && process.env.TMDB_ACCOUNT_OBJECT_ID) {
    console.log('✓ Reusing TMDB_ACCESS_TOKEN from .env');
    return {
      accessToken: process.env.TMDB_ACCESS_TOKEN,
      accountId: process.env.TMDB_ACCOUNT_OBJECT_ID,
    };
  }

  const { request_token } = await api(`${V4}/auth/request_token`, {
    method: 'POST', bearer: READ_TOKEN, body: {},
  });

  const approveUrl = `https://www.themoviedb.org/auth/access?request_token=${request_token}`;
  console.log('\n🌐 Opening your browser to approve access...');
  console.log(`   If it doesn't open automatically, visit:\n   ${approveUrl}\n`);
  openBrowser(approveUrl);

  // Poll until the user clicks "Approve" — the exchange fails until then,
  // so no terminal interaction is needed.
  console.log('⏳ Waiting for approval (polling every 5s, up to 5 minutes)...');
  const deadline = Date.now() + 5 * 60 * 1000;
  while (true) {
    try {
      const data = await api(`${V4}/auth/access_token`, {
        method: 'POST', bearer: READ_TOKEN, body: { request_token },
      });
      console.log('✓ Authorized');
      return { accessToken: data.access_token, accountId: data.account_id };
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for approval (last error: ${error.message})`);
      }
      await sleep(5000);
    }
  }
}

/**
 * Find the watched-shows list on the account, or create it (public, so the
 * build could even read it unauthenticated).
 */
async function findOrCreateList(accessToken, accountId) {
  let page = 1, totalPages = 1;
  while (page <= totalPages) {
    const data = await api(`${V4}/account/${accountId}/lists?page=${page}`, { bearer: accessToken });
    const existing = (data.results || []).find(l => l.name === LIST_NAME);
    if (existing) {
      console.log(`✓ Found existing list "${LIST_NAME}" (id ${existing.id})`);
      return existing.id;
    }
    totalPages = data.total_pages || 1;
    page++;
  }

  const created = await api(`${V4}/list`, {
    method: 'POST', bearer: accessToken,
    body: {
      name: LIST_NAME,
      iso_639_1: 'en',
      public: true,
      description: 'TV shows I have watched (displayed on atyansh.com/tv)',
    },
  });
  console.log(`✓ Created list "${LIST_NAME}" (id ${created.id})`);
  return created.id;
}

async function main() {
  console.log('\n📺 TMDB TV Setup\n');

  const { accessToken, accountId } = await authorize();
  const listId = await findOrCreateList(accessToken, accountId);
  console.log(`  View the list: https://www.themoviedb.org/list/${listId}`);

  printTokenSuccess([
    `TMDB_READ_TOKEN=${READ_TOKEN}`,
    `TMDB_ACCESS_TOKEN=${accessToken}`,
    `TMDB_ACCOUNT_OBJECT_ID=${accountId}`,
    `TMDB_TV_LIST_ID=${listId}`,
  ]);
  console.log('Then sync to Secret Manager:');
  console.log('  ./scripts/sync-secrets-to-gcloud.sh TMDB_ACCESS_TOKEN TMDB_ACCOUNT_OBJECT_ID TMDB_TV_LIST_ID\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
