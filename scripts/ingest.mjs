#!/usr/bin/env node
// Ingest pipeline for the Propagate research demo.
//
// 1. Fetch the RT.com RSS feed.
// 2. Dedupe against data/seen.json.
// 3. For each new item, optionally fetch the article page and extract the
//    main text with @mozilla/readability.
// 4. For each audience (liberal, conservative) call the Anthropic API with the
//    prompt from src/lib/prompts.ts and write a Markdown file to
//    src/content/articles/.
// 5. Update seen.json. The GitHub Action commits both the new article files
//    and the updated ledger back to the repo — full audit trail is a feature.
//
// This file lives inside a research demo. The guardrails baked into the
// prompt (no fabricated quotes from real people, no calls to action, no
// naming real individuals in invented actions) are load-bearing and should
// not be removed.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPTS, SYSTEM_PROMPT_HASHES } from '../src/lib/prompts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_RSS = process.env.SOURCE_RSS ?? 'https://www.rt.com/rss/news/';
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
const MAX_NEW_PER_RUN = Number(process.env.MAX_NEW_PER_RUN ?? 5);
const SEEN_PATH = path.join(ROOT, 'data', 'seen.json');
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
const AUTHORS_DIR = path.join(ROOT, 'src', 'content', 'authors');

// --- helpers ---------------------------------------------------------------

const slugify = (s) =>
  s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const todayYMD = (d = new Date()) =>
  d.toISOString().slice(0, 10);

async function loadSeen() {
  if (!existsSync(SEEN_PATH)) return { _description: '', seen: {} };
  const raw = await readFile(SEEN_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.seen) parsed.seen = {};
  return parsed;
}

async function saveSeen(ledger) {
  await writeFile(SEEN_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

async function listAuthorsBySection() {
  // The glob here is very small — just read the frontmatter manually.
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(AUTHORS_DIR);
  const bySection = { liberal: [], conservative: [] };
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const raw = await readFile(path.join(AUTHORS_DIR, f), 'utf8');
    const sectionMatch = raw.match(/^section:\s*(liberal|conservative)\s*$/m);
    if (!sectionMatch) continue;
    bySection[sectionMatch[1]].push(f.replace(/\.md$/, ''));
  }
  return bySection;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchArticleText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'propagate-research-demo/0.1 (+https://github.com/pbenzoni/propagate)' },
    });
    if (!res.ok) return '';
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    const text = parsed?.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch (e) {
    console.warn('readability fetch failed:', url, e.message);
    return '';
  }
}

function frontmatter(obj) {
  const esc = (v) => {
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    if (/[:#"'\n]/.test(s)) return JSON.stringify(s);
    return s;
  };
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${k}: ${esc(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function provenanceBlock({ model, sourceTitle, sourceUrl }) {
  return `\n\n---\n> **Provenance**: This article was automatically rewritten by ${model} from [${sourceTitle}](${sourceUrl}). It is part of a research demo and is not journalism.\n`;
}

// --- Anthropic call --------------------------------------------------------

async function rewriteForSection(anthropic, section, source) {
  const systemPrompt = SYSTEM_PROMPTS[section];
  const userContent = [
    `Original headline: ${source.title}`,
    `Original URL: ${source.link}`,
    source.contentSnippet ? `Original summary: ${source.contentSnippet}` : null,
    source.fullText ? `Original article text (truncated):\n${source.fullText}` : null,
  ].filter(Boolean).join('\n\n');

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = res.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('no text block in response');
  const raw = textBlock.text.trim();
  // The model is instructed to return strict JSON. Be defensive anyway.
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) throw new Error('no JSON object found in model output');
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  if (!parsed.headline || !parsed.body_markdown) {
    throw new Error('model output missing required fields');
  }
  return parsed;
}

// --- main ------------------------------------------------------------------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. See .env.example.');
    process.exit(1);
  }

  await mkdir(ARTICLES_DIR, { recursive: true });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const parser = new Parser();

  console.log(`[ingest] fetching ${SOURCE_RSS}`);
  const feed = await parser.parseURL(SOURCE_RSS);

  const ledger = await loadSeen();
  const authorsBySection = await listAuthorsBySection();
  if (!authorsBySection.liberal.length || !authorsBySection.conservative.length) {
    throw new Error('need at least one author per section in src/content/authors/');
  }

  const newItems = [];
  for (const item of feed.items) {
    const key = item.guid || item.link;
    if (!key) continue;
    if (ledger.seen[key]) continue;
    newItems.push(item);
    if (newItems.length >= MAX_NEW_PER_RUN) break;
  }

  console.log(`[ingest] ${newItems.length} new items`);
  let written = 0;

  for (const item of newItems) {
    const fetchedAt = new Date();
    const fullText = item.link ? await fetchArticleText(item.link) : '';
    const source = {
      title: item.title ?? '(untitled)',
      link: item.link ?? '',
      contentSnippet: item.contentSnippet ?? item.content ?? '',
      isoDate: item.isoDate,
      fullText,
    };

    for (const section of /** @type {const} */ (['liberal', 'conservative'])) {
      try {
        const rewrite = await rewriteForSection(anthropic, section, source);
        const author = pickRandom(authorsBySection[section]);
        const slug = `${todayYMD()}-${slugify(rewrite.headline)}-${section}`;
        const filename = path.join(ARTICLES_DIR, `${slug}.md`);

        const fm = frontmatter({
          title: rewrite.headline,
          dek: rewrite.dek ?? '',
          author,
          section,
          pubDate: fetchedAt,
          sourceUrl: source.link,
          sourceTitle: source.title,
          sourcePublishedAt: source.isoDate ? new Date(source.isoDate) : fetchedAt,
          fetchedAt,
          model: MODEL,
          systemPromptHash: SYSTEM_PROMPT_HASHES[section],
        });

        const body = rewrite.body_markdown + provenanceBlock({
          model: MODEL,
          sourceTitle: source.title,
          sourceUrl: source.link,
        });

        await writeFile(filename, `${fm}\n\n${body}\n`, 'utf8');
        console.log(`[ingest]  wrote ${path.basename(filename)}`);
        written++;
      } catch (e) {
        console.error(`[ingest] rewrite failed for ${section}:`, e.message);
      }
    }

    ledger.seen[item.guid || item.link] = {
      title: source.title,
      link: source.link,
      ingestedAt: fetchedAt.toISOString(),
    };
  }

  await saveSeen(ledger);
  console.log(`[ingest] done. ${written} article files written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
