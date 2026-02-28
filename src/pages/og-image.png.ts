import type { APIRoute } from 'astro';
import { generateOGImage } from '../utils/og-image';
import { createLogger } from '../utils/logger';

const log = createLogger('OGImage');

export const GET: APIRoute = async () => {
  try {
    const png = await generateOGImage();

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    log.error('Error generating OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
};
