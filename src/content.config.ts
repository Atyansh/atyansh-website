import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Canonical status type constants — single source of truth
export const ANIME_STATUSES = ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'] as const;
export type AnimeStatus = typeof ANIME_STATUSES[number];

export const BOOK_STATUSES = ['reading', 'finished', 'want-to-read'] as const;
export type BookStatus = typeof BOOK_STATUSES[number];

// Markdown/MDX entries in src/content/<name>/. Files starting with "_" are
// skipped (as the legacy collections did), and ids are the slugified file
// paths, so URLs stay the same as with the old `slug`.
const entries = (name: string) => glob({ pattern: '**/[^_]*.{md,mdx}', base: `./src/content/${name}` });

const blog = defineCollection({
  loader: entries('blog'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().optional().default(false),
    tags: z.array(z.string()).optional().default([]),
    image: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: entries('projects'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()).optional().default([]),
    links: z.object({
      github: z.url().optional(),
      demo: z.url().optional(),
      website: z.url().optional(),
    }).optional(),
    featured: z.boolean().optional().default(false),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

const papers = defineCollection({
  loader: entries('papers'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    authors: z.array(z.string()),
    publishedIn: z.string().optional(),
    pubDate: z.coerce.date(),
    links: z.object({
      pdf: z.string().optional(),
      doi: z.url().optional(),
      arxiv: z.url().optional(),
      github: z.url().optional(),
    }).optional(),
    tags: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
  }),
});

const pets = defineCollection({
  loader: entries('pets'),
  schema: z.object({
    name: z.string(),
    species: z.string(),
    breed: z.string().optional(),
    images: z.array(z.string()),
    birthday: z.coerce.date().optional(),
    story: z.string().optional(),
    favoriteThings: z.array(z.string()).optional().default([]),
  }),
});

const eulerProblems = defineCollection({
  loader: entries('eulerProblems'),
  schema: z.object({
    problemNumber: z.number(),
    title: z.string(),
    difficulty: z.number().optional(),
    solved: z.boolean().default(true),
    solutionLanguage: z.string().optional(),
    githubLink: z.url().optional(),
  }),
});

export const collections = {
  blog,
  projects,
  papers,
  pets,
  eulerProblems,
};
