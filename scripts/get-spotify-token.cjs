#!/usr/bin/env node

/**
 * Spotify Refresh Token Generator
 *
 * This script helps you get a Spotify refresh token for your personal website.
 *
 * Prerequisites:
 * 1. Create a Spotify app at https://developer.spotify.com/dashboard
 * 2. Add http://127.0.0.1:8888/callback to your app's Redirect URIs
 * 3. Note your Client ID and Client Secret
 *
 * Usage:
 *   node scripts/get-spotify-token.js
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { loadEnv, validateEnvVars, openBrowser, printTokenSuccess } = require('./oauth-helpers.cjs');

loadEnv();

const PORT = 8888;
// Spotify no longer allows http://localhost as a redirect URI — loopback must
// use the literal IP (https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

// Scopes needed for our use case
const SCOPES = [
  'user-top-read',           // Read top tracks and artists
  'user-library-read',       // Read saved albums
  'playlist-read-private',   // Read private playlists
  'playlist-read-collaborative', // Read collaborative playlists
].join(' ');

// PKCE helper functions
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

// Generate code verifier and challenge for PKCE
function generatePKCE() {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(sha256(verifier));
  return { verifier, challenge };
}

async function exchangeCodeForToken(code, codeVerifier, clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return await response.json();
}

async function main() {
  console.log('\n🎵 Spotify Refresh Token Generator\n');

  // Read credentials from environment
  validateEnvVars(['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    `Run: SPOTIFY_CLIENT_ID=your_id SPOTIFY_CLIENT_SECRET=your_secret node ${process.argv[1]}`);
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('✓ Found Spotify credentials');
  console.log(`  Client ID: ${clientId.substring(0, 10)}...`);

  // Generate PKCE values
  const { verifier: codeVerifier, challenge: codeChallenge } = generatePKCE();
  const state = base64URLEncode(crypto.randomBytes(16));

  // Build authorization URL
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('code_challenge', codeChallenge);

  console.log('\n📝 Authorization URL generated');
  console.log('\n🌐 Opening your browser...');
  console.log('   If it doesn\'t open automatically, visit this URL:\n');
  console.log(`   ${authUrl.toString()}\n`);

  // Try to open browser
  openBrowser(authUrl.toString());

  // Start local server to catch the callback
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/callback') {
      const { code, state: returnedState, error } = parsedUrl.query;

      if (error) {
        console.error(`\n❌ Authorization failed: ${error}`);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization Failed</h1><p>You can close this window.</p>');
        server.close();
        process.exit(1);
      }

      if (!code) {
        console.error('\n❌ No authorization code received');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error</h1><p>No authorization code received. You can close this window.</p>');
        server.close();
        process.exit(1);
      }

      if (returnedState !== state) {
        console.error('\n❌ State mismatch - possible CSRF attack');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Security Error</h1><p>State mismatch. You can close this window.</p>');
        server.close();
        process.exit(1);
      }

      console.log('\n✓ Authorization successful!');
      console.log('🔄 Exchanging code for tokens...');

      try {
        const tokenData = await exchangeCodeForToken(code, codeVerifier, clientId, clientSecret);

        console.log('\n✅ Success! Here are your tokens:\n');
        printTokenSuccess([
          `SPOTIFY_CLIENT_ID=${clientId}`,
          `SPOTIFY_CLIENT_SECRET=${clientSecret}`,
          `SPOTIFY_REFRESH_TOKEN=${tokenData.refresh_token}`,
        ]);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Spotify Authorization Success</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
                  color: white;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background: rgba(0, 0, 0, 0.2);
                  border-radius: 1rem;
                  backdrop-filter: blur(10px);
                }
                h1 { margin-top: 0; font-size: 2.5rem; }
                p { font-size: 1.2rem; opacity: 0.9; }
                .check { font-size: 4rem; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="check">✅</div>
                <h1>Authorization Successful!</h1>
                <p>Your Spotify refresh token has been generated.</p>
                <p>Check your terminal for the credentials.</p>
                <p><small>You can close this window now.</small></p>
              </div>
            </body>
          </html>
        `);

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
      } catch (error) {
        console.error('\n❌ Error exchanging code for token:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Error</h1><p>Failed to exchange code for token. Check terminal for details.</p>');
        server.close();
        process.exit(1);
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
    }
  });

  server.listen(PORT, () => {
    console.log(`⏳ Waiting for authorization on http://localhost:${PORT}`);
    console.log('   (The server will automatically close once authorization is complete)\n');
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Authorization cancelled');
    server.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
