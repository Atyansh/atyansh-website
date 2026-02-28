// Shared Puppeteer launch helper with stealth plugin

let stealthRegistered = false;

/**
 * Launch a headless browser with puppeteer-extra stealth plugin.
 * Handles dynamic import, one-time plugin registration, and common launch args.
 */
export async function launchStealthBrowser(extraArgs: string[] = []) {
  const puppeteer = await import('puppeteer-extra');
  if (!stealthRegistered) {
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteer.default.use(StealthPlugin());
    stealthRegistered = true;
  }

  return puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      ...extraArgs,
    ],
  });
}
