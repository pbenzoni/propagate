import { defineCollection, z } from 'astro:content';

const sectionEnum = z.enum(['liberal', 'conservative']);

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    dek: z.string().optional(),
    author: z.string(), // slug reference into authors collection
    section: sectionEnum,
    pubDate: z.coerce.date(),
    // Provenance — non-optional by design. Every article on this site must
    // carry full provenance so readers can trace it back to the original source.
    sourceUrl: z.string().url(),
    sourceTitle: z.string(),
    sourcePublishedAt: z.coerce.date().optional(),
    fetchedAt: z.coerce.date(),
    model: z.string(),
    systemPromptHash: z.string(),
    // Optional: draft flag just for seed content authoring
    draft: z.boolean().optional().default(false),
  }),
});

const authors = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    section: sectionEnum,
    beat: z.string(),
    bio: z.string(),
    avatar: z.string().url().optional(),
  }),
});

export const collections = { articles, authors };
