# Contributing to propagate

First, the important part: **this project is a research demonstration of an attack pattern, not a functional product.** Before opening a PR, please read [README.md](README.md) and [/about](src/pages/about.astro) so your changes land in the right frame.

## Things we welcome

- Bug fixes in the build, the ingest pipeline, or the site layout.
- Improvements that make the research framing *more* visible — clearer banners, stronger provenance boxes, better copy on `/about`, additional noindex guards.
- Additional fictional bylines that pass the straight-face test (i.e., no one could mistake them for a real reporter).
- Documentation improvements, especially for defenders and trust & safety teams trying to read the code as a reference.
- Ports of the deploy instructions in `DEPLOY.md` to additional static hosts.

## Things we will not merge

- PRs that remove, hide, or flag-gate the top demo banner on any page.
- PRs that remove or flag-gate the provenance box on article detail pages.
- PRs that rename the fictional authors to plausible-sounding names.
- PRs that change the default of `DEMO_NOINDEX` to `false`.
- PRs that strip the guardrails (no fabricated quotes from real people, no naming real individuals in invented actions, no calls to action) from the system prompts in `src/lib/prompts.mjs`.
- PRs that point the ingest script at a source where the research framing would be unclear, or that make it harder to tell *this site* apart from a real outlet.
- Any PR whose effect, intentional or otherwise, is to make the output of this pipeline more plausible as real reporting.

These are not stylistic preferences. They are what makes this project a research demo instead of an actual disinformation operation. If you disagree with one of them, open an issue first and argue for the change before writing code — do not just file a PR.

## Development

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY if running ingest
npm run dev                 # Astro dev server
npm run build               # production build
npm run ingest              # run the pipeline once against the configured feed
```

Seed articles live in `src/content/articles/` and are distinguishable from generated ones by their `model: seed-human-authored` frontmatter field.

## Reporting misuse

If you see this repository, or a fork of it, being deployed in a way that removes the safety rails described above, please:

1. Report the deployment to whichever platform is hosting it (Cloudflare, Vercel, GitHub Pages, etc.) — most have abuse channels.
2. Open an issue on this repository with the URL.
3. If it is operationally sensitive, contact ISD directly through the channels on [isdglobal.org](https://www.isdglobal.org/).

## Code of conduct

Treat this space the way you would treat any serious research project on a sensitive topic. Disagreements about scope, framing, and safety are welcome. Bad-faith participation is not.
