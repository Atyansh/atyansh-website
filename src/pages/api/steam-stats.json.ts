import type { APIRoute } from 'astro';
import { getSteamStats } from '../../utils/steam';
import { createLogger } from '../../utils/logger';

const log = createLogger('SteamAPI');

export const GET: APIRoute = async () => {
  try {
    const stats = await getSteamStats();

    if (!stats) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Steam stats' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 1 day (86400 seconds)
      },
    });
  } catch (error) {
    log.error('Error in Steam stats API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
