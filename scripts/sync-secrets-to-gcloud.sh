#!/bin/bash

# Sync values from .env into the SITE_SECRETS secret in Google Cloud Secret Manager
# Usage: ./scripts/sync-secrets-to-gcloud.sh [SECRET_NAME ...] [--remove SECRET_NAME]
# Examples:
#   ./scripts/sync-secrets-to-gcloud.sh                       # Sync every key in .env
#   ./scripts/sync-secrets-to-gcloud.sh SPOTIFY_REFRESH_TOKEN # Sync one key
#   ./scripts/sync-secrets-to-gcloud.sh TMDB_ACCESS_TOKEN TMDB_ACCOUNT_OBJECT_ID TMDB_TV_LIST_ID
#   ./scripts/sync-secrets-to-gcloud.sh --remove TMDB_READ_TOKEN
#
# All credentials live in one JSON secret; see scripts/site-secrets.cjs.

set -e
cd "$(dirname "$0")/.."
exec node scripts/push-secrets.cjs "$@"
