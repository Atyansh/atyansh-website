#!/usr/bin/env node

/**
 * Trakt OAuth Token Helper
 *
 * This script helps you obtain OAuth tokens for the Trakt API.
 *
 * Usage:
 *   node scripts/get-trakt-token.cjs
 *
 * Prerequisites:
 *   1. Create a Trakt app at https://trakt.tv/oauth/applications
 *   2. Set TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET in your .env file
 */

const https = require('https');
const readline = require('readline');
const { loadEnv, validateEnvVars, printTokenSuccess } = require('./oauth-helpers.cjs');

loadEnv();

validateEnvVars(['TRAKT_CLIENT_ID', 'TRAKT_CLIENT_SECRET'],
  'Add these to your .env file:\nTRAKT_CLIENT_ID=your_client_id\nTRAKT_CLIENT_SECRET=your_client_secret');

const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getDeviceCode() {
  const postData = JSON.stringify({
    client_id: CLIENT_ID
  });

  const options = {
    hostname: 'api.trakt.tv',
    path: '/oauth/device/code',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  };

  const response = await httpsRequest(options, postData);

  if (response.status !== 200) {
    throw new Error(`Failed to get device code: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function pollForToken(deviceCode, interval, expiresIn) {
  const postData = JSON.stringify({
    code: deviceCode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });

  const options = {
    hostname: 'api.trakt.tv',
    path: '/oauth/device/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  };

  const startTime = Date.now();
  const expiresAt = startTime + (expiresIn * 1000);

  while (Date.now() < expiresAt) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    const response = await httpsRequest(options, postData);

    if (response.status === 200) {
      return response.data;
    } else if (response.status === 400) {
      // Still waiting for user to authorize
      process.stdout.write('.');
    } else if (response.status === 409) {
      // Already approved
      return response.data;
    } else if (response.status === 410) {
      throw new Error('Code expired. Please run the script again.');
    } else if (response.status === 418) {
      throw new Error('User denied authorization.');
    } else if (response.status === 429) {
      // Slow down
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Authorization timed out. Please run the script again.');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Trakt OAuth Token Generator                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get device code
    console.log('Step 1: Getting device code...\n');
    const deviceData = await getDeviceCode();

    console.log('━'.repeat(60));
    console.log('\n📱 Please visit this URL and enter the code:\n');
    console.log(`   URL:  ${deviceData.verification_url}`);
    console.log(`   Code: ${deviceData.user_code}\n`);
    console.log('━'.repeat(60));

    console.log('\nWaiting for authorization (this will timeout in ' +
      Math.round(deviceData.expires_in / 60) + ' minutes)');
    process.stdout.write('Polling');

    // Step 2: Poll for token
    const tokenData = await pollForToken(
      deviceData.device_code,
      deviceData.interval,
      deviceData.expires_in
    );

    console.log('\n\n✅ Authorization successful!\n');
    const expiresAtUnix = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    printTokenSuccess([
      `TRAKT_ACCESS_TOKEN=${tokenData.access_token}`,
      `TRAKT_REFRESH_TOKEN=${tokenData.refresh_token}`,
      `TRAKT_TOKEN_EXPIRES_AT=${expiresAtUnix}`,
    ]);

    console.log('\n⚠️  Important: Access tokens expire every 7 days.');
    console.log('The app will automatically refresh tokens during builds when <24h remain.\n');

    // Show token expiry info
    const expiresAt = new Date(expiresAtUnix * 1000);
    console.log(`Token expires at: ${expiresAt.toLocaleString()}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
