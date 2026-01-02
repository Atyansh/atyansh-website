#!/usr/bin/env node

/**
 * API Health Check Script
 *
 * Runs after the build to check which API integrations succeeded/failed.
 * Sends email notifications via SMTP if any APIs have expired credentials.
 *
 * Usage:
 *   node scripts/check-api-health.cjs
 *
 * Environment Variables (for email notifications):
 *   NOTIFICATION_EMAIL - Email address to send notifications to (required)
 *   SMTP_HOST - SMTP server host (default: smtp.gmail.com)
 *   SMTP_PORT - SMTP server port (default: 587)
 *   SMTP_USER - SMTP username (your Gmail address)
 *   SMTP_PASS - SMTP app password (not your regular Gmail password!)
 */

// Load .env file for local testing (Cloud Build uses Secret Manager)
try {
  require('dotenv').config();
} catch (error) {
  // dotenv not installed, skip (happens in Cloud Build)
}

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), '.cache');
const MAX_CACHE_AGE_HOURS = 1; // Only trust cache files created in the last hour (this build)

// API configuration
const APIs = [
  {
    name: 'Spotify',
    cacheFile: 'spotify-data.json',
    checkFn: (data) => data.recentlyPlayed && data.recentlyPlayed.length > 0,
    renewal: 'Auto-refreshes tokens. If still failing: run node scripts/get-spotify-token.cjs',
    requiresApiKey: true,
    selfHealing: true, // Uses refresh token to get new access token each build
  },
  {
    name: 'MyAnimeList',
    cacheFile: 'myanimelist-data.json',
    checkFn: (data) => data.anime && data.anime.length > 0,
    renewal: 'Auto-refreshes tokens. If still failing: run node scripts/get-mal-token.cjs',
    requiresApiKey: true,
    selfHealing: true, // Refresh token auto-persists to Secret Manager
  },
  {
    name: 'Steam',
    cacheFile: 'steam-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Check STEAM_API_KEY and STEAM_ID in Secret Manager',
    requiresApiKey: true,
    selfHealing: false, // API key doesn't expire
  },
  {
    name: 'PlayStation Network',
    cacheFile: 'psn-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Update PSN_NPSSO token in Secret Manager (expires every ~60 days, requires manual browser login)',
    requiresApiKey: true,
    selfHealing: false, // NPSSO requires manual browser authentication
  },
  {
    name: 'IGDB (Game Covers)',
    cacheFile: 'igdb-covers.json',
    checkFn: (data) => {
      // IGDB cache structure: { "platform:game": { url, timestamp }, ... }
      const keys = Object.keys(data);
      return keys.length > 0 && keys.some(key => data[key]?.url);
    },
    // IGDB cache doesn't have top-level timestamp, extract most recent from game entries
    getTimestamp: (data) => {
      const timestamps = Object.values(data)
        .filter(entry => entry && typeof entry === 'object' && entry.timestamp)
        .map(entry => entry.timestamp);
      return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    },
    renewal: 'Auto-refreshes tokens. If still failing: check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET',
    requiresApiKey: true,
    selfHealing: true, // Uses client credentials to auto-refresh and persist to Secret Manager
  },
  {
    name: 'Letterboxd',
    cacheFile: 'letterboxd-data.json',
    checkFn: (data) => data.movies && data.movies.length > 0,
    renewal: 'Check LETTERBOXD_USERNAME in Secret Manager (web scraping)',
    requiresApiKey: false,
  },
  {
    name: 'Goodreads',
    cacheFile: 'goodreads-data.json',
    checkFn: (data) => data.books && data.books.length > 0,
    renewal: 'Check GOODREADS_USER_ID in Secret Manager (web scraping)',
    requiresApiKey: false,
  },
  {
    name: 'Nintendo Switch',
    cacheFile: 'nintendo-data.json',
    checkFn: (data) => data.games && data.games.length > 0,
    renewal: 'Exophase scraping may have failed - check EXOPHASE_USERNAME in Secret Manager',
    requiresApiKey: false,
  },
  {
    name: 'Kaya (Climbing)',
    cacheFile: 'kaya-data.json',
    checkFn: (data) => data.pyramid && data.pyramid.length > 0,
    renewal: 'Check KAYA_USERNAME in .env (uses public GraphQL API)',
    requiresApiKey: false,
  },
  {
    name: 'Trakt (TV Shows)',
    cacheFile: 'trakt-data.json',
    checkFn: (data) => data.shows && data.shows.length > 0,
    renewal: 'Auto-refreshes tokens. If still failing: run node scripts/get-trakt-token.cjs',
    requiresApiKey: true,
    selfHealing: true,
  },
  {
    name: 'TMDB (TV Posters)',
    cacheFile: 'trakt-data.json', // TMDB data is embedded in Trakt cache
    checkFn: (data) => {
      // Check that at least some shows have poster images (TMDB working)
      if (!data.shows || data.shows.length === 0) return false;
      const showsWithPosters = data.shows.filter(s => s.posterImage && s.posterImage.length > 0);
      // At least 50% should have posters if TMDB is working
      return showsWithPosters.length >= data.shows.length * 0.5;
    },
    renewal: 'Check TMDB_API_KEY in Secret Manager (get key at themoviedb.org/settings/api)',
    requiresApiKey: true,
    selfHealing: false,
  },
];

