# Deployment Guide - Automated Daily Builds

## What We've Accomplished ✅

1. ✅ Updated and authenticated gcloud CLI
2. ✅ Set project to `personal-website-334502`
3. ✅ Enabled required APIs (Cloud Build, Secret Manager, Cloud Scheduler, Cloud Storage)
4. ✅ Created `cloudbuild.yaml` configuration
5. ✅ Created 14 secrets in Google Secret Manager
6. ✅ Granted IAM permissions to Cloud Build service accounts
7. ✅ Configured Cloud Storage bucket (`gs://atyansh.com/`)
8. ✅ Updated Cloud Build to use Node.js 22 (matches local environment)
9. ✅ Granted Secret Manager access to Compute Engine service account
10. ✅ Successfully deployed site via Cloud Build

## Working Configuration

The site is now deployed and accessible at https://atyansh.com

## Key Configuration Details

### Service Account Permissions

**IMPORTANT:** Cloud Build uses the **Compute Engine default service account** for builds, NOT the Cloud Build service account. The correct service account is:

```
418072003908-compute@developer.gserviceaccount.com
```

This service account must have `roles/secretmanager.secretAccessor` permission to access secrets from Secret Manager.

**If you encounter permission errors**, grant the permission:
```bash
gcloud projects add-iam-policy-binding personal-website-334502 \
  --member="serviceAccount:418072003908-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Node.js Version Requirement

**IMPORTANT:** Cloud Build must use **Node.js 22** to match the local development environment.

The `psn-api` package (v2.15.0) requires Node.js >=20 and provides backwards-compatible function names on Node 22:
- `exchangeNpssoForCode` (older, still supported)
- `exchangeCodeForAccessToken` (older, still supported)

These function names work correctly on Node.js 22. The `cloudbuild.yaml` is configured to use `node:22` images.

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
for secret in STEAM_API_KEY STEAM_ID PSN_NPSSO IGDB_CLIENT_ID IGDB_ACCESS_TOKEN \
              SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET SPOTIFY_REFRESH_TOKEN \
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

# Deploy to Cloud Storage
gsutil -m rsync -r -c -d dist/ gs://atyansh.com/

# Set cache headers
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://atyansh.com/_astro/**"

gsutil -m setmeta -h "Cache-Control:public, max-age=3600" \
  "gs://atyansh.com/**/*.html"
```

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

### View Build History
```bash
gcloud builds list --limit=10
```

### View Specific Build Logs
```bash
BUILD_ID="your-build-id-here"
gcloud builds log $BUILD_ID
```

### View in Console
https://console.cloud.google.com/cloud-build/builds?project=personal-website-334502

## Updating Secrets

If you need to update any API keys:

```bash
# Update a secret
echo -n "new_value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Or use the script
./create-secrets.sh
```

## Cost Estimates

- Cloud Build: Free tier includes 120 build-minutes/day (should be enough)
- Secret Manager: $0.06 per 10,000 accesses (negligible for daily builds)
- Cloud Storage: ~$0.02/month for your site
- Cloud Scheduler: $0.10/month per job

**Estimated total: $0.15-0.20/month**

## Troubleshooting Common Issues

### Build Times Out
- Increase timeout in `cloudbuild.yaml` (currently 1800s = 30 min)
- Some API calls (especially Letterboxd scraping) can be slow

### API Rate Limits
- Add caching to API utility functions
- Reduce build frequency if hitting limits

### Secrets Expired
- Spotify: Re-run `scripts/get-spotify-token.cjs`
- MyAnimeList: Re-run `scripts/get-mal-token.cjs`
- PSN: Get new NPSSO token (expires every ~60 days)
- IGDB: Regenerate access token

### Build Succeeds but Site Not Updated
- Check if files were uploaded: `gsutil ls -lh gs://atyansh.com/ | head`
- Verify cache headers aren't too aggressive
- Clear browser cache or try incognito mode

## Cloud CDN Cache Management

Cloud CDN is enabled on the backend bucket to provide:
- ✅ Faster page loads globally (CDN edge locations)
- ✅ Manual cache invalidation capability
- ✅ Reduced load on Cloud Storage
- ✅ Better performance for international visitors

### Cache Configuration

**Current cache settings:**
- Static assets (`/_astro/**`): 1 year (immutable)
- HTML pages: 1 hour

### Manual Cache Invalidation

When you need to force a cache refresh (e.g., after updating movie data):

**Using the helper script:**
```bash
# Invalidate a specific page
./scripts/invalidate-cache.sh /movies/index.html

# Invalidate all HTML pages
./scripts/invalidate-cache.sh "/*.html"

# Invalidate everything
./scripts/invalidate-cache.sh "/*"
```

**Direct gcloud command:**
```bash
gcloud compute url-maps invalidate-cdn-cache atyansh-website \
  --path "/movies/index.html" \
  --async
```

**Note:** Cache invalidation takes 30-60 seconds to propagate globally.

### Cost Information

Cloud CDN pricing for a personal website:
- **Cache egress**: $0.02-0.08/GB (North America)
- **Cache invalidations**: First 1,000/month are FREE
- **Estimated cost**: $0.20-0.50/month for typical traffic

For 10,000 visitors/month × 250KB per page = ~2.5GB = **~$0.20/month**

## Files Created

- `cloudbuild.yaml` - Cloud Build configuration
- `create-secrets.sh` - Script to create/update secrets
- `scripts/invalidate-cache.sh` - Helper script for manual cache invalidation
- `DEPLOYMENT_GUIDE.md` - This file
- `.gcloudignore` - Files to exclude from Cloud Build uploads (auto-created)

## Next Steps

1. Wait 5-10 minutes for IAM permissions to fully propagate
2. Run `gcloud builds submit --config cloudbuild.yaml .`
3. If successful, set up Cloud Scheduler for daily builds
4. Update README.md to document the deployment process
5. Commit the new files to git:
   ```bash
   git add cloudbuild.yaml create-secrets.sh DEPLOYMENT_GUIDE.md
   git commit -m "Add automated deployment configuration"
   git push
   ```

## Support

If you continue to have issues:
1. Check Cloud Build logs in the GCP Console
2. Verify all secrets are populated: `gcloud secrets list`
3. Test secret access: `gcloud secrets versions access latest --secret=STEAM_API_KEY | head -c 20`
4. Check IAM permissions for both service accounts

## Alternative: GitHub Actions

If Cloud Build continues to be problematic, consider GitHub Actions instead (see README for GitHub Actions setup).

---

Generated by Claude Code
