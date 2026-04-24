# API Health Monitoring Setup Guide

This guide explains how to set up Discord notifications for API health monitoring in your Cloud Build pipeline.

## Overview

The API health monitoring system checks all 8 API integrations after each build and sends Discord notifications if any APIs fail:

**APIs with credentials (can expire):**
1. Spotify (OAuth refresh token)
2. MyAnimeList (OAuth access token)
3. Steam (API key)
4. PlayStation Network (refresh token, ~10 days; NPSSO only used to bootstrap)
5. IGDB (access token for game covers)

**Web scraping (no credentials):**
6. Letterboxd (username-based)
7. Goodreads (user ID-based)
8. Nintendo Switch (Exophase scraping)

## How It Works

1. **Build runs** (`npm run build`) - All APIs are called and cache files are created
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

### Step 4: Add Secrets to Google Secret Manager

```bash
# Discord bot token
echo -n "your_bot_token_here" | \
  gcloud secrets create DISCORD_BOT_TOKEN --data-file=-

# Your Discord user ID (DM recipient)
echo -n "123456789012345678" | \
  gcloud secrets create DISCORD_USER_ID --data-file=-
```

### Step 5: Grant Permissions

Grant the Cloud Build service account access to the new secrets:

```bash
PROJECT_NUMBER=418072003908

for secret in DISCORD_BOT_TOKEN DISCORD_USER_ID; do
  echo "Granting access to $secret..."
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

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
git commit -m "Switch API health notifications from email to Discord"
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
- Health check runs after EVERY build (daily at 2 AM UTC)

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
   gcloud secrets versions access latest --secret=DISCORD_BOT_TOKEN
   gcloud secrets versions access latest --secret=DISCORD_USER_ID
   ```

3. **Check the bot is still in a shared server** - The bot must share at least one server with you

### Notification Sending Fails

Error: "401"
- **Cause:** Bot token is invalid or was reset
- **Fix:** Regenerate the token in the Discord Developer Portal and update the secret

Error: "Failed to open DM channel"
- **Cause:** Bot and user don't share a server
- **Fix:** Invite the bot to a server you're in (Step 2)

Error: "Discord credentials not configured"
- **Cause:** Secrets not accessible in Cloud Build
- **Fix:** Check IAM permissions (Step 5)

### False Positives

If you get notifications for APIs that should work:

1. **Check if cache is being created:**
   ```bash
   # After local build
   ls -lh .cache/
   ```

2. **Verify API keys in Secret Manager:**
   ```bash
   gcloud secrets list
   ```

3. **Test API locally:**
   - For Spotify: `node scripts/get-spotify-token.cjs`
   - For MAL: `node scripts/get-mal-token.cjs`

## Updating API Keys

When you receive a notification that an API key expired:

### Spotify
```bash
node scripts/get-spotify-token.cjs
# Follow prompts, then update secret:
echo -n "new_refresh_token" | gcloud secrets versions add SPOTIFY_REFRESH_TOKEN --data-file=-
```

### MyAnimeList
```bash
node scripts/get-mal-token.cjs
# Follow prompts, then update secrets:
echo -n "new_access_token" | gcloud secrets versions add MAL_ACCESS_TOKEN --data-file=-
echo -n "new_refresh_token" | gcloud secrets versions add MAL_REFRESH_TOKEN --data-file=-
```

### PSN (Refresh Token / NPSSO)
PSN uses a refresh token flow that rotates every build. You only need to touch
the NPSSO when the refresh token expires or is revoked.

1. **Log out** of https://www.playstation.com then log back in (the NPSSO cookie
   value doesn't rotate on its own, so a previously-invalidated cookie can
   still be returned by the ssocookie URL)
2. Visit https://ca.account.sony.com/api/v1/ssocookie
3. Copy the `npsso` value from the JSON response
4. Update secret:
   ```bash
   echo -n "new_npsso_value" | gcloud secrets versions add PSN_NPSSO --data-file=-
   ```
5. The next build will exchange the NPSSO for a fresh refresh token and persist it automatically

### IGDB
1. Go to https://api.igdb.com/
2. Regenerate access token
3. Update secrets:
   ```bash
   echo -n "new_access_token" | gcloud secrets versions add IGDB_ACCESS_TOKEN --data-file=-
   ```

### Steam
Steam API keys don't expire, but if you need to regenerate:
1. Go to https://steamcommunity.com/dev/apikey
2. Regenerate key
3. Update secret:
   ```bash
   echo -n "new_api_key" | gcloud secrets versions add STEAM_API_KEY --data-file=-
   ```

## Disabling Notifications

If you want to disable Discord notifications but keep the health check:

### Option 1: Remove Discord secrets
```bash
gcloud secrets delete DISCORD_BOT_TOKEN
gcloud secrets delete DISCORD_USER_ID
```

The health check will still run and log results, but won't send DMs.

### Option 2: Comment out the health check step

Edit `cloudbuild.yaml` and comment out the health check step.

## Cost Estimate

- **Discord Webhooks:** Free
- **Cloud Build:** No extra cost (health check adds ~10 seconds)
- **Secret Manager:** $0.06 per 10,000 accesses (negligible for daily builds)

**Total additional cost:** $0/month

## Files

- `scripts/check-api-health.cjs` - Health check script with Discord notifications
- `API_HEALTH_MONITORING.md` - This guide
- `cloudbuild.yaml` - Cloud Build configuration (health check step)

---

Generated by Claude Code
