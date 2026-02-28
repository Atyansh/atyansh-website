import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

let cachedProfileSrc: string | null = null;
let cachedFonts: ArrayBuffer[] | null = null;

async function getProfileImage(): Promise<string> {
  if (cachedProfileSrc) return cachedProfileSrc;
  const res = await fetch('https://www.gravatar.com/avatar/7e16fc57778ed552f69eb809ce567b38?s=512');
  const buf = await res.arrayBuffer();
  cachedProfileSrc = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  return cachedProfileSrc;
}

async function getFonts(): Promise<ArrayBuffer[]> {
  if (cachedFonts) return cachedFonts;
  cachedFonts = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff').then(r => r.arrayBuffer()),
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-600-normal.woff').then(r => r.arrayBuffer()),
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff').then(r => r.arrayBuffer()),
  ]);
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
