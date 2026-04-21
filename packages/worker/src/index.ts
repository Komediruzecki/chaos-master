/**
 * Chaos Master — Cloudflare Worker for OG meta tags + image generation
 *
 * What it does:
 *   1. /og/  → Generates a PNG preview image from ?flame= param (Canvas2D, no GPU needed)
 *   2. /     → Injects dynamic og:title, og:description, og:image meta tags
 *              based on ?flame= param, so social crawlers see rich previews
 *
 * Cache: in-memory Map with 24h TTL. Each unique flame URL renders once, then
 * is served from cache until stale. Under free tier (100k req/day) this is fine
 * — worst case 100k unique flames/day, which is very unlikely for a hobby app.
 *
 * PNG is rendered at 600×315 (half of the ideal 1200×630) to stay well under
 * the 10ms CPU limit on the Cloudflare free tier.
 */

import { decodeBase64url } from './utils/base64'
import { decompressJsonQuery } from './utils/jsonQueryParam'
import { renderFlameToPng } from './utils/renderFlameToPng'
import type { FlameDescriptor } from './types/flameDescriptor'

// ---------------------------------------------------------------------------
// In-memory PNG cache with 24h TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { png: Uint8Array; createdAt: number }>()

function cacheKey(flameB64: string): string {
  return flameB64
}

function getCachedPng(flameB64: string): Uint8Array | null {
  const entry = cache.get(cacheKey(flameB64))
  if (!entry) return null
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(cacheKey(flameB64))
    return null
  }
  return entry.png
}

function setCachedPng(flameB64: string, png: Uint8Array): void {
  cache.set(cacheKey(flameB64), { png, createdAt: Date.now() })
}

// ---------------------------------------------------------------------------
// OG image endpoint — /og/?flame=...
// ---------------------------------------------------------------------------

async function handleOgRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const flameB64 = url.searchParams.get('flame')

  if (!flameB64) {
    return new Response('Missing ?flame= parameter', { status: 400 })
  }

  // Check cache first
  const cached = getCachedPng(flameB64)
  if (cached) {
    return new Response(cached as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // 24h, matches cache TTL
      },
    })
  }

  // Decode + decompress the flame descriptor
  let flame: FlameDescriptor
  try {
    const bytes = decodeBase64url(flameB64)
    const compressed = new Uint8Array(bytes)
    flame = await decompressJsonQuery(compressed)
  } catch {
    return new Response('Invalid flame data', { status: 400 })
  }

  // Render at 600×315 — half of ideal 1200×630, keeps CPU < 10ms on free tier
  const png = await renderFlameToPng(flame, 600, 315)

  // Cache for next request
  setCachedPng(flameB64, png)

  return new Response(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

// ---------------------------------------------------------------------------
// HTML page with dynamic OG meta tags — /?flame=...
// ---------------------------------------------------------------------------

function generateHtmlWithOgTags(flame: FlameDescriptor, flameB64: string): string {
  const title = flame.metadata?.author && flame.metadata.author !== 'unknown'
    ? `Flame by ${flame.metadata.author}`
    : 'Fractal Flame — Chaos Master'

  const transformCount = Object.keys(flame.transforms).length
  const description = `${transformCount} transform${transformCount === 1 ? '' : 's'} • Created with Chaos Master`

  const ogImageUrl = `/og/?flame=${encodeURIComponent(flameB64)}`
  const ogUrl = `/?flame=${encodeURIComponent(flameB64)}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <link rel="shortcut icon" type="image/ico" href="/src/assets/favicon.ico" />
    <title>${escapeHtml(title)}</title>

    <!-- Open Graph / Rich Link Preview tags -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(ogUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="600" />
    <meta property="og:image:height" content="315" />
    <meta property="og:site_name" content="Chaos Master" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="/src/index.tsx" type="module"></script>
  </body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Static index.html (no flame param) — forward to Vercel/deployed SPA
// ---------------------------------------------------------------------------

const STATIC_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <link rel="shortcut icon" type="image/ico" href="/src/assets/favicon.ico" />
    <title>Chaos Master</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="/src/index.tsx" type="module"></script>
  </body>
</html>`

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // OG image endpoint
    if (pathname === '/og/' || pathname.startsWith('/og/?')) {
      return handleOgRequest(request)
    }

    // Root path — check for ?flame= param
    if (pathname === '/' || pathname === '/index.html') {
      const flameB64 = url.searchParams.get('flame')

      if (flameB64) {
        try {
          const bytes = decodeBase64url(flameB64)
          const compressed = new Uint8Array(bytes)
          const flame = await decompressJsonQuery(compressed)
          return new Response(
            generateHtmlWithOgTags(flame, flameB64),
            {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300', // 5 min — flame data might change
              },
            },
          )
        } catch {
          // Invalid flame param — fall through to static index
        }
      }

      // No valid flame param — serve static index (Vercel SPA handles it client-side)
      return new Response(STATIC_INDEX_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // All other paths → 404 (this worker doesn't serve static assets —
    // those come from Vercel/CDN. In a monorepo setup you'd proxy those too.)
    return new Response('Not Found', { status: 404 })
  },
}
