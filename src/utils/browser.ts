// Shared Puppeteer launch helper for the build-time scrapers (Letterboxd,
// Exophase). Hardened because the build container holds every credential:
//
// - Chrome gets a minimal environment (no API keys/tokens), not process.env.
// - Each page opened with browser.newPage() is locked to the site it first
//   navigates to: requests to that site (and its known asset CDNs) go
//   through, everything third-party (ads, trackers, analytics) is aborted,
//   and popups are closed. Scraped pages can't pull arbitrary third-party
//   script into the browser, and scrapes get faster as a bonus.
// - --no-sandbox only where Chrome can't sandbox itself: as root on Linux,
//   i.e. the Cloud Build container (build steps run as root, Chrome refuses
//   to start as root without --no-sandbox, and Docker's default seccomp
//   profile blocks the user namespaces the sandbox would need). Elsewhere
//   (local runs) the sandbox stays on. In Cloud Build the request allowlist
//   and minimal env are the compensating controls.

import type { Browser, HTTPRequest, Page } from 'puppeteer';

let stealthRegistered = false;

// Environment variables Chrome actually needs. Everything else (API keys,
// OAuth tokens, the SITE_SECRETS contents sourced from .env.refresh) stays out.
const CHROME_ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL',
  'TMPDIR', 'TMP', 'TEMP',
  'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME',
  'FONTCONFIG_PATH', 'FONTCONFIG_FILE',
  'DISPLAY', 'WAYLAND_DISPLAY',
];

export function minimalChromeEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CHROME_ENV_ALLOWLIST) {
    const value = env[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// Extra registrable domains a scraped site needs for its own assets.
// Letterboxd serves JS/CSS/fonts from s.ltrbxd.com and images from
// a.ltrbxd.com. Exophase's data is inline in the HTML (window.playerGames),
// so it needs nothing beyond exophase.com.
const SITE_COMPANIONS: Record<string, string[]> = {
  'letterboxd.com': ['ltrbxd.com'],
};

// Third-party hosts that are part of passing a bot check rather than
// tracking: Cloudflare's Turnstile / managed challenge widget. (The JS
// challenge itself is served first-party from /cdn-cgi/.)
const ALWAYS_ALLOWED_HOSTS = ['challenges.cloudflare.com'];

// Resource types never needed for scraping, even first-party.
const BLOCKED_RESOURCE_TYPES = new Set(['media']);

/**
 * Approximate registrable domain (eTLD+1): the last two labels, or three for
 * common two-level public suffixes like co.uk. Good enough for an allowlist
 * whose sites are known .com domains.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const twoLevel = tld.length === 2 && ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'].includes(sld);
  return labels.slice(twoLevel ? -3 : -2).join('.');
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Whether a request may proceed on a page locked to `site` (a registrable
 * domain, or null before the page's first navigation).
 */
export function isRequestAllowed(
  url: string,
  resourceType: string,
  site: string | null,
  extraAllowedHosts: string[] = [],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // data:/blob:/about: never leave the browser
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) return false;

  const host = parsed.hostname.toLowerCase();
  if (ALWAYS_ALLOWED_HOSTS.some(d => hostMatches(host, d))) return true;
  if (extraAllowedHosts.some(d => hostMatches(host, d))) return true;
  if (!site) return false;
  return [site, ...(SITE_COMPANIONS[site] ?? [])].some(d => hostMatches(host, d));
}

export interface PageRestrictionOptions {
  /** Additional hosts (and their subdomains) to allow on every page. */
  allowedHosts?: string[];
  /**
   * Log blocked request counts per host when the page closes.
   * Defaults to on when SCRAPER_BROWSER_DEBUG=1.
   */
  debug?: boolean;
}

/**
 * Lock a page to the site of its first top-level navigation: requests to
 * that site (+ companions) continue, everything else is aborted — including
 * a later top-level navigation (or redirect) to a different site.
 */
export async function restrictPageToSite(page: Page, options: PageRestrictionOptions = {}): Promise<void> {
  let site: string | null = null;
  const blocked = new Map<string, number>();
  const debug = options.debug ?? process.env.SCRAPER_BROWSER_DEBUG === '1';

  await page.setRequestInterception(true);
  page.on('request', (request: HTTPRequest) => {
    if (request.isInterceptResolutionHandled()) return;

    const url = request.url();
    if (site === null && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      try {
        site = registrableDomain(new URL(url).hostname);
      } catch {
        // unparsable URL: site stays unset and the request is aborted below
      }
    }

    if (isRequestAllowed(url, request.resourceType(), site, options.allowedHosts)) {
      request.continue().catch(() => {});
      return;
    }
    if (debug) {
      let host = url;
      try { host = new URL(url).hostname; } catch { /* keep raw url */ }
      blocked.set(host, (blocked.get(host) ?? 0) + 1);
    }
    request.abort('blockedbyclient').catch(() => {});
  });

  if (debug) {
    page.once('close', () => {
      const summary = [...blocked].map(([h, n]) => `${h} x${n}`).join(', ');
      console.log(`[browser] ${site ?? '(no site)'}: blocked ${summary || 'nothing'}`);
    });
  }
}

/**
 * Chrome can't use its sandbox as root on Linux (the Cloud Build container).
 * CHROME_NO_SANDBOX=1 forces it off elsewhere (e.g. a non-root container
 * without user namespaces).
 */
function needsNoSandbox(): boolean {
  if (process.env.CHROME_NO_SANDBOX === '1') return true;
  return process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0;
}

/**
 * Launch a headless browser with the puppeteer-extra stealth plugin.
 * Handles dynamic import, one-time plugin registration, and common launch args.
 *
 * Every page from browser.newPage() is passed through restrictPageToSite()
 * before it's returned; popups opened by scraped pages are closed.
 */
export async function launchStealthBrowser(
  extraArgs: string[] = [],
  options: PageRestrictionOptions = {},
): Promise<Browser> {
  const puppeteer = await import('puppeteer-extra');
  if (!stealthRegistered) {
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteer.default.use(StealthPlugin());
    stealthRegistered = true;
  }

  const sandboxArgs = needsNoSandbox() ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];

  const browser = await puppeteer.default.launch({
    headless: true,
    env: minimalChromeEnv(),
    args: [...sandboxArgs, ...extraArgs],
  });

  const ours = new WeakSet<Page>();
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async (...args: Parameters<Browser['newPage']>) => {
    const page = await originalNewPage(...args);
    ours.add(page);
    await restrictPageToSite(page, options);
    return page;
  };

  // Popups (window.open / target=_blank) aren't ours and aren't restricted
  browser.on('targetcreated', async (target) => {
    if (target.type() !== 'page' || !target.opener()) return;
    const page = await target.page().catch(() => null);
    if (page && !ours.has(page)) await page.close().catch(() => {});
  });

  return browser;
}
