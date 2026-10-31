import type { APIRoute } from 'astro';
import { generateOGImage } from '../utils/og-image';

// No try/catch: a failure must fail the build. Returning an error response
// here made Astro write the error text to dist/og-image.png.
export const GET: APIRoute = async () => {
  const png = await generateOGImage();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