/**
 * Check health of all APIs
 */
async function checkAPIHealth() {
  const results = {
    healthy: [],
    failed: [],
    timestamp: new Date().toISOString(),
  };

  console.log('🔍 Checking API health...\n');

  for (const api of APIs) {
    const cacheFilePath = path.join(CACHE_DIR, api.cacheFile);

    try {
      // Check if cache file exists
      if (!fs.existsSync(cacheFilePath)) {
        const reason = api.requiresApiKey
          ? 'Cache file not found - API credentials may be missing or expired'
          : 'Cache file not found - web scraping may have failed';

        results.failed.push({
          name: api.name,
          reason,
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`❌ ${api.name}: Cache file missing`);
        continue;
      }

      // Read and parse cache file
      const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
      const data = JSON.parse(cacheData);

      // Check cache timestamp - only trust fresh cache from this build
      // Use custom getTimestamp function if provided (for special cache structures like IGDB)
      const cacheTimestamp = api.getTimestamp ? api.getTimestamp(data) : (data.timestamp || 0);
      const cacheAge = Date.now() - cacheTimestamp;
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      if (cacheAgeHours > MAX_CACHE_AGE_HOURS) {
        results.failed.push({
          name: api.name,
          reason: `Cache is stale (${Math.round(cacheAgeHours)}h old) - API likely failed but old cache still exists`,
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`❌ ${api.name}: Cache too old (${Math.round(cacheAgeHours)}h)`);
        continue;
      }

      // Check if data is valid using the API-specific check function
      const isValid = api.checkFn(data);

      if (!isValid) {
        results.failed.push({
          name: api.name,
          reason: 'Cache exists but contains no data - API call may have failed',
          renewal: api.renewal,
          requiresApiKey: api.requiresApiKey,
          selfHealing: api.selfHealing || false,
        });
        console.log(`⚠️  ${api.name}: Empty data in cache`);
        continue;
      }

      // All checks passed - API is healthy
      results.healthy.push({
        name: api.name,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        cacheAgeMinutes: Math.round(cacheAge / (1000 * 60)),
        requiresApiKey: api.requiresApiKey,
        selfHealing: api.selfHealing || false,
      });
      console.log(`✅ ${api.name}: OK (${Math.round(cacheAge / (1000 * 60))}m old)`);

    } catch (error) {
      results.failed.push({
        name: api.name,
        reason: `Error reading cache: ${error.message}`,
        renewal: api.renewal,
        requiresApiKey: api.requiresApiKey,
        selfHealing: api.selfHealing || false,
      });
      console.log(`❌ ${api.name}: Error - ${error.message}`);
    }
  }

  return results;
}

/**
 * Generate text report
 */
function generateReport(results) {
  const total = results.healthy.length + results.failed.length;
  const healthPercentage = Math.round((results.healthy.length / total) * 100);

  let report = '';
  report += '═══════════════════════════════════════════════\n';
  report += '          API HEALTH REPORT\n';
  report += '═══════════════════════════════════════════════\n\n';
  report += `Generated: ${new Date(results.timestamp).toLocaleString('en-US')}\n`;
  report += `Health Score: ${results.healthy.length}/${total} APIs (${healthPercentage}%)\n\n`;

  if (results.failed.length > 0) {
    // Separate failures by urgency
    const manualInterventionNeeded = results.failed.filter(f => f.requiresApiKey && !f.selfHealing);
    const selfHealingFailed = results.failed.filter(f => f.requiresApiKey && f.selfHealing);
    const scrapingFailures = results.failed.filter(f => !f.requiresApiKey);

    if (manualInterventionNeeded.length > 0) {
      report += '🚨 ACTION REQUIRED (Manual Intervention):\n';
      report += '───────────────────────────────────────────────\n';
      manualInterventionNeeded.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }

    if (selfHealingFailed.length > 0) {
      report += '⚠️  SELF-HEALING FAILED (May need investigation):\n';
      report += '───────────────────────────────────────────────\n';
      selfHealingFailed.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }

    if (scrapingFailures.length > 0) {
      report += '❌ FAILED APIs (Web Scraping):\n';
      report += '───────────────────────────────────────────────\n';
      scrapingFailures.forEach((api) => {
        report += `\n• ${api.name}\n`;
        report += `  Reason: ${api.reason}\n`;
        report += `  Fix: ${api.renewal}\n`;
      });
      report += '\n';
    }
  }

  if (results.healthy.length > 0) {
    report += '✅ HEALTHY APIs:\n';
    report += '───────────────────────────────────────────────\n';
    results.healthy.forEach((api) => {
      let type = api.requiresApiKey ? 'API' : 'Scraping';
      if (api.selfHealing) type += ', Auto-refresh';
      report += `\n• ${api.name} (${type})\n`;
      report += `  Last updated: ${new Date(api.lastUpdated).toLocaleString('en-US')}\n`;
      report += `  Cache age: ${api.cacheAgeMinutes} minutes\n`;
    });
    report += '\n';
  }

  report += '═══════════════════════════════════════════════\n';

  return report;
}

/**
 * Send email notification using SMTP
 */
async function sendEmailNotification(results) {
  const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!NOTIFICATION_EMAIL) {
    console.log('⚠️  NOTIFICATION_EMAIL not configured, skipping email');
    return false;
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.log('⚠️  SMTP credentials not configured (need SMTP_USER and SMTP_PASS)');
    return false;
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    console.log('⚠️  nodemailer not installed, skipping email');
    console.log('   Install with: npm install nodemailer');
    return false;
  }

  const subject = results.failed.length > 0
    ? `⚠️ API Health Alert: ${results.failed.length} API(s) Failed`
    : `✅ All APIs Healthy`;

  const report = generateReport(results);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log(`📧 Sending email to ${NOTIFICATION_EMAIL}...`);

    await transporter.sendMail({
      from: `"Atyansh Website Monitor" <${SMTP_USER}>`,
      to: NOTIFICATION_EMAIL,
      subject: subject,
      text: report,
    });

    console.log(`✅ Email sent successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting API health check...\n');

  const results = await checkAPIHealth();
  const report = generateReport(results);

  console.log('\n' + report);

  // Save report to file
  const reportPath = path.join(CACHE_DIR, 'api-health-report.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  // Send email notification if any APIs failed
  if (results.failed.length > 0) {
    console.log('⚠️  Detected API failures, sending notification...\n');
    await sendEmailNotification(results);
  } else {
    console.log('✅ All APIs healthy, no notification needed\n');
  }

  // Don't fail the build - just notify
  process.exit(0);
}

main().catch((error) => {
  console.error('Error running health check:', error);
  process.exit(0);
});
