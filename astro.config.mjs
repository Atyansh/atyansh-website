import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://atyansh.com',
  integrations: [react(), mdx(), sitemap()],
  server: {
    host: true, // Allow access from local network
  },
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
      host: '0.0.0.0',
      strictPort: false,
      allowedHosts: ['.ngrok-free.app', '.ngrok.io', 'localhost'],
      hmr: {
        protocol: 'wss',
        clientPort: 443
      }
    }
  }
});