#!/bin/bash

# Script to invalidate Cloud CDN cache for specific paths
# Usage: ./scripts/invalidate-cache.sh [path]
# Examples:
#   ./scripts/invalidate-cache.sh /movies/index.html
#   ./scripts/invalidate-cache.sh "/*"  (invalidate all)

URL_MAP="atyansh-website"

if [ -z "$1" ]; then
  echo "Error: No path specified"
  echo "Usage: $0 <path>"
  echo "Examples:"
  echo "  $0 /movies/index.html"
  echo "  $0 '/*'  (invalidate all)"
  exit 1
fi

PATH_TO_INVALIDATE="$1"

echo "Invalidating cache for path: $PATH_TO_INVALIDATE"
gcloud compute url-maps invalidate-cdn-cache "$URL_MAP" \
  --path "$PATH_TO_INVALIDATE" \
  --async

echo ""
echo "Cache invalidation initiated. It may take 30-60 seconds to complete."
echo "You can check status at: https://console.cloud.google.com/net-services/cdn/list"
