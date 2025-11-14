# API Health Monitoring Setup Guide

This guide explains how to set up email notifications for API health monitoring in your Cloud Build pipeline.

## Overview

The API health monitoring system checks all 8 API integrations after each build and sends email notifications if any APIs fail:

**APIs with credentials (can expire):**
1. Spotify (OAuth refresh token)
2. MyAnimeList (OAuth access token)
3. Steam (API key)
4. PlayStation Network (NPSSO token - expires ~60 days)
5. IGDB (access token for game covers)

**Web scraping (no credentials):**
6. Letterboxd (username-based)
7. Goodreads (user ID-based)
8. Nintendo Switch (Exophase scraping)

## How It Works

1. **Build runs** (`npm run build`) - All APIs are called and cache files are created
2. **Health check runs** (`scripts/check-api-health.cjs`) - Validates cache files
3. **If failures detected** - Email notification sent with details

### Cache Validation

The health check validates that:
- Cache file exists for each API
- Cache was created within the last hour (during THIS build)
- Cache contains actual data (not empty)

If any check fails, you get notified which API failed and how to fix it.

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

This installs `nodemailer` and `dotenv` (added to devDependencies). Dotenv allows the health check script to automatically load your `.env` file for local testing.

### Step 2: Get Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication (if not already enabled)
3. Go to "App passwords" (search for it in settings)
4. Create a new app password:
   - App: "Mail"
   - Device: "Other (Custom name)" → Enter "Atyansh Website Monitor"
5. Copy the 16-character password (looks like: `xxxx xxxx xxxx xxxx`)

**Important:** This is NOT your regular Gmail password. It's a special app-specific password.

### Step 3: Add Secrets to Google Secret Manager

Run these commands to create the email notification secrets:

```bash
# Your email address (where notifications will be sent)
echo -n "your@email.com" | gcloud secrets create NOTIFICATION_EMAIL --data-file=-

# Gmail SMTP settings (use defaults for Gmail)
echo -n "smtp.gmail.com" | gcloud secrets create SMTP_HOST --data-file=-
echo -n "587" | gcloud secrets create SMTP_PORT --data-file=-

# Your Gmail address (sender)
echo -n "your@gmail.com" | gcloud secrets create SMTP_USER --data-file=-

# Gmail App Password (from Step 2)
echo -n "xxxx xxxx xxxx xxxx" | gcloud secrets create SMTP_PASS --data-file=-
```

### Step 4: Grant Permissions

Grant the Cloud Build service account access to the new secrets:

```bash
PROJECT_NUMBER=418072003908

for secret in NOTIFICATION_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS; do
  echo "Granting access to $secret..."
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Step 5: Test Locally (Optional)

Test the health check script on your local machine:

```bash
# Build the site first to generate cache files
npm run build

# Run health check (automatically loads .env)
node scripts/check-api-health.cjs
```

The script automatically loads your `.env` file for local testing, so no need to export variables manually!

You should see output like:
```
🔍 Checking API health...

✅ Spotify: OK (5m old)
✅ MyAnimeList: OK (3m old)
❌ Steam: Cache file missing
...
```

If any APIs failed, you'll receive an email.

### Step 6: Deploy to Cloud Build

Commit and push your changes:

```bash
git add .
git commit -m "Add API health monitoring with email notifications"
git push
```

Trigger a Cloud Build:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Watch the build logs to see the health check run.

## Understanding the Email Notifications

### Email Format

You'll receive emails with this format:

```
Subject: ⚠️ API Health Alert: 2 API(s) Failed

═══════════════════════════════════════════════
          API HEALTH REPORT
═══════════════════════════════════════════════

Generated: January 14, 2025 at 2:00 AM
Health Score: 6/8 APIs (75%)

❌ FAILED APIs (Credentials Required):
───────────────────────────────────────────────

• Spotify
  Reason: Cache file not found - API credentials may be missing or expired
  Fix: Run: node scripts/get-spotify-token.cjs

• PlayStation Network
  Reason: Cache is stale (25h old) - API likely failed but old cache still exists
  Fix: Update PSN_NPSSO token in Secret Manager (expires every ~60 days)

✅ HEALTHY APIs:
───────────────────────────────────────────────

• Steam (API Key)
  Last updated: January 14, 2025 at 1:55 AM
  Cache age: 5 minutes

...
```

### When You Get Notified

- **Always** when any API fails during build
- **Never** when all APIs are healthy
- Health check runs after EVERY build (daily at 2 AM UTC)

## Troubleshooting

### No Email Received

1. **Check Cloud Build logs:**
   ```bash
   gcloud builds list --limit=5
   gcloud builds log <BUILD_ID>
   ```

   Look for the "check-api-health" step output.

2. **Verify secrets are set:**
   ```bash
   gcloud secrets versions access latest --secret=NOTIFICATION_EMAIL
   gcloud secrets versions access latest --secret=SMTP_USER
   ```

3. **Check Gmail spam folder** - First email might be marked as spam

4. **Verify Gmail app password is correct** - Try creating a new one

### Email Sending Fails

Error: "Invalid login: 535-5.7.8 Username and Password not accepted"
- **Cause:** Wrong app password or 2FA not enabled
- **Fix:** Create a new app password following Step 2

Error: "nodemailer not installed"
- **Cause:** Dependencies not installed in Cloud Build
- **Fix:** Run `npm ci` in Cloud Build (already configured)

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

### PSN (NPSSO Token)
1. Log into PSN on a web browser
2. Open DevTools → Application → Cookies
3. Find `npsso` cookie value
4. Update secret:
   ```bash
   echo -n "new_npsso_value" | gcloud secrets versions add PSN_NPSSO --data-file=-
   ```

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

If you want to disable email notifications but keep the health check:

### Option 1: Remove email secrets
```bash
gcloud secrets delete NOTIFICATION_EMAIL
gcloud secrets delete SMTP_USER
gcloud secrets delete SMTP_PASS
```

The health check will still run and log results, but won't send emails.

### Option 2: Comment out the health check step

Edit `cloudbuild.yaml` and comment out the health check step:

```yaml
# # Check API health and send notifications if any failed
# - name: 'node:22'
#   entrypoint: node
#   args: ['scripts/check-api-health.cjs']
#   ...
```

## Cost Estimate

- **Gmail SMTP:** Free (personal Gmail account)
- **Cloud Build:** No extra cost (health check adds ~10 seconds)
- **Secret Manager:** $0.06 per 10,000 accesses (negligible for daily builds)

**Total additional cost:** $0/month

## Files Created

- `scripts/check-api-health.cjs` - Health check script
- `API_HEALTH_MONITORING.md` - This guide
- Modified: `cloudbuild.yaml` - Added health check step
- Modified: `package.json` - Added nodemailer dependency
- Modified: `src/utils/steam.ts` - Added file-based caching
- Modified: `src/utils/psn.ts` - Added file-based caching
- Modified: `src/utils/exophase-scraper.ts` - Updated cache location

---

Generated by Claude Code
