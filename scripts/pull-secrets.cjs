#!/usr/bin/env node

/**
 * Pull secrets from Google Cloud Secret Manager to .env
 *
 * This script syncs secrets from Secret Manager (single source of truth)
 * to the local .env file before builds. Only runs locally, not in Cloud Build.
 *
 * Usage:
 *   node scripts/pull-secrets.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Skip in Cloud Build - secrets are injected via secretEnv
if (process.env.BUILD_ID || process.env.CLOUD_BUILD === 'true') {
  console.log('Running in Cloud Build, skipping secret sync (using secretEnv)');
  process.exit(0);
}

// All secrets to sync from Secret Manager
const SECRETS = [
  'STEAM_API_KEY',
  'STEAM_ID',
  'PSN_NPSSO',
  'IGDB_CLIENT_ID',
  'IGDB_CLIENT_SECRET',
  'IGDB_ACCESS_TOKEN',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REFRESH_TOKEN',
  'LETTERBOXD_USERNAME',
  'MAL_CLIENT_ID',
  'MAL_CLIENT_SECRET',
  'MAL_ACCESS_TOKEN',
  'MAL_REFRESH_TOKEN',
  'GOODREADS_USER_ID',
  'NOTIFICATION_EMAIL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

const ENV_FILE = path.join(process.cwd(), '.env');

/**
 * Check if gcloud is available and authenticated
 */
function checkGcloud() {
  try {
    execSync('gcloud auth print-access-token', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get a secret value from Secret Manager
 */
function getSecret(secretName) {
  try {
    const value = execSync(
      `gcloud secrets versions access latest --secret=${secretName}`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );
    return value;
  } catch (error) {
    return null;
  }
}

/**
 * Parse existing .env file into an object
 */
function parseEnvFile() {
  const env = {};

  if (!fs.existsSync(ENV_FILE)) {
    return env;
  }

  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    // Preserve comments and empty lines as-is
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }

  return env;
}

/**
 * Write secrets to .env file, preserving comments and structure
 */
function writeEnvFile(secrets) {
  if (!fs.existsSync(ENV_FILE)) {
    // Create new .env file
    const lines = Object.entries(secrets)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    fs.writeFileSync(ENV_FILE, lines + '\n');
    return;
  }

  // Read existing file and update values
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');
  const updatedLines = [];
  const writtenKeys = new Set();

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      updatedLines.push(line);
      continue;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1];
      if (secrets[key] !== undefined) {
        updatedLines.push(`${key}=${secrets[key]}`);
        writtenKeys.add(key);
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  // Add any new secrets that weren't in the file
  for (const [key, value] of Object.entries(secrets)) {
    if (!writtenKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
}

async function main() {
  console.log('Syncing secrets from Secret Manager to .env...\n');

  // Check gcloud
  if (!checkGcloud()) {
    console.log('gcloud not authenticated. Run: gcloud auth login');
    console.log('Skipping secret sync, using existing .env file.\n');
    process.exit(0);
  }

  const existingEnv = parseEnvFile();
  const updatedSecrets = {};
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const secretName of SECRETS) {
    const value = getSecret(secretName);

    if (value !== null) {
      const trimmedValue = value.trim();
      if (existingEnv[secretName] !== trimmedValue) {
        updatedSecrets[secretName] = trimmedValue;
        console.log(`  ✓ ${secretName} (updated)`);
        syncedCount++;
      } else {
        console.log(`  - ${secretName} (unchanged)`);
        skippedCount++;
      }
      // Always include in the final set
      updatedSecrets[secretName] = trimmedValue;
    } else {
      console.log(`  ✗ ${secretName} (not found in Secret Manager)`);
      // Keep existing value if secret not in Secret Manager
      if (existingEnv[secretName]) {
        updatedSecrets[secretName] = existingEnv[secretName];
      }
      failedCount++;
    }
  }

  // Preserve any extra env vars that aren't in our SECRETS list
  for (const [key, value] of Object.entries(existingEnv)) {
    if (!SECRETS.includes(key)) {
      updatedSecrets[key] = value;
    }
  }

  writeEnvFile(updatedSecrets);

  console.log(`\nSync complete: ${syncedCount} updated, ${skippedCount} unchanged, ${failedCount} not found\n`);
}

main().catch((error) => {
  console.error('Error syncing secrets:', error.message);
  process.exit(1);
});
