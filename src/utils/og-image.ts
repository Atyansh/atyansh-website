import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export async function generateOGImage(): Promise<Buffer> {
  // Fetch profile image and convert to base64
  const profileImageUrl = 'https://www.gravatar.com/avatar/7e16fc57778ed552f69eb809ce567b38?s=512';
  const profileImageResponse = await fetch(profileImageUrl);
  const profileImageBuffer = await profileImageResponse.arrayBuffer();
  const base64Image = Buffer.from(profileImageBuffer).toString('base64');
  const profileImageSrc = `data:image/png;base64,${base64Image}`;

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
        {
          name: 'Inter',
          data: await fetch(
            'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff'
          ).then((res) => res.arrayBuffer()),
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch(
            'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-600-normal.woff'
          ).then((res) => res.arrayBuffer()),
          weight: 600,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch(
            'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff'
          ).then((res) => res.arrayBuffer()),
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  return pngData.asPng();
}
