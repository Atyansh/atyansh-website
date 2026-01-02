import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Check if we're in development mode
  const isDev = import.meta.env.DEV;

  // Security headers - more permissive in development
  if (!isDev) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Permissions Policy - restrict access to sensitive APIs
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  // Content Security Policy
  // More permissive in development, strict in production
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Astro needs unsafe-inline for hydration
    "style-src 'self' 'unsafe-inline'",  // Tailwind needs unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self'",
    "media-src 'self' blob: https://assets.plastick.rocks", // Allow Kaya climbing videos (blob: for fetched videos)
    `connect-src 'self' https://assets.plastick.rocks${isDev ? ' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* wss://*.ngrok-free.app wss://*.ngrok.io https://*.ngrok-free.app https://*.ngrok.io' : ''}`, // Allow HMR in dev (including ngrok) + Kaya videos
    `frame-src${isDev ? ' http://localhost:* http://127.0.0.1:* https://*.ngrok-free.app https://*.ngrok.io' : ''} https://www.youtube.com https://www.youtube-nocookie.com`, // Allow YouTube embeds (and localhost/ngrok in dev)
    `frame-ancestors${isDev ? " 'self'" : " 'none'"}`, // Allow self-framing in dev for View Transitions
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // HSTS - Force HTTPS (uncomment when deploying to production with HTTPS)
  // response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  return response;
});
