# API Health Monitoring Setup Guide

This guide explains how to set up Discord notifications for API health monitoring in your Cloud Build pipeline.

## Overview

The API health monitoring system runs 12 integration checks after each build and sends Discord notifications if any fail:

**APIs with credentials (can expire):**
1. Spotify (OAuth refresh token)
2. MyAnimeList (OAuth access token)
3. Steam (API key)
4. PlayStation Network (refresh token, ~10 days; NPSSO only used to bootstrap)
5. IGDB (access token for game covers)
6. TMDB (long-lived access token)
7. Kaya login (`KAYA_REFRESH_TOKEN`, from Firefox on a Mac) — alerts when the logged-in ascents query fails and the build fell back to the capped public queries. The alert shows the failure reason with tokens redacted.
8. Goodreads (`GOODREADS_COOKIE`, a signed-in session) — shelf RSS is gone, so shelves are scraped signed in. The session is renewed silently before every build, which keeps it a year from expiry. Two checks: "Goodreads" (a shelf failed or the cookie is dead; the site keeps the last good books) and "Goodreads (session renewal)" (renewal failed; the current cookie still works for now, so this is the early warning).

**Web scraping / public APIs (no credentials):**
9. Letterboxd (username-based; pages 2+ merge from the previous list when Cloudflare blocks them)
10. Nintendo Switch (Exophase scraping)
11. Kaya climbing stats (grade pyramid + send videos)

## How It Works

1. **Build runs** (`npm run build` in Cloud Build after `refresh-tokens.cjs`; `npm run build` or `npm run build:fresh` locally) - All APIs are called and cache files are created
2. **Health check runs** (`scripts/check-api-health.cjs`) - Validates cache files
3. **If failures detected** - Discord notification sent with details and @mention

### Cache Validation

The health check validates that:
- Cache file exists for each API
- Cache was created within the last hour (during THIS build)
- Cache contains actual data (not empty)

If any check fails, you get notified which API failed and how to fix it.

## Setup Instructions

### Step 1: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name (e.g., "Website Monitor")
3. Go to **Bot** in the sidebar
4. Click **Reset Token** and copy the bot token

### Step 2: Invite the Bot to a Server

The bot must share at least one server with you to send DMs.

1. Go to **OAuth2** in the sidebar
2. Copy the **Application ID** from the General Information page
3. Visit this URL (replace `YOUR_APPLICATION_ID`):
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot
   ```
4. Select a server you're in and authorize

### Step 3: Get Your Discord User ID

1. Open Discord Settings > **Advanced** > Enable **Developer Mode**
2. Right-click your own name in any chat
3. Click **Copy User ID**

### Step 4: Add the Credentials to `SITE_SECRETS`

All site credentials live in one JSON secret, `SITE_SECRETS` (see DEPLOYMENT_GUIDE.md). Add both values to `.env`:

```bash
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_USER_ID=123456789012345678
```

Then push them (naming the keys adds them):

```bash
node scripts/push-secrets.cjs DISCORD_BOT_TOKEN DISCORD_USER_ID
```

### Step 5: Check Permissions

In Cloud Build, `check-api-health.cjs` reads the Discord credentials from `SITE_SECRETS` itself (so alerts still go out even if the refresh step failed). The build service account needs project-level `roles/secretmanager.secretAccessor`, which it already has for the rest of the build — see "Service Account Permissions" in DEPLOYMENT_GUIDE.md. There are no per-secret bindings to add.

### Step 6: Test Locally (Optional)

Test the health check script on your local machine:

```bash
# Build the site first to generate cache files
npm run build

# Run health check (automatically loads .env)
node scripts/check-api-health.cjs
```

You should see output like:
```
🔍 Checking API health...

