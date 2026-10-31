import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { promises as fs } from 'fs';
import path from 'path';

// The avatar and fonts are committed (src/assets/og) rather than fetched at
// build time: a failed fetch used to render a broken image, or ship the
// endpoint's error text as og-image.png. Builds run from the repo root.
const ASSET_DIR = path.join(process.cwd(), 'src', 'assets', 'og');

let cachedProfileSrc: string | null = null;
let cachedFonts: Buffer[] | null = null;

async function getProfileImage(): Promise<string> {
  if (cachedProfileSrc) return cachedProfileSrc;
  const buf = await fs.readFile(path.join(ASSET_DIR, 'avatar.png'));
  cachedProfileSrc = `data:image/png;base64,${buf.toString('base64')}`;
  return cachedProfileSrc;
}

async function getFonts(): Promise<Buffer[]> {
  if (cachedFonts) return cachedFonts;
  cachedFonts = await Promise.all(
    [400, 600, 700].map(weight => fs.readFile(path.join(ASSET_DIR, `inter-latin-${weight}-normal.woff`)))
  );
  return cachedFonts;
}

export async function generateOGImage(): Promise<Buffer> {
  const [profileImageSrc, fonts] = await Promise.all([
    getProfileImage(),
    getFonts(),
  ]);

  // satori uses a React-like virtual DOM format that TypeScript doesn't fully understand
  const svg = await satori(
    // @ts-expect-error satori accepts plain objects matching React element structure
    {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          padding: '60px',
          fontFamily: 'Inter, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '30px',
              },
              children: [
                // Profile image
                {
                  type: 'img',
                  props: {
                    src: profileImageSrc,
                    style: {
                      width: '192px',
                      height: '192px',
                      borderRadius: '9999px',
                      border: '6px solid #2563eb',
                    },
                  },
                },
                // Name
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '64px',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      textAlign: 'center',
                    },
                    children: 'Atyansh Jaiswal',
                  },
                },
                // Title/Role
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '36px',
                      fontWeight: 600,
                      color: '#2563eb',
                      textAlign: 'center',
                    },
                    children: 'Software Engineer',
                  },
                },
                // Website
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      color: '#94a3b8',
                      textAlign: 'center',
                      marginTop: '20px',
                    },
                    children: 'atyansh.com',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fonts[0], weight: 400, style: 'normal' as const },
        { name: 'Inter', data: fonts[1], weight: 600, style: 'normal' as const },
        { name: 'Inter', data: fonts[2], weight: 700, style: 'normal' as const },
      ],
    }
  );

  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  return pngData.asPng();
}
