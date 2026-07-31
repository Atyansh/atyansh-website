#!/bin/bash

# Simple deployment script for atyansh.com
# Builds the site locally and deploys to Firebase Hosting
# (and, during the migration transition, also to the legacy GCS bucket)

set -e

echo "🚀 Starting deployment to atyansh.com..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found!"
  echo "Copy .env.example to .env and fill in your API keys."
  exit 1
fi

# Build the site
echo "📦 Building site..."
npm run build

if [ ! -d "dist" ]; then
  echo "❌ Error: dist/ directory not found after build!"
  exit 1
fi

echo "✅ Build complete!"
echo ""

# Deploy to Firebase Hosting
echo "🔥 Deploying to Firebase Hosting..."
npx firebase-tools deploy --only hosting --project personal-website-334502 --non-interactive

# TRANSITION: legacy GCS deploy — atyansh.com serves from the GCS/LB path
# until the Firebase DNS cutover; remove everything below once cut over.
echo "☁️  Deploying to gs://atyansh.com/..."
# Use single process mode to avoid Python multiprocessing crash on macOS
export CLOUDSDK_PYTHON=python3
gsutil -o 'GSUtil:parallel_process_count=1' -m rsync -r -c -d dist/ gs://atyansh.com/

echo "✅ Files uploaded!"
echo ""

# Set cache headers for static assets (1 year)
echo "⚙️  Setting cache headers for static assets..."
gsutil -o 'GSUtil:parallel_process_count=1' -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "gs://atyansh.com/_astro/**" 2>/dev/null || echo "  (No _astro files found, skipping)"

# Set cache headers for HTML files (1 hour)
echo "⚙️  Setting cache headers for HTML files..."
gsutil -o 'GSUtil:parallel_process_count=1' -m setmeta -h "Cache-Control:public, max-age=3600" \
  "gs://atyansh.com/**/*.html" 2>/dev/null || echo "  (No HTML files found in subdirs)"

gsutil -o 'GSUtil:parallel_process_count=1' setmeta -h "Cache-Control:public, max-age=3600" \
  "gs://atyansh.com/index.html" 2>/dev/null || echo "  (No index.html found)"

echo "✅ Cache headers set!"
echo ""

# Show deployed files
echo "📊 Deployment summary:"
echo "Total files in bucket:"
gsutil du -sh gs://atyansh.com/
echo ""

echo "🎉 Deployment complete!"
echo "🌐 Your site is live at: https://atyansh.com"
echo ""
echo "Note: It may take a few minutes for changes to propagate globally."
