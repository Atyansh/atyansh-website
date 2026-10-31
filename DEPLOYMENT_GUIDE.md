# Deployment Guide - Automated Daily Builds

## What We've Accomplished ✅

1. ✅ Updated and authenticated gcloud CLI
2. ✅ Set project to `personal-website-334502`
3. ✅ Enabled required APIs (Cloud Build, Secret Manager, Cloud Scheduler, Cloud Storage)
4. ✅ Created `cloudbuild.yaml` configuration
5. ✅ Stored every credential in Google Secret Manager — since October 2026 as one JSON secret, `SITE_SECRETS` (see [Secrets](#secrets-site_secrets))
6. ✅ Granted IAM permissions to Cloud Build service accounts
7. ✅ Hosting on Firebase Hosting since 2026-07-31 (the old `gs://atyansh.com` bucket and load balancer were removed)
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
| `roles/secretmanager.secretAccessor` | Read `SITE_SECRETS` during build |
| `roles/secretmanager.secretVersionManager` | Save auto-refreshed tokens (MAL, IGDB, PSN, Goodreads) and destroy old versions |

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

Cloud Build uses a custom Docker image (`gcr.io/personal-website-334502/node-puppeteer`) based on an exact Node.js 22 release (Debian bookworm) with Chrome/Puppeteer dependencies pre-installed. This eliminates the need to `apt-get install` ~25 packages on every build.

**When to rebuild the image:**
- Node.js security releases (newest v22: https://nodejs.org/dist/index.json) and major bumps
- Puppeteer upgrades that require new system dependencies
- Chrome dependency changes

**How to rebuild:** bump the Node version in `Dockerfile.cloudbuild` and `_DATE` in `cloudbuild-image.yaml`, then
```bash
gcloud builds submit --config=cloudbuild-image.yaml .
```
This pushes `:22` (moving) and `:22-YYYY-MM-DD` (immutable). `cloudbuild.yaml` pins the dated tag; update it only after the new image is pushed (see [Build image](#build-image)).

### Node.js Version Requirement

**IMPORTANT:** Cloud Build must use **Node.js 22** to match the local development environment.

The `psn-api` package (v2.15.0) requires Node.js >=20 and provides backwards-compatible function names on Node 22:
- `exchangeNpssoForCode` (older, still supported)
- `exchangeCodeForAccessToken` (older, still supported)

These function names work correctly on Node.js 22. The `cloudbuild.yaml` is configured to use the custom `node-puppeteer` image (dated `:22-YYYY-MM-DD` tag).

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

Check that the build service account has both Secret Manager roles at the project level:

```bash
gcloud projects get-iam-policy personal-website-334502 \
  --flatten=bindings \
  --filter="bindings.members:418072003908-compute@developer.gserviceaccount.com" \
  --format="value(bindings.role)"

# Should include:
# - roles/secretmanager.secretAccessor
# - roles/secretmanager.secretVersionManager
```

### Option 3: Re-grant Permissions

If either role is missing, re-run the two `add-iam-policy-binding` commands under [Service Account Permissions](#service-account-permissions). There are no per-secret bindings: everything lives in the single `SITE_SECRETS` secret, covered by the project-level roles.

### Option 4: Test Build Locally First

Build locally to verify everything works, then deploy through Cloud Build
(see [Deploying](#deploying)):

```bash
# Pull SITE_SECRETS into .env, refresh tokens, then build
npm run build:fresh

# Or build with the .env you already have (no secret sync, no token refresh)
npm run build

# Serve dist/ with firebase.json's headers (CSP etc.) applied
npx firebase serve --only hosting --port 5055
```

## Automated Builds

Two Cloud Build triggers run `cloudbuild.yaml` from `master` on GitHub:

| Trigger | Fires on |
|---|---|
| `refresh-website-push` | every push to `master` |
| `refresh-website-periodic` | the Cloud Scheduler job `refresh-website-periodic-schedule`, daily at 2 AM Pacific (`0 2 * * *`, `America/Los_Angeles`) |

Check them:

```bash
gcloud builds triggers list --project personal-website-334502
gcloud scheduler jobs list --location us-central1 --project personal-website-334502
```

To recreate them (connect the GitHub repo first at https://console.cloud.google.com/cloud-build/triggers/connect?project=personal-website-334502):

```bash
PROJECT_ID="personal-website-334502"

gcloud builds triggers create github \
  --name="refresh-website-push" \
  --repo-owner="Atyansh" --repo-name="atyansh-website" \
  --branch-pattern="^master$" \
  --build-config="cloudbuild.yaml"

gcloud builds triggers create manual \
  --name="refresh-website-periodic" \
  --repo="https://github.com/Atyansh/atyansh-website" \
  --repo-type=GITHUB \
  --branch="master" \
  --build-config="cloudbuild.yaml"

# Run the periodic trigger daily at 2 AM Pacific
TRIGGER_ID=$(gcloud builds triggers describe refresh-website-periodic --format='value(id)')
gcloud scheduler jobs create http refresh-website-periodic-schedule \
  --location=us-central1 \
  --schedule="0 2 * * *" \
  --time-zone="America/Los_Angeles" \
  --uri="https://cloudbuild.googleapis.com/v1/projects/$PROJECT_ID/triggers/$TRIGGER_ID:run" \
  --oauth-service-account-email="418072003908-compute@developer.gserviceaccount.com"
```

## Previewing a Branch

`cloudbuild-preview.yaml` is a production build (same image, secrets, token
refresh and real API data) deployed to a Firebase preview channel instead of
the live site. Use it to check a branch before merging:

```bash
# From a checkout of the branch
gcloud builds submit --config=cloudbuild-preview.yaml \
  --substitutions=_CHANNEL=my-branch --project personal-website-334502 .
```

The preview URL is printed at the end of the build log and expires after 7
days (`_EXPIRES`). A preview doesn't save the fallback cache or a snapshot,
and its health check only prints a report (no Discord DM). It does save
renewed tokens to `SITE_SECRETS`, like any build, so don't start one while a
production build is running.

## Deploying

Cloud Build is the only deploy path: push to `master`, or re-run the push
trigger without a new commit:

```bash
gcloud builds triggers run refresh-website-push --branch=master --project personal-website-334502
```

Each build runs, in order (`cloudbuild.yaml`):

1. `install-dependencies` (`npm ci`) and `restore-build-cache` (last build's data, the scrape fallback)
2. `build-site`: `scripts/refresh-tokens.cjs` (the build's only token refresh), then `npm run build`, in parallel with `test`: `vitest run` + `npm run typecheck` on a copy of the sources
3. `check-api-health` (Discord alerts), then `save-build-cache` / `save-daily-snapshot`
4. `deploy-to-firebase`, only if both `build-site` and `test` passed

Don't deploy from a laptop with `firebase deploy`: it ships whatever is in
your local `dist/` (including untracked files) and skips the tests and the
health check.

### Build image

Steps run in `gcr.io/personal-website-334502/node-puppeteer`, built from
`Dockerfile.cloudbuild` (Node pinned to an exact v22 release + Chrome's
shared libraries). `cloudbuild-image.yaml` tags each build twice: `:22`
(moving) and `:22-YYYY-MM-DD` (immutable). `cloudbuild.yaml` pins the dated
tag, so to roll the image forward: bump the Node version / `_DATE`, run
`gcloud builds submit --config=cloudbuild-image.yaml .`, and only then
update the tag in `cloudbuild.yaml`.

## Security Headers

Every response's headers come from `firebase.json` (the site is static, so
Astro middleware never runs in production):

- `Content-Security-Policy` (enforced). Two non-overlapping rules: one for
  the whole site except `/world`, one for `/world` and `/world/**`, which
  additionally allows `'wasm-unsafe-eval' 'unsafe-eval'` (WebAssembly physics
  with a wasm-bindgen `new Function` shim) and `blob:` workers/fetches. The
  site rule's regex spells out "not `/world`" because Firebase's RE2 regexes
  have no lookahead, and when two rules set the same header the winner isn't
  documented, so they must never overlap. `'unsafe-inline'` scripts are
  allowed (Astro inline/hoisted scripts and the theme init script; static
  headers can't carry per-build hashes).
- No third-party scripts: the site rule's `script-src` is `'self'` plus
  `'unsafe-inline'` (GoatCounter's count.js is self-hosted, and the /music
  player is a plain Spotify embed iframe, not Spotify's iFrame API, which
  would need `'unsafe-eval'`).
- Allowed third parties: Spotify embed frames (`open.spotify.com`), YouTube
  embeds, GoatCounter hits (`atyansh.goatcounter.com`), Kaya climbing videos
  (`assets.plastick.rocks`), and images from any `https:` origin.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (no
  preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` +
  `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`,
  and a `Permissions-Policy` that denies camera/mic/geolocation/etc. and
  allows autoplay/fullscreen/encrypted-media/picture-in-picture only for the
  Spotify and YouTube embeds.

When adding a new embed, script host or fetch target, update the CSP in
`firebase.json` and check every page with the local server
(`npx firebase serve --only hosting`), watching the browser console for
`Refused to ...` errors.

Cache: `/_astro/**` (hashed bundles) is immutable for a year; HTML (clean
URLs like `/music/`, and `*.html`) gets `max-age=3600`.

## Monitoring and Logs

### API Health Monitoring

The build automatically monitors every API integration and sends Discord notifications if any fail:

**Monitored APIs:**
- With API keys (self-healing): Spotify, MyAnimeList, IGDB, Goodreads (`GOODREADS_COOKIE`, re-signed in silently every build)
- With API keys (manual renewal): Steam, PSN, TMDB, Kaya login (`KAYA_REFRESH_TOKEN`)
- Web scraping/public APIs: Letterboxd, Nintendo (Exophase), Kaya (climbing)

**How it works:**
- Runs after every build (`scripts/check-api-health.cjs`)
- Validates cache files are fresh (<1 hour old)
- Checks that data was successfully fetched
- Sends a Discord DM via bot if any API fails
- Never fails the build (just notifies)
- If a scrape/API fails outright, the build serves the previous build's data (`.cache-fallback/`, restored from the Cloud Build staging bucket) so the page still renders — the alert still fires because no fresh cache file is written. Every source does this (`FileCache.fallback()`), and a source that only partly loaded (a failed Goodreads shelf, a failed MyAnimeList page, an empty Steam library) counts as failed rather than caching the partial result over the good copy
- Partial sources merge onto that previous data instead of failing: Letterboxd pages 2+ are Cloudflare-blocked from Cloud Build IPs, so blocked builds merge page 1 + the RSS feed onto the last full list (`lastFullScrape` records when all pages last loaded). A partial result with no previous data to merge onto is served but never cached, so it can't overwrite the good copy in the bucket
- Kaya ascents come from the logged-in `ascentsForUser` query (the public queries are capped at 200 results). If the login fails for any reason, the build falls back to the public queries fetched per grade, and the "Kaya (Logged-in)" check alerts with the reason

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

### Secrets (`SITE_SECRETS`)

Every credential lives in **one** Secret Manager secret, `SITE_SECRETS`: a flat JSON object of `KEY` → value. There are no per-key secrets, and `cloudbuild.yaml` has no `availableSecrets`/`secretEnv`. The shared logic is in `scripts/site-secrets.cjs`.

**How builds use it:**
- `scripts/refresh-tokens.cjs` reads `SITE_SECRETS` (Node SDK), refreshes MAL/IGDB/PSN/Goodreads, saves every renewed token in **one** write, and writes `.env.refresh` with every credential for the build step to source
- The build step then runs `npm run build`, which has no `prebuild` hook (the local secret pull + refresh is `npm run build:fresh`), so the refresh runs exactly once and any `postbuild` hook still runs
- `scripts/check-api-health.cjs` reads the Discord credentials from `SITE_SECRETS` itself, so alerts still go out if the refresh step failed

**Write safety (every write, from builds or local scripts):**
- Re-reads the latest version and applies only the keys that changed, so a concurrent writer (another build, a local sync) isn't reverted
- Validates before writing: every value a non-empty string, no existing key dropped unless removed explicitly, under 60 KB (Secret Manager's limit is 64 KiB)
- Keeps the newest 3 versions for rollback and **destroys** older ones (disabled versions still bill)

**Cost:** one secret with at most 3 versions fits in Secret Manager's 6 free active versions, so it's $0.

### Option 1: Sync from .env (Recommended)

After editing your `.env` file:

```bash
# Update every key SITE_SECRETS already has from .env
node scripts/push-secrets.cjs

# Update (or add) specific keys
node scripts/push-secrets.cjs SPOTIFY_REFRESH_TOKEN

# Remove a key
node scripts/push-secrets.cjs --remove TMDB_READ_TOKEN
```

This script:
- Reads values from `.env` with dotenv, so quoted values with spaces (like `GOODREADS_COOKIE`) work
- With no key names, only updates keys `SITE_SECRETS` already has — `.env` also holds local-only values (e.g. the 1-hour `PSN_ACCESS_TOKEN`) that must not be stored. Name a key to add it
- Writes only keys whose value changed, as a single new version
- Skips keys that aren't set in `.env`

**All keys in `SITE_SECRETS`:**
- Gaming: `STEAM_API_KEY`, `STEAM_ID`, `PSN_NPSSO`, `PSN_REFRESH_TOKEN`, `PSN_REFRESH_TOKEN_EXPIRES_AT`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `IGDB_ACCESS_TOKEN`, `EXOPHASE_USERNAME`
- Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`
- MyAnimeList: `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET`, `MAL_ACCESS_TOKEN`, `MAL_REFRESH_TOKEN`
- TV Shows: `TMDB_READ_TOKEN`, `TMDB_ACCESS_TOKEN`, `TMDB_ACCOUNT_OBJECT_ID`, `TMDB_TV_LIST_ID`
- Web Scraping: `LETTERBOXD_USERNAME`, `GOODREADS_USER_ID`, `KAYA_USERNAME`
- Kaya login: `KAYA_REFRESH_TOKEN` (from Firefox on a Mac; long-lived, not rotated by builds)
- Goodreads login: `GOODREADS_COOKIE` (whole Cookie header from a signed-in goodreads.com request; renewed and re-saved by every build, so it only needs re-pasting if the login is killed)
- Discord Notifications: `DISCORD_BOT_TOKEN`, `DISCORD_USER_ID`

### Pulling Secrets to Local .env

To sync `SITE_SECRETS` to your local `.env` file:

```bash
node scripts/pull-secrets.cjs
```

`npm run build:fresh` runs it (then `scripts/refresh-tokens.cjs`, then the build); plain `npm run build` doesn't touch `.env` or rotate any token, so local `.env` edits aren't overwritten. It uses the `gcloud` CLI you're signed in to, and keeps comments and local-only variables in `.env`.

**`SITE_SECRETS` is the single source of truth.** When tokens are auto-refreshed during a build (IGDB, MAL, PSN, Goodreads), they're saved back to `SITE_SECRETS`. Run `npm run build:fresh` (or `node scripts/pull-secrets.cjs`) to pick them up locally.

### Option 2: Read a Single Value

```bash
gcloud secrets versions access latest --secret=SITE_SECRETS | jq -r .STEAM_API_KEY
```

To change a value, edit `.env` and use Option 1 — don't hand-edit the JSON.

### Option 3: Roll Back a Bad Write

The newest 3 versions are kept. To restore an older one, re-add its payload as the latest version:

```bash
gcloud secrets versions list SITE_SECRETS
gcloud secrets versions access N --secret=SITE_SECRETS | gcloud secrets versions add SITE_SECRETS --data-file=-
```

## Cost Estimates

- Cloud Build: Free tier includes 120 build-minutes/day (should be enough)
- Secret Manager: $0 — one secret with ≤3 versions fits in the 6 free active versions; accesses are $0.03 per 10,000 (negligible)
- Firebase Hosting: $0/month at current traffic (10 GB/month free transfer)
- Cloud Scheduler: $0 (one job; 3 jobs per billing account are free)
- Cloud Storage: a few cents a month for the build-cache and snapshot archive in the Cloud Build bucket

**Estimated total: a few cents a month**

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
# Refreshes MAL, IGDB, PSN and Goodreads and saves them to SITE_SECRETS
node scripts/refresh-tokens.cjs
```

**Quick workflow:**
```bash
# 1. Run auto-refresh (updates SITE_SECRETS and .env automatically)
node scripts/refresh-tokens.cjs

# 2. Trigger a new build to verify
gcloud builds submit --config cloudbuild.yaml .
```

**Manual renewal (fallback if auto-refresh fails):**
- **Spotify**: Re-run `scripts/get-spotify-token.cjs`, update `.env`, then `node scripts/push-secrets.cjs SPOTIFY_REFRESH_TOKEN`
- **MyAnimeList**: Re-run `scripts/get-mal-token.cjs`, update `.env`, then `node scripts/push-secrets.cjs MAL_ACCESS_TOKEN MAL_REFRESH_TOKEN`
- **TMDB**: The v4 access token is long-lived and shouldn't expire. If revoked, re-run `node scripts/setup-tmdb.cjs`, then `node scripts/push-secrets.cjs TMDB_ACCESS_TOKEN TMDB_ACCOUNT_OBJECT_ID TMDB_TV_LIST_ID`
- **PSN**: Uses a refresh token (~10d) bootstrapped from the NPSSO. Only bootstrap when the refresh token expires or is revoked. To bootstrap: log out + log back in at playstation.com, visit https://ca.account.sony.com/api/v1/ssocookie to get a fresh NPSSO, update `.env`, then `node scripts/push-secrets.cjs PSN_NPSSO` — the next build will exchange it for a refresh token
- **IGDB**: Regenerate access token (expires every ~61 days), update `.env`, then `node scripts/push-secrets.cjs IGDB_ACCESS_TOKEN`

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
- HTML pages (clean URLs like `/music/`, plus `*.html`): 1 hour
- Security headers: see [Security Headers](#security-headers)

**Deploys:**
- Cloud Build runs `npx firebase-tools deploy --only hosting` (authenticated via the build service account's ADC)
- No manual deploys: re-run the build with `gcloud builds triggers run refresh-website-push --branch=master` instead (see [Deploying](#deploying))
- Preview URL: https://personal-website-334502.web.app (always serves the latest deploy)

**Cost:** hosting transfer has a 10 GB/month free allowance, then $0.15/GB. The site's real (domain-addressed) traffic is ~3.5 GB/month, so the expected bill is $0. Note that bare-IP scanner noise — which was ~60% of egress on the old load balancer — never reaches Firebase billing at all.

**Analytics:** Firebase Hosting has no per-request logs — the old load balancer's logs/metrics (user agents, countries, bytes per path) are gone after teardown; the Firebase console shows only aggregate storage/transfer. Human page-view analytics come from GoatCounter (cookieless, no consent banner; snippet in BaseLayout.astro with View Transitions support). Dashboard: https://atyansh.goatcounter.com (login required).

## Files Created

- `cloudbuild.yaml` - Cloud Build configuration with health monitoring
- `cloudbuild-image.yaml` - Build config for the custom Docker image
- `Dockerfile.cloudbuild` - Custom Docker image with Chrome dependencies
- `scripts/site-secrets.cjs` - Read/write the single `SITE_SECRETS` secret (merge, validation, version pruning)
- `scripts/push-secrets.cjs` - Push values from .env into `SITE_SECRETS`
- `scripts/pull-secrets.cjs` - Sync `SITE_SECRETS` to .env (run by `npm run build:fresh`)
- `scripts/check-api-health.cjs` - API health monitoring and Discord notifications
- `API_HEALTH_MONITORING.md` - Complete guide for Discord notification setup
- `DEPLOYMENT_GUIDE.md` - This file
- `.gcloudignore` - Not committed; `gcloud builds submit` generates one from `.gitignore` when it's absent

## Next Steps

1. Wait 5-10 minutes for IAM permissions to fully propagate
2. Run `gcloud builds submit --config cloudbuild.yaml .`
3. If successful, set up Cloud Scheduler for daily builds
4. Set up Discord notifications for API health monitoring (see `API_HEALTH_MONITORING.md`)
5. Test the health monitoring by checking `.cache/api-health-report.json` after a build
6. Commit the new files to git:
   ```bash
   git add cloudbuild.yaml scripts/ API_HEALTH_MONITORING.md DEPLOYMENT_GUIDE.md
   git commit -m "Add automated deployment with API health monitoring"
   git push
   ```

## Support

If you continue to have issues:
1. Check Cloud Build logs in the GCP Console
2. Check API health report: `cat .cache/api-health-report.json` (after a build)
3. Verify `SITE_SECRETS` has every key: `gcloud secrets versions access latest --secret=SITE_SECRETS | jq -r 'keys[]'`
4. Test secret access: `gcloud secrets versions access latest --secret=SITE_SECRETS | jq -r .STEAM_API_KEY | head -c 20`
5. Check the build service account's Secret Manager roles (see Option 2 above)
6. Review Discord notifications if any APIs are failing
