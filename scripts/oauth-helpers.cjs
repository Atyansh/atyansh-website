/**
 * Shared helpers for OAuth token scripts
 */

/**
 * Load .env file (silent fail if dotenv not available)
 */
function loadEnv() {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available, that's fine
  }
}

/**
 * Validate required environment variables and exit with usage hint if missing
 */
function validateEnvVars(vars, usageHint) {
  const missing = vars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Error: Missing environment variables: ${missing.join(', ')}`);
    if (usageHint) console.error(`\n${usageHint}`);
    process.exit(1);
  }
}

/**
 * Open a URL in the default browser (cross-platform)
 */
function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

/**
 * Print token success output with box borders
 */
function printTokenSuccess(lines) {
  console.log('\n' + '━'.repeat(60));
  console.log('\nAdd these to your .env file:\n');
  for (const line of lines) {
    console.log(line);
  }
  console.log('\n' + '━'.repeat(60));
}

module.exports = { loadEnv, validateEnvVars, openBrowser, printTokenSuccess };
