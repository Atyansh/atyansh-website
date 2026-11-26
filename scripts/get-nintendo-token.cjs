#!/usr/bin/env node

/**
 * One-time Nintendo Account sign-in for the Nintendo Switch integration.
 * Produces NINTENDO_SESSION_TOKEN (valid ~2 years), which each build trades
 * for a 15-minute access token to read your Switch play history.
 *
 * Steps:
 *   1. node scripts/get-nintendo-token.cjs
 *      Prints a Nintendo sign-in link. Open it and sign in. On the
 *      "Select this person" page, right-click the red button and copy the
 *      link address (don't click it). The link starts with npf5c38e31cd085304b://auth
 *   2. pbpaste | node scripts/get-nintendo-token.cjs finish
 *      (or: node scripts/get-nintendo-token.cjs finish '<link>')
 *      Exchanges the link for a session token, checks it by reading your
 *      play history, and saves NINTENDO_SESSION_TOKEN to .env.
 *   3. node scripts/push-secrets.cjs NINTENDO_SESSION_TOKEN
 *      Stores it in SITE_SECRETS for Cloud Build.
 *
 * The sign-in uses the Nintendo Store app's login client (the same one the
 * Nintendo Store mobile app uses), so Nintendo's confirmation page and your
 * account's linked-apps list will say "Nintendo Store". Your password goes
 * only to Nintendo; this script never sees it. The link expires after a few
 * minutes, so finish soon after copying it.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { applyEnvUpdates } = require('./env-file.cjs');

const CLIENT_ID = '5c38e31cd085304b';
const REDIRECT_URI = `npf${CLIENT_ID}://auth`;
const SCOPE = 'openid user user.mii user.email user.links[].id';
const ACCOUNTS = 'https://accounts.nintendo.com/connect/1.0.0';
const PLAY_HISTORIES = 'https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories';

const ROOT = path.join(__dirname, '..');
const PENDING_FILE = path.join(ROOT, '.cache', 'nintendo-signin-pending.json');
const SAMPLE_FILE = path.join(ROOT, '.cache', 'nintendo-play-histories-sample.json');
const ENV_FILE = path.join(ROOT, '.env');

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function start() {
  const verifier = b64url(crypto.randomBytes(32));
  const state = b64url(crypto.randomBytes(36));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify({ verifier, state, created: Date.now() }), { mode: 0o600 });

  const params = new URLSearchParams({
    state,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    scope: SCOPE,
    response_type: 'session_token_code',
    session_token_code_challenge: challenge,
    session_token_code_challenge_method: 'S256',
    theme: 'login_form',
  });
  console.log('1. Open this link and sign in to your Nintendo Account:\n');
  console.log(`   ${ACCOUNTS}/authorize?${params}\n`);
  console.log('2. On the "Select this person" page, RIGHT-CLICK the red button and choose "Copy Link Address".');
  console.log('   Don\'t click it. The link starts with ' + REDIRECT_URI + '\n');
  console.log('3. Then run:  pbpaste | node scripts/get-nintendo-token.cjs finish\n');
}

async function readLink(arg) {
  if (arg) return arg.trim();
  if (process.stdin.isTTY) throw new Error('Pass the copied link: pbpaste | node scripts/get-nintendo-token.cjs finish');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}

async function postJson(url, body, contentType) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Accept: 'application/json' },
    body: contentType.startsWith('application/json') ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function finish(arg) {
  if (!fs.existsSync(PENDING_FILE)) throw new Error('No sign-in in progress. Run step 1 first: node scripts/get-nintendo-token.cjs');
  const { verifier, state } = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));

  const link = await readLink(arg);
  if (!link.startsWith(`${REDIRECT_URI}#`)) {
    throw new Error(`That isn't the sign-in link. It should start with ${REDIRECT_URI}# (copy the red button's link, don't click it)`);
  }
  const fragment = new URLSearchParams(link.slice(link.indexOf('#') + 1));
  if (fragment.get('state') !== state) throw new Error('The link is from a different sign-in attempt. Run step 1 again and use the new link.');
  const code = fragment.get('session_token_code');
  if (!code) throw new Error('The link has no session_token_code. Copy it again from the "Select this person" button.');

  const { session_token: sessionToken } = await postJson(`${ACCOUNTS}/api/session_token`, {
    client_id: CLIENT_ID,
    session_token_code: code,
    session_token_code_verifier: verifier,
  }, 'application/x-www-form-urlencoded');
  if (!sessionToken) throw new Error('Nintendo returned no session token');
  fs.unlinkSync(PENDING_FILE);

  // Check it works end to end: session token -> access token -> play history
  const { access_token: accessToken } = await postJson(`${ACCOUNTS}/api/token`, {
    client_id: CLIENT_ID,
    session_token: sessionToken,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
  }, 'application/json; charset=utf-8');
  const res = await fetch(PLAY_HISTORIES, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'gentry-locale': 'en-US' },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Signed in, but reading play history failed: HTTP ${res.status}: ${body.slice(0, 200)}`);
  const data = JSON.parse(body);
  fs.writeFileSync(SAMPLE_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });

  const content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  fs.writeFileSync(ENV_FILE, applyEnvUpdates(content, { NINTENDO_SESSION_TOKEN: sessionToken }));

  const games = data.playHistories || [];
  console.log(`✓ Signed in. Play history has ${games.length} game(s), e.g.:`);
  for (const g of games.slice(0, 5)) console.log(`   • ${g.titleName}: ${g.totalPlayedMinutes} min`);
  console.log(`\n✓ Saved NINTENDO_SESSION_TOKEN to .env (sample response in ${path.relative(ROOT, SAMPLE_FILE)})`);
  console.log('\nNext: node scripts/push-secrets.cjs NINTENDO_SESSION_TOKEN');
}

const [command, arg] = process.argv.slice(2);
(command === 'finish' ? finish(arg) : Promise.resolve(start())).catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
