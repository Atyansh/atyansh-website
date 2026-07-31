import { defineMiddleware } from 'astro:middleware';

const isDev = import.meta.env.DEV;

// Static headers - hoisted to module scope since import.meta.env.DEV is a compile-time constant
const permissionsPolicy = 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://gc.zgo.at", // Astro needs unsafe-inline for hydration; gc.zgo.at is GoatCounter's count.js
  "style-src 'self' 'unsafe-inline'",  // Tailwind needs unsafe-inline
  "img-src 'self' data: https:",
  "font-src 'self'",
  "media-src 'self' blob: https://assets.plastick.rocks", // Allow Kaya climbing videos (blob: for fetched videos)
  `connect-src 'self' https://assets.plastick.rocks https://atyansh.goatcounter.com${isDev ? ' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* wss://*.ngrok-free.app wss://*.ngrok.io https://*.ngrok-free.app https://*.ngrok.io' : ''}`, // Allow HMR in dev (including ngrok) + Kaya videos + GoatCounter pings
  `frame-src${isDev ? ' http://localhost:* http://127.0.0.1:* https://*.ngrok-free.app https://*.ngrok.io' : ''} https://www.youtube.com https://www.youtube-nocookie.com`, // Allow YouTube embeds (and localhost/ngrok in dev)
  `frame-ancestors${isDev ? " 'self'" : " 'none'"}`, // Allow self-framing in dev for View Transitions
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Security headers - more permissive in development
  if (!isDev) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', permissionsPolicy);
  response.headers.set('Content-Security-Policy', csp);

  // HSTS - Force HTTPS (omit preload until CDN-level HSTS is configured)
  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
});
