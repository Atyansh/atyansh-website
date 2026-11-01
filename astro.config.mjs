import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { loadEnv } from 'vite';
import { siteConfig } from './src/site.config.ts';
import { INTEGRATION_PAGES, enabledPages, disabledRoutes } from './src/integrations.ts';

/**
 * Generates the integration pages (src/integration-pages/) that are enabled:
 * toggle on in src/site.config.ts AND required env keys set (see
 * src/integrations.ts). A disabled one has no route at all, so no page, no
 * sitemap entry, and no data fetch. The env is read the way Astro reads it
 * for import.meta.env (.env files plus process.env), so the nav, which asks
 * the same registry at render time, always agrees with the routes.
 */
function integrationPages() {
  let disabled = [];
  return {
    name: 'site-integration-pages',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, logger }) => {
        const mode = command === 'dev' ? 'development' : 'production';
        const env = loadEnv(mode, process.cwd(), '');
        for (const page of enabledPages(env)) {
          injectRoute({ pattern: page.route, entrypoint: page.entrypoint, prerender: true });
        }
        disabled = disabledRoutes(env);
        if (disabled.length > 0 && command !== 'sync') {
          logger.info(`Integration pages not generated (disabled or missing env keys): ${disabled.join(', ')}`);
        }
      },
    },
    /** For the sitemap filter: whether `page` (an absolute URL) is a disabled integration page */
    isDisabledPage: (page) => {
      const path = new URL(page).pathname.replace(/\/$/, '');
      return disabled.includes(path) && INTEGRATION_PAGES.some(p => p.route === path);
    },
  };
}

const pages = integrationPages();

// https://astro.build/config
export default defineConfig({
  site: siteConfig.url,
  integrations: [
    react(),
    mdx(),
    pages,
    // Disabled pages have no route, so the sitemap can't list them anyway;
    // the filter keeps it that way if a page is ever added another way.
    sitemap({ filter: (page) => !pages.isDisabledPage(page) }),
  ],
  // Astro 7 defaults to 'jsx' whitespace rules, which drop the spaces
  // between inline elements and text that the markup relies on (e.g. an
  // icon followed by a label). Keep the Astro <=6 collapsing.
  compressHTML: true,
  // The dev server listens on localhost only. Network exposure is opt-in:
  // `npm run dev -- --host` binds 0.0.0.0 (phones on the LAN, or a tunnel
  // that can't reach the dev server via localhost).
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      langs: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'bash', 'html', 'css', 'json', 'yaml', 'sql'],
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Vite 8 minifies CSS with Lightning CSS, and Astro builds page CSS
      // with target 'esnext', which strips vendor prefixes Safari < 18 needs
      // (-webkit-backdrop-filter) and emits range media queries. Target the
      // browsers Vite 7 did ('baseline-widely-available' at the time).
      cssTarget: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    },
    server: {
      strictPort: false,
      // Host headers accepted besides localhost/IPs, so an ngrok tunnel
      // (`ngrok http 4321`) can reach the dev server.
      allowedHosts: ['.ngrok-free.app', '.ngrok.io', 'localhost'],
      // HMR through the tunnel's TLS port; when that socket can't connect
      // (plain localhost), Vite's client falls back to the dev server port.
      hmr: {
        protocol: 'wss',
        clientPort: 443
      }
    }
  }
});
