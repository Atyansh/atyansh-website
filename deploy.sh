#!/bin/bash

# Simple deployment script for atyansh.com
# Builds the site locally and deploys to Firebase Hosting

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

echo "🎉 Deployment complete!"
echo "🌐 Your site is live at: https://atyansh.com"
echo ""
echo "Note: It may take a few minutes for changes to propagate globally."
