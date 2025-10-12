import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings?: Heading[];
}

export default function TableOfContents({ headings = [] }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Auto-generate headings if not provided
    if (headings.length === 0) {
      const articleHeadings = document.querySelectorAll('article h2, article h3, article h4');
      const generatedHeadings: Heading[] = Array.from(articleHeadings).map((heading) => {
        const id = heading.id || heading.textContent?.toLowerCase().replace(/\s+/g, '-') || '';
        if (!heading.id) {
          heading.id = id;
        }
        return {
          id,
          text: heading.textContent || '',
          level: parseInt(heading.tagName[1]),
        };
      });
      headings = generatedHeadings;
    }

    // Intersection Observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState({}, '', `#${id}`);
    }
  };

  return (
    <motion.nav
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-8 p-6 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
        maxHeight: 'calc(100vh - 4rem)',
        overflowY: 'auto',
      }}
      aria-label="Table of contents"
    >
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Table of Contents
      </h2>
      <ul className="space-y-2">
        {headings.map(({ id, text, level }) => (
          <li
            key={id}
            style={{
              paddingLeft: `${(level - 2) * 1}rem`,
            }}
          >
            <a
              href={`#${id}`}
              onClick={(e) => handleClick(e, id)}
              className={`block py-1 text-sm transition-colors hover:underline ${
                activeId === id ? 'font-semibold' : ''
              }`}
              style={{
                color: activeId === id ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </motion.nav>
  );
}
