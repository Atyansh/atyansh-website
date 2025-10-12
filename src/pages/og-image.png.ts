import type { APIRoute } from 'astro';
import { generateOGImage } from '../utils/og-image';

export const GET: APIRoute = async ({ url }) => {
  const title = url.searchParams.get('title') || 'Atyansh Jaiswal';
  const description = url.searchParams.get('description') || 'Security & Privacy Engineer';
  const type = (url.searchParams.get('type') || 'default') as 'default' | 'blog' | 'project';

  try {
    const png = await generateOGImage(title, description, type);

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
