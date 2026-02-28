import { defineCollection, z } from 'astro:content';

// Canonical status type constants — single source of truth
export const ANIME_STATUSES = ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'] as const;
export type AnimeStatus = typeof ANIME_STATUSES[number];

export const BOOK_STATUSES = ['reading', 'finished', 'want-to-read'] as const;
export type BookStatus = typeof BOOK_STATUSES[number];

const blog = defineCollection({
  type: 'content',
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
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()).optional().default([]),
    links: z.object({
      github: z.string().url().optional(),
      demo: z.string().url().optional(),
      website: z.string().url().optional(),
    }).optional(),
    featured: z.boolean().optional().default(false),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

const papers = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    authors: z.array(z.string()),
    publishedIn: z.string().optional(),
    pubDate: z.coerce.date(),
    links: z.object({
      pdf: z.string().optional(),
      doi: z.string().url().optional(),
      arxiv: z.string().url().optional(),
      github: z.string().url().optional(),
    }).optional(),
    tags: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
  }),
});

const books = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    coverImage: z.string(),
    rating: z.number().min(1).max(5).optional(),
    status: z.enum(['reading', 'finished', 'want-to-read']).default('finished'),
    dateRead: z.coerce.date().optional(),
    thoughts: z.string().optional(),
    featured: z.boolean().optional().default(false),
  }),
});

const pets = defineCollection({
  type: 'content',
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
  type: 'content',
  schema: z.object({
    problemNumber: z.number(),
    title: z.string(),
    difficulty: z.number().optional(),
    solved: z.boolean().default(true),
    solutionLanguage: z.string().optional(),
    githubLink: z.string().url().optional(),
  }),
});

export const collections = {
  blog,
  projects,
  papers,
  books,
  pets,
  eulerProblems,
};
