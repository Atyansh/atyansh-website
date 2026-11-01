import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

// Generated so the sitemap URLs follow siteConfig.url
export const GET: APIRoute = () => new Response(
  `User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.url}/sitemap-index.xml\nSitemap: ${siteConfig.url}/sitemap-0.xml\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
