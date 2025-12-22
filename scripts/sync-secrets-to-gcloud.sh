#!/bin/bash

# Sync secrets from .env to Google Cloud Secret Manager
# Usage: ./scripts/sync-secrets-to-gcloud.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  Sync .env to Google Cloud Secret Manager"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# List of secrets to sync (must match variable names in .env and Secret Manager)
SECRETS=(
    "STEAM_API_KEY"
    "STEAM_ID"
    "PSN_NPSSO"
    "IGDB_CLIENT_ID"
    "IGDB_CLIENT_SECRET"
    "IGDB_ACCESS_TOKEN"
    "SPOTIFY_CLIENT_ID"
    "SPOTIFY_CLIENT_SECRET"
    "SPOTIFY_REFRESH_TOKEN"
    "LETTERBOXD_USERNAME"
    "MAL_CLIENT_ID"
    "MAL_CLIENT_SECRET"
    "MAL_ACCESS_TOKEN"
    "MAL_REFRESH_TOKEN"
    "GOODREADS_USER_ID"
    "NOTIFICATION_EMAIL"
    "SMTP_HOST"
    "SMTP_PORT"
    "SMTP_USER"
    "SMTP_PASS"
)

# Load .env file
export $(grep -v '^#' .env | xargs)

SUCCESS_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

for SECRET_NAME in "${SECRETS[@]}"; do
    # Get value from environment (loaded from .env)
    SECRET_VALUE="${!SECRET_NAME}"

    if [ -z "$SECRET_VALUE" ]; then
        echo -e "${YELLOW}⊘ Skipping $SECRET_NAME (not set in .env)${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi

    # Check if secret exists
    if gcloud secrets describe "$SECRET_NAME" &>/dev/null; then
        # Secret exists, add new version
        echo -n "Updating $SECRET_NAME... "
        if echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=- &>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}✗ Failed${NC}"
            ERROR_COUNT=$((ERROR_COUNT + 1))
        fi
    else
        # Secret doesn't exist, create it
        echo -n "Creating $SECRET_NAME... "
        if echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" --data-file=- &>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}✗ Failed${NC}"
            ERROR_COUNT=$((ERROR_COUNT + 1))
        fi
    fi
done

echo ""
echo "================================================"
echo "Summary:"
echo "  ${GREEN}✓ Updated: $SUCCESS_COUNT${NC}"
echo "  ${YELLOW}⊘ Skipped: $SKIP_COUNT${NC}"
echo "  ${RED}✗ Failed: $ERROR_COUNT${NC}"
echo "================================================"

if [ $ERROR_COUNT -gt 0 ]; then
    echo ""
    echo -e "${RED}Some secrets failed to update. Check the error messages above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ All secrets synced successfully!${NC}"
echo ""
echo "Note: Don't forget to grant IAM permissions if you created new secrets:"
echo "  gcloud secrets add-iam-policy-binding SECRET_NAME \\"
echo "    --member=\"serviceAccount:418072003908-compute@developer.gserviceaccount.com\" \\"
echo "    --role=\"roles/secretmanager.secretAccessor\""