✅ Spotify: OK (5m old)
✅ MyAnimeList: OK (3m old)
❌ Steam: Cache file missing
...
```

If any APIs failed, you'll receive a Discord DM.

### Step 7: Deploy to Cloud Build

Commit and push your changes:

```bash
git add .
git commit -m "Set up Discord health notifications"
git push
```

Trigger a Cloud Build:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Watch the build logs to see the health check run.

## Understanding the Discord Notifications

### Notification Format

You'll receive a Discord DM with an embed containing:

- **Title:** "API Health Alert: 2 API(s) Failed"
- **Health Score:** e.g., "6/8 APIs (75%)"
- **Manual Intervention Required:** APIs that need you to manually update credentials
- **Self-Healing Failed:** APIs that normally auto-refresh but failed
- **Web Scraping Failed:** Scraping-based integrations that broke
- **Healthy APIs:** List of APIs that are working fine
- Sent directly to your DMs so you don't miss it

### When You Get Notified

- **Always** when any API fails during build
- **Never** when all APIs are healthy
- Health check runs after EVERY build (daily at 2 AM Pacific, plus every push to master)

## Troubleshooting

### No Discord DM Received

1. **Check Cloud Build logs:**
   ```bash
   gcloud builds list --limit=5
   gcloud builds log <BUILD_ID>
   ```

   Look for the "check-api-health" step output.

2. **Verify secrets are set:**
   ```bash
   gcloud secrets versions access latest --secret=SITE_SECRETS | jq -r '.DISCORD_BOT_TOKEN, .DISCORD_USER_ID'
   ```

3. **Check the bot is still in a shared server** - The bot must share at least one server with you

### Notification Sending Fails

Error: "401"
- **Cause:** Bot token is invalid or was reset
- **Fix:** Regenerate the token in the Discord Developer Portal, set `DISCORD_BOT_TOKEN` in `.env`, then `node scripts/push-secrets.cjs DISCORD_BOT_TOKEN`

Error: "Failed to open DM channel"
- **Cause:** Bot and user don't share a server
- **Fix:** Invite the bot to a server you're in (Step 2)

Error: "Discord credentials not configured"
- **Cause:** `SITE_SECRETS` not readable in Cloud Build, or the Discord keys are missing from it
- **Fix:** Check the keys (above) and IAM permissions (Step 5); the build log shows "Could not read Discord credentials from SITE_SECRETS" with the reason

### False Positives

If you get notifications for APIs that should work:

1. **Check if cache is being created:**
   ```bash
   # After local build
   ls -lh .cache/
   ```

2. **Verify API keys in `SITE_SECRETS`:**
   ```bash
   gcloud secrets versions access latest --secret=SITE_SECRETS | jq -r 'keys[]'
   ```

3. **Test API locally:**
   - For Spotify: `node scripts/get-spotify-token.cjs`
   - For MAL: `node scripts/get-mal-token.cjs`

## Updating API Keys

When you receive a notification that an API key expired: update the value in `.env`, then push just those keys with `node scripts/push-secrets.cjs KEY ...` (everything lives in the single `SITE_SECRETS` secret).

### Spotify
```bash
node scripts/get-spotify-token.cjs
# Follow prompts, set SPOTIFY_REFRESH_TOKEN in .env, then:
node scripts/push-secrets.cjs SPOTIFY_REFRESH_TOKEN
```

### MyAnimeList
```bash
node scripts/get-mal-token.cjs
# Follow prompts, set both tokens in .env, then:
node scripts/push-secrets.cjs MAL_ACCESS_TOKEN MAL_REFRESH_TOKEN
```

### PSN (Refresh Token / NPSSO)
PSN uses a refresh token flow that rotates every build. You only need to touch
the NPSSO when the refresh token expires or is revoked.

1. **Log out** of https://www.playstation.com then log back in (the NPSSO cookie
   value doesn't rotate on its own, so a previously-invalidated cookie can
   still be returned by the ssocookie URL)
2. Visit https://ca.account.sony.com/api/v1/ssocookie
3. Copy the `npsso` value from the JSON response
4. Set `PSN_NPSSO` in `.env`, then:
   ```bash
   node scripts/push-secrets.cjs PSN_NPSSO
   ```
5. The next build will exchange the NPSSO for a fresh refresh token and persist it automatically

### IGDB
1. Go to https://api.igdb.com/
2. Regenerate access token
3. Set `IGDB_ACCESS_TOKEN` in `.env`, then:
   ```bash
   node scripts/push-secrets.cjs IGDB_ACCESS_TOKEN
   ```

### Steam
Steam API keys don't expire, but if you need to regenerate:
1. Go to https://steamcommunity.com/dev/apikey
2. Regenerate key
3. Set `STEAM_API_KEY` in `.env`, then:
   ```bash
   node scripts/push-secrets.cjs STEAM_API_KEY
   ```

## Disabling Notifications

If you want to disable Discord notifications but keep the health check:

### Option 1: Remove the Discord keys from `SITE_SECRETS`
```bash
node scripts/push-secrets.cjs --remove DISCORD_BOT_TOKEN --remove DISCORD_USER_ID
```

The health check will still run and log results, but won't send DMs.

### Option 2: Comment out the health check step

Edit `cloudbuild.yaml` and comment out the health check step.

## Cost Estimate

- **Discord bot DMs:** Free
- **Cloud Build:** No extra cost (health check adds ~10 seconds)
- **Secret Manager:** $0 — one secret (`SITE_SECRETS`) with ≤3 versions fits in the free tier; accesses are negligible

**Total additional cost:** $0/month

## Files

- `scripts/check-api-health.cjs` - Health check script with Discord notifications
- `API_HEALTH_MONITORING.md` - This guide
- `cloudbuild.yaml` - Cloud Build configuration (health check step)

---

Generated by Claude Code
