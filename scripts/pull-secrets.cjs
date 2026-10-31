#!/usr/bin/env node

/**
 * Pull secrets from Google Cloud Secret Manager to .env
 *
 * Copies every key in the SITE_SECRETS secret (the single source of truth,
 * see site-secrets.cjs) into the local .env file before builds, preserving
 * comments and any local-only variables. Only runs locally, not in Cloud
 * Build (refresh-tokens.cjs loads SITE_SECRETS there).
 *
 * Usage:
 *   node scripts/pull-secrets.cjs
 */

const fs = require('fs');
const path = require('path');
const { readSecrets, isCloudBuild, SECRET_NAME } = require('./site-secrets.cjs');

if (isCloudBuild()) {
  console.log(`Running in Cloud Build, skipping secret sync (refresh-tokens.cjs loads ${SECRET_NAME})`);
  process.exit(0);
}

const ENV_FILE = path.join(process.cwd(), '.env');

/** Single-quote values dotenv would otherwise misread (spaces, #, quotes) */
function envValue(value) {
  return /[\s#'"]/.test(value) ? `'${value.replace(/'/g, `'\\''`)}'` : value;
}

/**
 * Write secrets into .env: replace existing lines in place, append new keys,
 * leave comments and local-only variables untouched.
 */
function writeEnvFile(secrets) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8').split('\n') : [];
  const written = new Set();

  const updated = lines.map(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || secrets[match[1]] === undefined) return line;
    written.add(match[1]);
    return `${match[1]}=${envValue(secrets[match[1]])}`;
  });

  for (const [key, value] of Object.entries(secrets)) {
    if (!written.has(key)) updated.push(`${key}=${envValue(value)}`);
  }

  fs.writeFileSync(ENV_FILE, updated.join('\n').replace(/\n*$/, '\n'));
}

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  return require('dotenv').parse(fs.readFileSync(ENV_FILE, 'utf-8'));
}

async function main() {
  console.log(`Syncing ${SECRET_NAME} from Secret Manager to .env...\n`);

  let secrets;
  try {
    ({ values: secrets } = await readSecrets());
  } catch (error) {
    console.log(`Could not read ${SECRET_NAME}: ${error.message.split('\n')[0]}`);
    console.log('If gcloud is signed out, run: gcloud auth login');
    console.log('Skipping secret sync, using existing .env file.\n');
    process.exit(0);
  }

  const existing = readEnvFile();
  const changed = Object.keys(secrets).filter(key => existing[key] !== secrets[key]);
  for (const key of Object.keys(secrets).sort()) {
    console.log(`  ${changed.includes(key) ? '✓' : '-'} ${key}${changed.includes(key) ? ' (updated)' : ''}`);
  }

  writeEnvFile(secrets);
  console.log(`\nSync complete: ${changed.length} updated, ${Object.keys(secrets).length - changed.length} unchanged\n`);
}

main().catch((error) => {
  console.error('Error syncing secrets:', error.message);
  process.exit(1);
});
