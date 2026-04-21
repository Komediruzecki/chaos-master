/**
 * Minimal FlameDescriptor type for the Cloudflare Worker.
 * Must be compatible with the schema used by the main app (packages/app/src/flame/schema/flameSchema.ts).
 * Only includes the fields needed for OG image rendering + meta tag generation.
 */

// ---------------------------------------------------------------------------
// Affine transform params
// ---------------------------------------------------------------------------

export interface AffineParams {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

// ---------------------------------------------------------------------------
// Variation descriptor (simplified)
// ---------------------------------------------------------------------------

export interface VariationDescriptor {
  type: string
  weight: number
  // Parametric variations have params: Record<string, number>
  params?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Transform function (one transform = one "flame layer")
// ---------------------------------------------------------------------------

export interface TransformFunction {
  probability: number
  preAffine: AffineParams
  postAffine: AffineParams
  color: { x: number; y: number }
  variations: Record<string, VariationDescriptor>
}

// ---------------------------------------------------------------------------
// Render settings (camera, exposure, etc.)
// ---------------------------------------------------------------------------

export interface RenderSettings {
  exposure: number
  skipIters: number
  vibrancy?: number
  drawMode: 'light' | 'paint'
  backgroundColor?: [number, number, number]
  camera: {
    zoom: number
    position: [number, number]
  }
  colorInitMode: string
}

// ---------------------------------------------------------------------------
// Flame descriptor (top-level object stored in ?flame= URL)
// ---------------------------------------------------------------------------

export interface FlameDescriptor {
  version?: string
  metadata?: {
    author?: string
  }
  renderSettings?: RenderSettings
  transforms: Record<string, TransformFunction>
}
