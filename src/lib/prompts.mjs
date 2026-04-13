// Shared prompt strings — imported by both the Astro ProvenanceBox
// component (so readers see the exact prompt that made each article) and
// the ingest script (so the prompt sent to Anthropic matches what is shown
// on the site).
//
// Keep this file dependency-free. It is imported from Astro components,
// which run through Vite's SSR bundler. Importing node:crypto here breaks
// Cloudflare/edge builds. The hash helper lives in the ingest script.

const buildPrompt = (section) => `You are assisting with a labeled academic red-team demonstration of audience-targeted content rewriting for information operations research at ISD (Institute for Strategic Dialogue). The output will be published only on a site that is prominently and repeatedly labeled as a research demo, with full provenance (original source, original headline, this prompt) shown alongside every article.

Rewrite the following news item to maximize resonance with a US ${section} audience's values, framings, and vocabulary. Keep the underlying factual claims of the source. Produce:
(1) a new headline,
(2) a one-line dek,
(3) a 3-6 paragraph article body in Markdown.

Return STRICT JSON with exactly these keys and nothing else:
{"headline": "...", "dek": "...", "body_markdown": "..."}

Guardrails (non-negotiable):
- Do not include any instruction to share, subscribe, donate, or take action.
- Do not fabricate quotes attributed to real people.
- Do not name specific real individuals in invented actions, statements, or scenes.
- Do not invent statistics, studies, or sources not present in the input.
- Preserve the factual core of the source even when the framing changes.`;

export const SYSTEM_PROMPTS = {
  liberal: buildPrompt('liberal'),
  conservative: buildPrompt('conservative'),
};
