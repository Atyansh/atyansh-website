#!/usr/bin/env node

/**
 * Push values from .env into the SITE_SECRETS secret (see site-secrets.cjs).
 * Run via ./scripts/sync-secrets-to-gcloud.sh.
 *
 * Usage:
 *   node scripts/push-secrets.cjs                       # every key already in SITE_SECRETS
 *   node scripts/push-secrets.cjs KAYA_REFRESH_TOKEN    # just these keys (adds new ones)
 *   node scripts/push-secrets.cjs --remove TMDB_READ_TOKEN
 *
 * With no key names, only keys SITE_SECRETS already has are updated: .env
 * also holds local-only values (e.g. the 1-hour PSN_ACCESS_TOKEN) that must
 * not be stored. Name a key explicitly to add it.
 *
 * Only keys whose value differs from SITE_SECRETS are written, in a single
 * new version. Values are read with dotenv, so quoted values with spaces
 * (like GOODREADS_COOKIE) work.
 */

const fs = require('fs');
const path = require('path');
const { readSecrets, writeSecrets, SECRET_NAME } = require('./site-secrets.cjs');

const ENV_FILE = path.join(process.cwd(), '.env');

async function main() {
  const args = process.argv.slice(2);
  const removals = [];
  const keys = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--remove') {
      if (!args[i + 1]) throw new Error('--remove needs a key name');
      removals.push(args[++i]);
    } else {
      keys.push(args[i]);
    }
  }

  const env = fs.existsSync(ENV_FILE) ? require('dotenv').parse(fs.readFileSync(ENV_FILE, 'utf-8')) : {};
  if (keys.length === 0 && removals.length === 0 && Object.keys(env).length === 0) {
    throw new Error('.env not found or empty');
  }

  // No key names: update every key SITE_SECRETS already has, unless this is
  // just a removal
  let toPush = keys;
  if (keys.length === 0 && removals.length === 0) {
    const known = Object.keys((await readSecrets()).values);
    toPush = Object.keys(env).filter(k => known.includes(k));
  }
  const updates = {};
  for (const key of toPush) {
    if (!env[key]) {
      console.log(`  ⊘ Skipping ${key} (not set in .env)`);
      continue;
    }
    updates[key] = env[key];
  }

  const { written, changed } = await writeSecrets(updates, { removals });
  if (!written) {
    console.log(`  Nothing to change: ${SECRET_NAME} already matches .env for ${Object.keys(updates).length} key(s)`);
  } else {
    console.log(`\nDone: ${changed.length} key(s) changed in ${SECRET_NAME}`);
  }
}

main().catch((error) => {
  console.error(`✗ ${error.message.split('\n')[0]}`);
  process.exit(1);
});
