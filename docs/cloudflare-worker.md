# Cloudflare Worker — Rich Link Previews for Shared Flames

This worker generates PNG preview images and dynamic Open Graph meta tags for shared Chaos Master flame URLs. It runs on the **Cloudflare free tier** — no cost, no persistent storage.

## What it does

| Route | Purpose |
|-------|---------|
| `GET /og/?flame=<encoded>` | Renders a 600×315 PNG preview (Canvas2D, no GPU) |
| `GET /?flame=<encoded>` | Serves `index.html` with `og:*` + `twitter:*` meta tags injected |
| `GET /` | Serves static `index.html` (Vercel SPA handles client-side) |

## How it works

1. When a URL with `?flame=<compressed-base64>` is shared on Discord, Twitter, etc., social crawlers fetch it
2. The worker decodes the flame data, renders it to PNG at 600×315, and returns it with proper `Content-Type` and cache headers
3. It also injects `og:title`, `og:description`, `og:image`, and `twitter:*` meta tags so the platform shows a rich preview card
4. **Caching**: In-memory `Map` with 24h TTL. Each unique flame renders once, then subsequent requests serve from cache. No KV or R2 needed.
5. **Cost**: $0 — stays well under the 100k req/day free tier limit

## Setup

### 1. Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed locally

### 2. Deploy the worker

```bash
cd packages/worker
pnpm install
wrangler login    # opens browser — authenticate with your Cloudflare account
wrangler deploy   # takes ~10s
```

On success, wrangler prints a URL like:
```
https://chaos-master-og.<your-subdomain>.workers.dev
```

### 3. Configure your domain (optional)

You can use the free `workers.dev` subdomain indefinitely. Or connect a custom domain:

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages** → your worker → **Triggers**
2. Click **Add Custom Domain**
3. Enter your subdomain, e.g. `og.chaos-matters.com`
4. Add the DNS record Cloudflare creates (usually a CNAME)

Take note of the worker domain — you'll need it for step 4.

### 4. Point your domain to the worker

If you want `og.example.com` to serve previews, add this DNS record:

```
og.example.com  CNAME  chaos-master-og.<your-subdomain>.workers.dev
```

Do this wherever you manage DNS (Vercel, Cloudflare, Namecheap, etc.).

### 5. Update the app to use the worker domain

Once your worker is deployed, update the `ShareLinkModal` to inject the correct `og:image` URL:

```bash
# In packages/app/src/components/ShareLinkModal/ShareLinkModal.tsx
# Update the og:image URL in your share modal or meta tag injection.
# The worker domain replaces any placeholder.
```

Alternatively, set the worker URL as an environment variable:

```bash
# In packages/app/.env
VITE_OG_WORKER_URL=https://og.example.com
```

And reference it in `ShareLinkModal.tsx`:
```ts
const ogImageUrl = `${import.meta.env.VITE_OG_WORKER_URL}/og/?flame=${encoded}`
```

## Testing

Use the official debuggers to verify your setup:

| Platform | Debugger |
|----------|---------|
| Facebook / Threads | https://developers.facebook.com/tools/debug/ |
| Twitter / X | https://cards.twitter.com/validator |
| LinkedIn | https://www.linkedin.com/post-inspector/ |
| Discord | Paste a URL in any channel — preview renders automatically |
| Slack | Paste a URL in any channel — preview renders automatically |

For a quick local test:
```bash
# Get a flame URL from the app (Share Link → copy)
# Then run:
curl -I "https://<your-worker-domain>/og/?flame=<the-encoded-param>"
# Should return Content-Type: image/png
```

## File reference

```
packages/worker/
├── wrangler.toml           # Worker config (name, compatibility date)
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # Fetch handler (3 routes)
    ├── types/
    │   └── flameDescriptor.ts   # Minimal FlameDescriptor type
    └── utils/
        ├── base64.ts            # base64url decode (mirrors app encoder)
        ├── jsonQueryParam.ts    # CompressionStream('deflate') decompress
        └── renderFlameToPng.ts  # Canvas2D IFS chaos-game renderer
```

## Troubleshooting

**Worker returns 400 on `/og/`**
→ The `?flame=` parameter is missing or malformed. Check the URL encoding matches the app's output.

**No image shows in Discord/Slack**
→ Some platforms cache previews aggressively. Use their debug tool to force a re-scrape.

**Render is slow (>10ms CPU)**
→ Reduce iterations in `renderFlameToPng.ts`. The default is 5000 — try 2000 for faster renders at the cost of detail.

**Worker URL changes after deploy**
→ Use a custom domain (step 3) so the URL stays stable.

## Performance

| Metric | Value |
|--------|-------|
| Canvas size | 600×315 (half of ideal 1200×630, scaled via `og:image:width/height`) |
| Iterations per render | 5000 chaos-game points |
| CPU per render | ~2–5ms on Cloudflare Workers (well under 10ms limit) |
| Cache TTL | 24 hours |
| Free tier limit | 100,000 requests/day |
