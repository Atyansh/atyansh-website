# Deployment Guide - Automated Daily Builds

## What We've Accomplished ✅

1. ✅ Updated and authenticated gcloud CLI
2. ✅ Set project to `personal-website-334502`
3. ✅ Enabled required APIs (Cloud Build, Secret Manager, Cloud Scheduler, Cloud Storage)
4. ✅ Created `cloudbuild.yaml` configuration
5. ✅ Created 24 secrets in Google Secret Manager (20 API keys + 1 token metadata + 2 Discord notification settings)
6. ✅ Granted IAM permissions to Cloud Build service accounts
7. ✅ Configured Cloud Storage bucket (`gs://atyansh.com/`)
8. ✅ Updated Cloud Build to use custom Docker image (`gcr.io/personal-website-334502/node-puppeteer:22`) with Chrome dependencies pre-installed
9. ✅ Granted Secret Manager access to Compute Engine service account
10. ✅ Successfully deployed site via Cloud Build
11. ✅ Configured API health monitoring with Discord notifications
12. ✅ Added file-based caching to all API integrations (generic `FileCache<T>` utility)
13. ✅ Added TV shows page with TMDB integration
14. ✅ Added climbing page with Kaya integration
15. ✅ Moved TV show tracking to a TMDB list + account ratings (July 2026)
16. ✅ Migrated hosting from GCS + Load Balancer + Cloud CDN to Firebase Hosting (July 2026)

## Working Configuration

The site is now deployed and accessible at https://atyansh.com

## Key Configuration Details

### Service Account Permissions

**IMPORTANT:** Cloud Build uses the **Compute Engine default service account** for builds, NOT the Cloud Build service account. The correct service account is:

```
418072003908-compute@developer.gserviceaccount.com
```

This service account requires two Secret Manager permissions:

| Role | Purpose |
|------|---------|
| `roles/secretmanager.secretAccessor` | Read secrets during build |
| `roles/secretmanager.secretVersionManager` | Auto-refresh OAuth tokens (MAL, IGDB, PSN) |

**If you encounter permission errors**, grant both permissions:
```bash
# Read access (required)
gcloud projects add-iam-policy-binding personal-website-334502 \
  --member="serviceAccount:418072003908-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Write access for token auto-refresh (required for self-healing)
gcloud projects add-iam-policy-binding personal-website-334502 \
  --member="serviceAccount:418072003908-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretVersionManager"
```

### Custom Docker Image

Cloud Build uses a custom Docker image (`gcr.io/personal-website-334502/node-puppeteer:22`) based on Node.js 22 with Chrome/Puppeteer dependencies pre-installed. This eliminates the need to `apt-get install` ~25 packages on every build.

**When to rebuild the image:**
- Node.js major version bumps (e.g., 22 → 24)
- Puppeteer upgrades that require new system dependencies
- Chrome dependency changes

**How to rebuild:**
```bash
gcloud builds submit --config=cloudbuild-image.yaml .
```

The image is defined in `Dockerfile.cloudbuild` and built via `cloudbuild-image.yaml`.

### Node.js Version Requirement

**IMPORTANT:** Cloud Build must use **Node.js 22** to match the local development environment.

The `psn-api` package (v2.15.0) requires Node.js >=20 and provides backwards-compatible function names on Node 22:
- `exchangeNpssoForCode` (older, still supported)
- `exchangeCodeForAccessToken` (older, still supported)

These function names work correctly on Node.js 22. The `cloudbuild.yaml` is configured to use the custom `node-puppeteer:22` image.

## Troubleshooting Steps

### Option 1: Wait and Retry (Recommended)

IAM permissions can take up to 7 minutes to fully propagate. Try again in 5-10 minutes:

```bash
cd /Users/atyansh/Repos/atyansh-website
gcloud builds submit --config cloudbuild.yaml .
```

Watch the build progress at:
https://console.cloud.google.com/cloud-build/builds?project=personal-website-334502

### Option 2: Verify Permissions Manually

Check if the service accounts have access:

```bash
# Check one secret's permissions
gcloud secrets get-iam-policy STEAM_API_KEY

# Should show both:
# - serviceAccount:418072003908@cloudbuild.gserviceaccount.com
# - serviceAccount:service-418072003908@gcp-sa-cloudbuild.iam.gserviceaccount.com
```

### Option 3: Re-grant Permissions

If needed, re-run the permission grant script:

```bash
cd /Users/atyansh/Repos/atyansh-website

# Re-grant to both service accounts
for secret in STEAM_API_KEY STEAM_ID PSN_NPSSO IGDB_CLIENT_ID IGDB_CLIENT_SECRET \
              IGDB_ACCESS_TOKEN SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET SPOTIFY_REFRESH_TOKEN \
              LETTERBOXD_USERNAME MAL_CLIENT_ID MAL_CLIENT_SECRET \
              MAL_ACCESS_TOKEN MAL_REFRESH_TOKEN GOODREADS_USER_ID; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:service-418072003908@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Option 4: Test Build Locally First

Build and deploy manually to verify everything works:

```bash
# Build locally
npm run build

# Deploy to Firebase Hosting (cache headers come from firebase.json)
npx firebase-tools deploy --only hosting --project personal-website-334502
```

Or use `./deploy.sh`, which does both the build and the deploy.

## Setting Up Daily Automated Builds

Once the manual build works, set up Cloud Scheduler:

### Step 1: Create Cloud Build Trigger

```bash
# This creates a manual trigger you can invoke via API
gcloud builds triggers create manual \
  --name="daily-website-rebuild" \
  --repo="https://github.com/Atyansh/atyansh-website" \
  --repo-type=GITHUB \
  --branch="master" \
  --build-config="cloudbuild.yaml"
```

**Note:** You may need to connect your GitHub repository first at:
https://console.cloud.google.com/cloud-build/triggers/connect?project=personal-website-334502

### Step 2: Alternative - Direct Cloud Scheduler (Without GitHub)

If you don't want to connect GitHub, use Cloud Scheduler to trigger builds directly:

```bash
# Get your Cloud Build API URL
PROJECT_ID="personal-website-334502"

# Create a service account for the scheduler
gcloud iam service-accounts create cloud-scheduler-build \
  --display-name="Cloud Scheduler Build Trigger"

# Grant it permission to trigger builds
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:cloud-scheduler-build@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

# Create the scheduler job (runs daily at 2 AM UTC)
gcloud scheduler jobs create http daily-website-build \
  --location=us-central1 \
  --schedule="0 2 * * *" \
  --uri="https://cloudbuild.googleapis.com/v1/projects/$PROJECT_ID/builds" \
  --message-body='{
    "source": {
      "storageSource": {
        "bucket": "'$PROJECT_ID'_cloudbuild",
        "object": "source.tgz"
      }
    },
    "steps": [...]
  }' \
  --oauth-service-account-email="cloud-scheduler-build@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 3: Simpler Approach - Cron + Local Machine

If Cloud Scheduler is too complex, use a cron job on a machine that's always on:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /Users/atyansh/Repos/atyansh-website && git pull && gcloud builds submit --config cloudbuild.yaml . >> /tmp/website-build.log 2>&1
```

## Manual Deployment Script

I've created a simple deployment script for you:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Monitoring and Logs

### API Health Monitoring

The build automatically monitors all 10 API integrations and sends Discord notifications if any fail:

**Monitored APIs:**
- With API keys (self-healing): Spotify, MyAnimeList, IGDB
- With API keys (manual renewal): Steam, PSN, TMDB
- Web scraping/public APIs: Letterboxd, Goodreads, Nintendo (Exophase), Kaya (climbing)

**How it works:**
- Runs after every build (`scripts/check-api-health.cjs`)
- Validates cache files are fresh (<1 hour old)
- Checks that data was successfully fetched
- Sends a Discord DM via bot if any API fails
- Never fails the build (just notifies)
- If a scrape/API fails outright, the build serves the previous build's data (`.cache-fallback/`, restored from the Cloud Build staging bucket) so the page still renders — the alert still fires because the cache timestamp is stale

**Discord notifications are sent when:**
- API credentials are missing or expired
- Cache files are stale (API fetch failed but old cache exists)
- Web scraping failed
- Cache data is empty or invalid

See `API_HEALTH_MONITORING.md` for detailed setup instructions.

### View Build History
```bash
gcloud builds list --limit=10
```

### View Specific Build Logs
```bash
BUILD_ID="your-build-id-here"
gcloud builds log $BUILD_ID
```

### View API Health Report
```bash
# View the latest health check results
cat .cache/api-health-report.json
```

### View in Console
https://console.cloud.google.com/cloud-build/builds?project=personal-website-334502

## Updating Secrets

If you need to update any API keys:

### Option 1: Sync All Secrets from .env (Recommended)

The easiest way to update secrets after modifying your `.env` file:

```bash
# Update all 19 secrets from .env to Google Cloud
./scripts/sync-secrets-to-gcloud.sh
```

This script will:
- Read all values from your `.env` file
- Update or create each secret in Google Cloud Secret Manager
- Skip any secrets that aren't set in `.env`
- Show a summary of updated/skipped/failed secrets

**All secrets managed:**
- Gaming: `STEAM_API_KEY`, `STEAM_ID`, `PSN_NPSSO`, `PSN_REFRESH_TOKEN`, `PSN_REFRESH_TOKEN_EXPIRES_AT`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `IGDB_ACCESS_TOKEN`, `EXOPHASE_USERNAME`
- Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`
- MyAnimeList: `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET`, `MAL_ACCESS_TOKEN`, `MAL_REFRESH_TOKEN`
- TV Shows: `TMDB_READ_TOKEN`, `TMDB_ACCESS_TOKEN`, `TMDB_ACCOUNT_OBJECT_ID`, `TMDB_TV_LIST_ID`
- Web Scraping: `LETTERBOXD_USERNAME`, `GOODREADS_USER_ID`, `KAYA_USERNAME`
- Discord Notifications: `DISCORD_BOT_TOKEN`, `DISCORD_USER_ID`

