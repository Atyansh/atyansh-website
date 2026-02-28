#!/usr/bin/env node

/**
 * Script to get MyAnimeList OAuth2 tokens
 *
 * IMPORTANT: MAL only supports PKCE with 'plain' code_challenge_method, NOT 'S256'!
 *
 * Steps:
 * 1. Register your app at: https://myanimelist.net/apiconfig/create
 *    - App Type: Web
 *    - App Redirect URL: http://localhost:3001/callback
 * 2. Copy your Client ID and Client Secret
 * 3. Run: node scripts/get-mal-token.cjs (loads .env automatically)
 */

const http = require('http');
const crypto = require('crypto');
const { loadEnv, validateEnvVars, openBrowser, printTokenSuccess } = require('./oauth-helpers.cjs');

loadEnv();

validateEnvVars(['MAL_CLIENT_ID', 'MAL_CLIENT_SECRET'],
  'Get credentials at: https://myanimelist.net/apiconfig/create\n' +
  'Usage: MAL_CLIENT_ID=your_id MAL_CLIENT_SECRET=your_secret node scripts/get-mal-token.cjs');

const CLIENT_ID = process.env.MAL_CLIENT_ID;
const CLIENT_SECRET = process.env.MAL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';

// Generate PKCE code verifier and challenge
// IMPORTANT: MAL only supports PLAIN method, not S256!
function generateCodeVerifier() {
  // Generate 32 random bytes and encode as base64url (results in 43 chars)
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const codeVerifier = generateCodeVerifier();
// For PLAIN method, code_challenge = code_verifier (no hashing!)
const codeChallenge = codeVerifier;

// Step 1: Generate authorization URL
const authParams = {
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  state: crypto.randomBytes(16).toString('hex'),
  code_challenge: codeChallenge,
  code_challenge_method: 'plain',  // MAL only supports 'plain', not 'S256'!
};

const authUrl = `https://myanimelist.net/v1/oauth2/authorize?${new URLSearchParams(authParams).toString()}`;

console.log('=== MyAnimeList OAuth2 Token Generator ===\n');
console.log('Step 1: Opening browser for authorization...\n');
console.log('If browser doesn\'t open, visit this URL:');
console.log(authUrl);
console.log('\nStep 2: After authorizing, you\'ll be redirected to localhost...\n');

// Open browser
openBrowser(authUrl);

// Step 2: Start local server to receive callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3001`);

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No authorization code received</h1>');
      server.close();
      process.exit(1);
    }

    // Step 3: Exchange code for tokens
    console.log('\n✓ Authorization code received');

    const tokenParams = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    };

    console.log('Exchanging code for tokens...');

    try {
      const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
      }

      // Success!
      console.log('\n\n=== SUCCESS! ===\n');
      printTokenSuccess([
        `MAL_CLIENT_ID=${CLIENT_ID}`,
        `MAL_ACCESS_TOKEN=${data.access_token}`,
        `MAL_REFRESH_TOKEN=${data.refresh_token}`,
      ]);
      console.log(`\nAccess token expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 3600)} hours)`);
      console.log('\nNote: Use the refresh token to get a new access token when it expires.');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>Success!</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: green;">✓ Authorization Successful!</h1>
            <p>You can close this window and return to your terminal.</p>
            <p>Check your terminal for the tokens to add to your .env file.</p>
          </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);

    } catch (error) {
      console.error('\n\nError exchanging code for tokens:', error.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error.message}</h1>`);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(3001, () => {
  console.log('Waiting for authorization callback on http://localhost:3001/callback ...\n');
});

// Handle timeout
setTimeout(() => {
  console.log('\n\nTimeout: No authorization received within 5 minutes.');
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
