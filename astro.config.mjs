import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://atyansh.com',
  integrations: [react(), mdx(), sitemap()],
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
