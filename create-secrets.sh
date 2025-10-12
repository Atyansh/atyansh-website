#!/bin/bash

# Script to create secrets in Google Secret Manager from .env file

set -e

echo "Creating secrets in Google Secret Manager..."
echo ""

# Read .env and create secrets
while IFS='=' read -r key value; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.* ]] && continue

  # Only process the secrets we need
  case "$key" in
    STEAM_API_KEY|STEAM_ID|PSN_NPSSO|IGDB_CLIENT_ID|IGDB_ACCESS_TOKEN|\
    SPOTIFY_CLIENT_ID|SPOTIFY_CLIENT_SECRET|SPOTIFY_REFRESH_TOKEN|\
    LETTERBOXD_USERNAME|MAL_CLIENT_ID|MAL_CLIENT_SECRET|\
    MAL_ACCESS_TOKEN|MAL_REFRESH_TOKEN|GOODREADS_USER_ID)
      echo "Creating secret: $key"

      # Try to create the secret
      if echo -n "$value" | gcloud secrets create "$key" --data-file=- --replication-policy=automatic 2>/dev/null; then
        echo "  ✓ Created $key"
      else
        # If it already exists, update it
        echo "  ℹ $key already exists, updating..."
        echo -n "$value" | gcloud secrets versions add "$key" --data-file=-
        echo "  ✓ Updated $key"
      fi
      echo ""
      ;;
  esac
done < .env

echo "All secrets have been created/updated successfully!"
