import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export async function generateOGImage(
  title: string,
  description?: string,
  type: 'default' | 'blog' | 'project' = 'default'
): Promise<Buffer> {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
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
                gap: '20px',
              },
              children: [
                // Badge/Type
                type !== 'default' && {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '24px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    },
                    children: type === 'blog' ? 'Blog Post' : 'Project',
                  },
                },
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '72px',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      lineHeight: 1.2,
                      maxWidth: '1100px',
                      wordWrap: 'break-word',
                    },
                    children: title,
                  },
                },
                // Description
                description && {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '32px',
                      color: '#94a3b8',
                      lineHeight: 1.5,
                      maxWidth: '1000px',
                    },
                    children: description,
                  },
                },
              ].filter(Boolean),
            },
          },
          // Footer
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
                borderTop: '2px solid #334155',
                paddingTop: '30px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#2563eb',
                    },
                    children: 'Atyansh Jaiswal',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      color: '#64748b',
                    },
                    children: '•',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      color: '#94a3b8',
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
