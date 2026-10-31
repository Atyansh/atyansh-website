import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://atyansh.com',
  integrations: [react(), mdx(), sitemap()],
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
