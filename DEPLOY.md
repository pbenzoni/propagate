# Deploying propagate

This is a static Astro site. Any host that can serve a `dist/` directory will work. Below are step-by-step instructions for the two targets the project is configured around: **Cloudflare Pages** and **Vercel**. Both are followed by notes on pointing the `propaganda.onl` domain at whichever one you pick.

Before you deploy, re-read the [README](README.md) and make sure you actually want to put this live. The noindex default is on in `.env.example` for a reason.

---

## Option A — Cloudflare Pages (recommended)

Cloudflare Pages builds well for Astro, has a generous free tier, and the domain-binding flow is straightforward if you already host DNS there.

### 1. Connect the repo

1. Push the repo to GitHub (or GitLab) if you haven't already.
2. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the `propagate` repository and the branch you want to deploy from (usually `main`).

### 2. Build settings

| Field                  | Value                 |
| ---------------------- | --------------------- |
| Framework preset       | Astro                 |
| Build command          | `npm run build`       |
| Build output directory | `dist`                |
| Root directory         | *(leave blank)*       |
| Node version           | `20`                  |

### 3. Environment variables

Add under **Settings → Environment variables** for the *Production* environment:

- `DEMO_NOINDEX` = `true` (flip to `false` only when you are ready for the site to be indexed)
- `ANTHROPIC_API_KEY` — **not strictly required for the build**, because the build only reads committed content. Only set it if you plan to also run ingest from Cloudflare (not recommended — use GitHub Actions for that).

### 4. Custom domain

1. In the Pages project go to **Custom domains → Set up a custom domain**.
2. Enter `propaganda.onl`.
3. If the DNS zone for `propaganda.onl` is already on Cloudflare, the CNAME is created for you automatically.
4. If it is not, Cloudflare will show you the exact DNS record to add at your registrar. Add it, wait for propagation, and come back to confirm.
5. Cloudflare handles TLS automatically.

Also add `www.propaganda.onl` if you want it; the project has no explicit redirect but Cloudflare Pages handles canonicalization.

### 5. Triggering rebuilds from the ingest pipeline

You do not need to do anything. The GitHub Action commits new article files back to the default branch, and Cloudflare Pages rebuilds automatically on every push to that branch. The architecture diagram in the README shows this loop.

---

## Option B — Vercel

Vercel's Astro support is equally good; the main difference is the dashboard.

### 1. Connect the repo

1. In the Vercel dashboard, **Add New → Project → Import Git Repository**.
2. Pick `propagate`.

### 2. Build settings

Vercel auto-detects Astro. Confirm the defaults:

| Field            | Value            |
| ---------------- | ---------------- |
| Framework Preset | Astro            |
| Build Command    | `npm run build`  |
| Output Directory | `dist`           |
| Install Command  | `npm ci`         |
| Node.js Version  | `20.x`           |

### 3. Environment variables

Under **Settings → Environment variables**, for the *Production* environment:

- `DEMO_NOINDEX` = `true`
- (Optionally) `ANTHROPIC_API_KEY` — again, only if you plan to run ingest from Vercel instead of GitHub Actions.

### 4. Custom domain

1. **Settings → Domains → Add**.
2. Enter `propaganda.onl`.
3. Vercel will show you the DNS records to add at your registrar:
   - For an apex domain (`propaganda.onl`), an `A` record pointing to `76.76.21.21`, **or** a `CNAME` at the registrar's flattening feature pointing to `cname.vercel-dns.com`.
   - For `www`, a `CNAME` pointing to `cname.vercel-dns.com`.
4. Add the records, wait for propagation, and Vercel will issue TLS automatically.

### 5. Rebuild trigger

Same as Cloudflare: the GitHub Action pushes new commits, Vercel picks them up and rebuilds.

---

## Pointing `propaganda.onl` at whichever host you pick

Whichever provider you use, the pattern is:

1. At your **domain registrar**, make sure the nameservers point to the DNS provider you want to use (Cloudflare, your registrar's DNS, wherever). If you use Cloudflare Pages, putting DNS on Cloudflare makes everything smoother.
2. At the **DNS provider**, add the records the host's custom-domain flow told you to add.
3. At the **hosting provider**, confirm the domain becomes "Active" or "Valid Configuration."
4. Visit `https://propaganda.onl` in a browser and confirm the demo banner is visible on the first paint.

If you see the site load *without* the yellow/black demo banner, stop and investigate. The banner is wired into `BaseLayout.astro` with no opt-out, so its absence means either a stale build or a tampered deploy.

---

## Manual one-off deploys

You can also ship a local build to any static host:

```bash
npm install
npm run build
# upload the contents of dist/ to your host
```

The site has no runtime server component, so any static host that serves `index.html` from subdirectories will work.

## Rolling back

Both Cloudflare Pages and Vercel keep a history of deployments and will let you promote a previous build from the dashboard. If you ever need to take the site down in a hurry, pausing the project in either dashboard is the fastest path.
