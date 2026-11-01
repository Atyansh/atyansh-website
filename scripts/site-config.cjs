/**
 * src/site.config.ts and src/integrations.ts for the CommonJS scripts.
 *
 * Node >= 22.18 runs TypeScript natively (type stripping) and can require()
 * ES modules, so the scripts read the very same registry as the site; the
 * two .ts files stick to syntax Node can strip for this reason.
 *
 * loadSiteModules() never throws: on an older Node it returns null and the
 * caller falls back to its pre-registry behaviour (e.g. the health check
 * checks every integration).
 */

const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

let cached;

/**
 * @returns {{ siteConfig: object, integrations: typeof import('../src/integrations.ts') } | null}
 */
function loadSiteModules({ log = console.log } = {}) {
  if (cached !== undefined) return cached;
  try {
    cached = {
      siteConfig: require(path.join(SRC, 'site.config.ts')).siteConfig,
      integrations: require(path.join(SRC, 'integrations.ts')),
    };
  } catch (error) {
    log(`⚠️  Could not load src/site.config.ts / src/integrations.ts (needs Node >= 22.18): ${error.message}`);
    cached = null;
  }
  return cached;
}

/** Whether the integration's toggle in site.config.ts is on (true if the config can't be loaded) */
function isToggledOn(id, modules = loadSiteModules()) {
  return modules ? modules.siteConfig.integrations[id] !== false : true;
}

module.exports = { loadSiteModules, isToggledOn };