### Pulling Secrets to Local .env

To sync secrets from Secret Manager to your local `.env` file:

```bash
node scripts/pull-secrets.cjs
```

This runs automatically before `npm run build` (via the `prebuild` hook), so your local builds always use the latest secrets from Secret Manager.

**Secret Manager is the single source of truth.** When tokens are auto-refreshed during a build (IGDB, MAL, PSN), they're updated in Secret Manager. The next local build will pull the fresh tokens automatically.

### Option 2: Update Individual Secrets

```bash
# Update a single secret manually
echo -n "new_value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Example: Update Spotify refresh token
echo -n "AQC..." | gcloud secrets versions add SPOTIFY_REFRESH_TOKEN --data-file=-
```

### Option 3: Use Original Script

```bash
# Create or update secrets interactively
./create-secrets.sh
```

## Cost Estimates

- Cloud Build: Free tier includes 120 build-minutes/day (should be enough)
- Secret Manager: $0.06 per 10,000 accesses (negligible for daily builds)
- Firebase Hosting: $0/month at current traffic (10 GB/month free transfer)
- Cloud Scheduler: $0.10/month per job

**Estimated total: $0.15-0.20/month**

## Troubleshooting Common Issues

### Build Times Out
- Increase timeout in `cloudbuild.yaml` (currently 1800s = 30 min)
- Letterboxd scraping reuses a single Puppeteer browser instance across all pages, and poster URL validation runs in parallel (concurrency of 10), which significantly reduces build time
- The custom Docker image eliminates ~30-60 seconds of Chrome dependency installation

### API Rate Limits
- **IGDB API (Game Covers)**: All IGDB API calls are serialized (one at a time) with automatic rate limiting to stay under the 4 req/s limit. Retry logic with exponential backoff handles any transient 429 errors. Most game covers are cached (7-day TTL per entry), so repeat builds make minimal API calls.
- All API integrations use `FileCache<T>` with 24-hour TTL to minimize redundant requests
- Reduce build frequency if hitting limits

### Secrets Expired

**Automatic detection:** The build now sends Discord notifications when API keys expire or fail. Check your Discord channel for alerts.

**Auto-refresh (try this first):**
```bash
# Refreshes MAL, IGDB, and PSN tokens automatically and persists to Secret Manager
node scripts/refresh-tokens.cjs
```

**Quick workflow:**
```bash
# 1. Run auto-refresh (updates Secret Manager and .env automatically)
node scripts/refresh-tokens.cjs

# 2. Trigger a new build to verify
gcloud builds submit --config cloudbuild.yaml .
```

**Manual renewal (fallback if auto-refresh fails):**
- **Spotify**: Re-run `scripts/get-spotify-token.cjs`, then `./scripts/sync-secrets-to-gcloud.sh`
- **MyAnimeList**: Re-run `scripts/get-mal-token.cjs`, then `./scripts/sync-secrets-to-gcloud.sh`
- **TMDB**: The v4 access token is long-lived and shouldn't expire. If revoked, re-run `node scripts/setup-tmdb.cjs`, then `./scripts/sync-secrets-to-gcloud.sh`
- **PSN**: Uses a refresh token (~10d) bootstrapped from the NPSSO. Only bootstrap when the refresh token expires or is revoked. To bootstrap: log out + log back in at playstation.com, visit https://ca.account.sony.com/api/v1/ssocookie to get a fresh NPSSO, update `.env`, then sync — the next build will exchange it for a refresh token
- **IGDB**: Regenerate access token (expires every ~61 days), update `.env`, then sync

