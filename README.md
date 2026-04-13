# propagate — The Propagate Post

**A research demonstration by the [Institute for Strategic Dialogue (ISD)](https://www.isdglobal.org/) of how cheaply and quickly a single person with an AI coding agent can stand up an automated, audience-targeted content-laundering pipeline. This is not a newspaper. It is a threat model with a deploy button.**

Live: [propaganda.onl](https://propaganda.onl) &nbsp;·&nbsp; Repo: [github.com/pbenzoni/propagate](https://github.com/pbenzoni/propagate)

---

## What this is

The Propagate Post is the companion artifact to an ISD conference talk on spinning up an information operation in roughly thirty minutes. Every three hours, a GitHub Action pulls the RT.com RSS feed, dedupes it, and for each new item calls the Anthropic API twice — once to rewrite the story for a US liberal audience, once for a US conservative audience. The two rewrites are attached to transparently fictional bylines (Headlines McVirtuesignal, Chadwick Freedomeagle, etc.), committed to the repo as Markdown files, and built into a static site.

The home page deliberately pairs the two rewrites side-by-side so readers can see the single-source → two-audiences pattern at work. Every article page shows a **Provenance** box with the original RT.com URL, the original headline, the fetch timestamp, the model, and the exact system prompt used to produce the rewrite.

## What this is *not*

- **Not journalism.** No human writes here.
- **Not commentary.** The fictional bylines are deliberately absurd; the parody is bipartisan and intentional.
- **Not a source to quote, screenshot, or share.** Every page says this loudly.
- **Not an endorsement of the framings it produces.** It is a demonstration of what is now trivially buildable with a single API key and a weekend.

## Threat model being demonstrated

For years, defenders have warned that cheap, general-purpose AI coding tools would collapse the cost of building targeted content-laundering operations. The remaining questions were practical: how fast, how cheap, how believable, and with how much technical skill. This repository is one concrete answer.

There is no novel tradecraft here. The components — a static site generator, a scheduled Action that polls a feed and calls an API, a content store, a deploy config — are all standard building blocks. That is the point. A motivated individual with a laptop and a small amount of API credit can stand the whole thing up in an afternoon. This demo makes that fact legible to policymakers, journalists, and platform trust & safety teams who need to *see* a working pipeline to reason about defense.

## Architecture

```
                    ┌──────────────────────────┐
                    │  GitHub Actions (cron)   │
                    │  every 3h + manual       │
                    └──────────┬───────────────┘
                               │
                               ▼
┌────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│  RT.com RSS    │───▶│  scripts/ingest.mjs  │───▶│ Anthropic API    │
│                │    │  fetch → dedupe      │    │ (claude-sonnet…) │
└────────────────┘    │  → readability       │    │  2 rewrites per  │
                      │  → rewrite × 2       │◀───│  item            │
                      │  → write .md         │    └──────────────────┘
                      └──────────┬───────────┘
                                 │ commit + push
                                 ▼
                      ┌──────────────────────┐
                      │  src/content/        │
                      │   articles/*.md      │
                      │  data/seen.json      │
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │  Astro static build  │
                      │   + Tailwind         │
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │ Cloudflare Pages /   │
                      │ Vercel → propaganda  │
                      │ .onl                 │
                      └──────────────────────┘
```

## Repo layout

```
propagate/
├── .github/workflows/ingest.yml   # cron pipeline
├── astro.config.mjs
├── tailwind.config.mjs
├── src/
│   ├── content/
│   │   ├── config.ts              # collection schemas
│   │   ├── articles/*.md          # seed + ingested articles
│   │   └── authors/*.md           # 8 fictional bylines
│   ├── layouts/BaseLayout.astro
│   ├── components/                # DemoBanner, Masthead, ProvenanceBox, …
│   ├── lib/prompts.mjs            # shared system prompts + hash
│   ├── pages/                     # home, articles, authors, about, sections
│   └── styles/global.css
├── scripts/ingest.mjs             # the pipeline
├── data/seen.json                 # dedupe ledger
└── DEPLOY.md                      # Cloudflare Pages + Vercel instructions
```

## Setup

```bash
git clone https://github.com/pbenzoni/propagate.git
cd propagate
npm install
cp .env.example .env
# edit .env to add your ANTHROPIC_API_KEY
npm run dev
```

### Required secrets

The only secret the pipeline needs is an Anthropic API key, exposed as `ANTHROPIC_API_KEY`.

- **Local dev**: put it in `.env` (see `.env.example`).
- **GitHub Actions**: add it as a repository secret named `ANTHROPIC_API_KEY` under *Settings → Secrets and variables → Actions*.

Optional variables (repo-level *Variables*, same settings page):

| Variable           | Default                          | Purpose                                    |
| ------------------ | -------------------------------- | ------------------------------------------ |
| `ANTHROPIC_MODEL`  | `claude-sonnet-4-5`              | Rewrite model                              |
| `SOURCE_RSS`       | `https://www.rt.com/rss/news/`   | Override the feed (useful for local tests) |
| `MAX_NEW_PER_RUN`  | `5`                              | Cap on new items processed per cron tick   |

## Running the ingest locally

```bash
npm run ingest
```

The script will fetch the feed, dedupe against `data/seen.json`, call the Anthropic API twice per new item, and write Markdown files to `src/content/articles/`. Commit the results yourself when running locally — the GitHub Action commits on your behalf when it runs in CI.

To test without burning API credit, point the script at a small local feed:

```bash
SOURCE_RSS=https://example.com/my-test-feed.xml MAX_NEW_PER_RUN=1 npm run ingest
```

## Adding or removing authors

Every file in `src/content/authors/*.md` is a byline. Each one has frontmatter for `name`, `section` (`liberal` or `conservative`), `beat`, `bio`, and an optional `avatar` (a DiceBear URL by default — **do not use real photos of real people**). The ingest pipeline picks a random author from the appropriate section for each generated article.

To add a byline:

1. Create a new file `src/content/authors/my-byline.md`.
2. Keep the name obviously fake. The whole roster is supposed to fail the straight-face test.
3. Keep the bio explicit about the fact that the persona is fictional and the articles are AI-rewritten.

To remove a byline, delete the file. Existing articles referencing it will show the raw slug until you also clean up their frontmatter.

## How the provenance system works

The site's core research claim is that *everything* is visible. Three things enforce this:

1. **`src/content/config.ts`** — The content schema makes `sourceUrl`, `sourceTitle`, `fetchedAt`, `model`, and `systemPromptHash` **required** on every article. An article without provenance will not type-check, will not build, and cannot ship.
2. **`src/components/ProvenanceBox.astro`** — Rendered on every article detail page. It is not wrapped in a flag. It pulls the exact system prompt from `src/lib/prompts.mjs`, the same file the ingest script uses, so what you see on the page is what was actually sent to the API.
3. **`scripts/ingest.mjs`** — Computes `systemPromptHash` from the prompt text, so if someone edits the prompt, the hash changes and old-vs-new articles are distinguishable by inspecting a single frontmatter field.

If you are auditing this site and the provenance box is missing on any page, the site is broken or has been tampered with.

## The noindex default

A fresh clone is noindex by default. `BaseLayout.astro` checks `DEMO_NOINDEX` and emits `<meta name="robots" content="noindex, nofollow">` unless the variable is explicitly set to `"false"`. `.env.example` sets it to `"true"`.

`robots.txt` still allows crawling, because part of the point of this project is to let researchers, defenders, and crawlers *find* it. The `noindex` default is a soft rail against accidental forks ending up in search indexes before anyone has thought about what they are doing.

## Responsible disclosure

Anyone forking this project, stripping the demo banner, removing the provenance box, renaming the authors to something plausible, and pointing the feed at a less-obvious source is doing something this project **exists to help defenders catch**. The mechanism is already cheap, already available, and already in use by hostile actors. Pretending otherwise does not protect anyone — publishing a labeled reference implementation does.

If you find this repo being forked in bad faith, please report it to the platform hosting the fork and, if you think it is worth our attention, open an issue here.

## License

TBD. Treat as source-available for research and defensive-tooling use. If you are not sure whether your use is in scope, ask first.

---

*This is a research demo. It is not a newspaper.*