### Build Succeeds but Site Not Updated
- Check the release landed: https://console.firebase.google.com/project/personal-website-334502/hosting (release history shows every deploy)
- Compare the preview URL (https://personal-website-334502.web.app) with atyansh.com — if the preview is fresh but the domain is stale, it's browser HTML cache (1 hour); hard-refresh
- Clear browser cache or try incognito mode

## Historical Data Snapshots

Every build appends its API caches (gzipped, ~0.4 MB per build) to
`gs://personal-website-334502_cloudbuild/snapshots/YYYY-MM-DD/HHMMSS/` — an
append-only archive for future stats/"wrapped" pages. Timestamps are UTC (the
build container has no tzdata; stats code regroups into local days at read
time). Every build gets its own directory, so nothing is ever overwritten and
intra-day builds each preserve their fetch (distinct Spotify recently-played
windows, rating changes, etc.). The `build-cache/` prefix in
the same bucket is a separate mechanism (rolling last-known-good for the
stale-cache fallback) and is overwritten, not archived. First snapshots: 2026-08-01 UTC (the evening of 2026-07-31 PT).

## Firebase Hosting

The site is served by Firebase Hosting (Blaze plan) — its global CDN terminates TLS for atyansh.com, and every `firebase deploy` automatically purges the CDN, so new content is live immediately with no invalidation step.

**Cache configuration** (in `firebase.json`):
- Static assets (`/_astro/**`): 1 year (immutable — filenames are content-hashed)
- HTML pages: 1 hour

**Deploys:**
- Cloud Build runs `npx firebase-tools deploy --only hosting` (authenticated via the build service account's ADC)
- Manual: `./deploy.sh` or `npx firebase-tools deploy --only hosting`
- Preview URL: https://personal-website-334502.web.app (always serves the latest deploy)

**Cost:** hosting transfer has a 10 GB/month free allowance, then $0.15/GB. The site's real (domain-addressed) traffic is ~3.5 GB/month, so the expected bill is $0. Note that bare-IP scanner noise — which was ~60% of egress on the old load balancer — never reaches Firebase billing at all.

**Analytics:** Firebase Hosting has no per-request logs — the old load balancer's logs/metrics (user agents, countries, bytes per path) are gone after teardown; the Firebase console shows only aggregate storage/transfer. Human page-view analytics come from GoatCounter (cookieless, no consent banner; snippet in BaseLayout.astro with View Transitions support). Dashboard: https://atyansh.goatcounter.com (login required).

## Files Created

- `cloudbuild.yaml` - Cloud Build configuration with health monitoring
- `cloudbuild-image.yaml` - Build config for the custom Docker image
- `Dockerfile.cloudbuild` - Custom Docker image with Chrome dependencies
- `create-secrets.sh` - Script to create/update secrets interactively
- `scripts/sync-secrets-to-gcloud.sh` - Sync all secrets from .env to Google Cloud
- `scripts/pull-secrets.cjs` - Sync secrets from Google Cloud to .env (runs automatically before builds)
- `scripts/check-api-health.cjs` - API health monitoring and Discord notifications
- `API_HEALTH_MONITORING.md` - Complete guide for Discord notification setup
- `DEPLOYMENT_GUIDE.md` - This file
- `.gcloudignore` - Files to exclude from Cloud Build uploads (auto-created)

## Next Steps

1. Wait 5-10 minutes for IAM permissions to fully propagate
2. Run `gcloud builds submit --config cloudbuild.yaml .`
3. If successful, set up Cloud Scheduler for daily builds
4. Set up Discord notifications for API health monitoring (see `API_HEALTH_MONITORING.md`)
5. Test the health monitoring by checking `.cache/api-health-report.json` after a build
6. Commit the new files to git:
   ```bash
   git add cloudbuild.yaml create-secrets.sh scripts/ API_HEALTH_MONITORING.md DEPLOYMENT_GUIDE.md
   git commit -m "Add automated deployment with API health monitoring"
   git push
   ```

## Support

If you continue to have issues:
1. Check Cloud Build logs in the GCP Console
2. Check API health report: `cat .cache/api-health-report.json` (after a build)
3. Verify all secrets are populated: `gcloud secrets list`
4. Test secret access: `gcloud secrets versions access latest --secret=STEAM_API_KEY | head -c 20`
5. Check IAM permissions for both service accounts
6. Review Discord notifications if any APIs are failing

## Alternative: GitHub Actions

If Cloud Build continues to be problematic, consider GitHub Actions instead (see README for GitHub Actions setup).

---

Generated by Claude Code
