/**
 * Render a FlameDescriptor to a PNG using Canvas2D.
 * No WebGPU needed — this runs in a Cloudflare Worker.
 *
 * Performance target: < 10ms CPU on Cloudflare free tier.
 * Canvas size: 600×315 (half of ideal 1200×630, scales via og:image:width/height).
 * Iterations: 5000 — enough to see structure, well under CPU budget.
 *
 * Rendering approach: IFS point accumulation.
 * - Points orbit under the chaos game (random transform selection)
 * - Density accumulated per pixel → brightness
 * - Color from OkLab gradient based on accumulated color coordinates
 */

import type { FlameDescriptor } from '../types/flameDescriptor'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Point = { x: number; y: number }

// ---------------------------------------------------------------------------
// Variation functions — plain JS, no WGSL/tgpu
// All variations supported by the app are re-implemented here in simple math.
// ---------------------------------------------------------------------------

function applyVariation(
  type: string,
  point: Point,
  params: Record<string, number> = {},
): Point {
  switch (type) {
    case 'linear':
      return point

    case 'sinusoidal':
      return { x: Math.sin(point.x), y: Math.sin(point.y) }

    case 'spherical': {
      const r2 = point.x * point.x + point.y * point.y
      return { x: point.x / (r2 + 1e-9), y: point.y / (r2 + 1e-9) }
    }

    case 'swirl': {
      const r2 = point.x * point.x + point.y * point.y
      const s = Math.sin(r2)
      const c = Math.cos(r2)
      return { x: c * point.x - s * point.y, y: s * point.x + c * point.y }
    }

    case 'horseshoe': {
      const r = Math.sqrt(point.x * point.x + point.y * point.y) + 1e-9
      return { x: point.x / r, y: point.y / r }
    }

    case 'polar': {
      return {
        x: Math.atan2(point.y, point.x) / Math.PI,
        y: Math.sqrt(point.x * point.x + point.y * point.y),
      }
    }

    case 'handkerchief': {
      const angle = Math.atan2(point.y, point.x)
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      return { x: r * Math.sin(angle + r), y: r * Math.cos(angle - r) }
    }

    case 'heart': {
      const angle = Math.atan2(point.y, point.x)
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      return { x: r * Math.sin(angle * r), y: -r * Math.cos(angle * r) }
    }

    case 'disc': {
      const angle = Math.atan2(point.y, point.x) / (2 * Math.PI)
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      return { x: angle, y: r / Math.PI }
    }

    case 'exponential':
      return { x: Math.exp(point.x), y: point.y }

    case 'julia': {
      const cr = params['seedReal'] ?? 0
      const ci = params['seedImag'] ?? 0
      const zr = point.x * point.x - point.y * point.y + cr
      const zi = 2 * point.x * point.y + ci
      return { x: zr, y: zi }
    }

    case 'juliaScope': {
      const cr = params['seedReal'] ?? 0
      const ci = params['seedImag'] ?? 0
      const zr = point.x * point.x - point.y * point.y + cr
      const zi = 2 * point.x * point.y + ci
      return { x: Math.abs(zr), y: Math.abs(zi) }
    }

    case 'fan': {
      const angle = Math.atan2(point.y, point.x)
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      const split = (params['split'] ?? 1) * Math.PI
      const a = (angle % split) < split / 2 ? angle : angle - split
      return { x: r * Math.cos(a), y: r * Math.sin(a) }
    }

    case 'fan2': {
      const angle = Math.atan2(point.y, point.x)
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      const split = (params['split'] ?? 1) * Math.PI
      const dist = (angle % split) < split / 2 ? angle : angle - split
      return { x: r * Math.cos(dist), y: r * Math.sin(dist) }
    }

    case 'eyefish': {
      const r2 = point.x * point.x + point.y * point.y
      const d = 2 / (r2 / (4 * 4) + 1)
      return { x: point.x * d, y: point.y * d }
    }

    case 'bubble': {
      const r2 = point.x * point.x + point.y * point.y
      const d = 1 / (r2 / (4 * 4) + 1)
      return { x: point.x * d, y: point.y * d }
    }

    case 'cylinder': {
      return { x: Math.cos(point.x), y: point.y }
    }

    case 'noise': {
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      const noise = Math.sin(Math.floor(r * 10) * 1e4) * 0.5
      return { x: point.x + noise, y: point.y + noise }
    }

    case 'blur': {
      return {
        x: point.x + (Math.random() - 0.5) * 2,
        y: point.y + (Math.random() - 0.5) * 2,
      }
    }

    case 'gaussian': {
      // Box-Muller for gaussian noise
      const u1 = Math.random()
      const u2 = Math.random()
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
      return { x: point.x + z0 * 0.5, y: point.y + z1 * 0.5 }
    }

    default:
      return point
  }
}

// ---------------------------------------------------------------------------
// Affine transforms
// ---------------------------------------------------------------------------

function applyPreAffine(
  point: Point,
  a: number, b: number, c: number,
  d: number, e: number, f: number,
): Point {
  return { x: a * point.x + b * point.y + c, y: d * point.x + e * point.y + f }
}

function applyPostAffine(
  point: Point,
  a: number, b: number, c: number,
  d: number, e: number, f: number,
): Point {
  return { x: a * point.x + b * point.y + c, y: d * point.x + e * point.y + f }
}

// ---------------------------------------------------------------------------
// OkLab → sRGB color conversion (D65)
// ---------------------------------------------------------------------------

function oklabToSrgb(labA: number, labB: number): [number, number, number] {
  const L = 0.7 // fixed lightness for rendering

  // OkLab → XYZ (D65)
  const l_ = Math.cbrt(L + 0.16) / 1.16
  const a = labA * 0.2
  const bLab = labB * 0.2

  const l_3 = l_ * l_ * l_
  const fy = (l_3 + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - bLab / 200

  const x =
    fx > 0.20689 ? fx ** 3 : (116 * fx - 16) / 903.3
  const y =
    fy > 0.20689 ? l_3 : L / 903.3
  const z =
    fz > 0.20689 ? fz ** 3 : (116 * fz - 16) / 903.3

  // XYZ → linear sRGB
  let rLin = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  let gLin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
  let bLin = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z

  // Clamp to valid linear RGB range
  rLin = Math.max(0, Math.min(1, rLin))
  gLin = Math.max(0, Math.min(1, gLin))
  bLin = Math.max(0, Math.min(1, bLin))

  // Linear → sRGB gamma
  const toSrgb = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055

  return [
    Math.round(toSrgb(rLin) * 255),
    Math.round(toSrgb(gLin) * 255),
    Math.round(toSrgb(bLin) * 255),
  ]
}

// ---------------------------------------------------------------------------
// Color palette — rainbow gradient in OkLab space
// ---------------------------------------------------------------------------

const PALETTE: { labA: number; labB: number; r: number; g: number; b: number }[] = [
  { labA: -0.1, labB: -0.15, r: 50, g: 20, b: 200 },   // deep violet
  { labA: 0,    labB: 0,     r: 0,   g: 0,   b: 0   },   // black
  { labA: 0,    labB: -0.15, r: 20,  g: 40,  b: 120 },   // dark blue
  { labA: -0.05, labB: 0.05, r: 60,  g: 120, b: 220 },   // blue-cyan
  { labA: 0.05, labB: 0.1,   r: 100, g: 200, b: 150 },   // cyan-green
  { labA: 0.1,  labB: 0.1,   r: 180, g: 230, b: 80  },   // green-yellow
  { labA: 0.1,  labB: 0.1,   r: 255, g: 220, b: 60  },   // yellow
  { labA: 0.1,  labB: 0.08,  r: 255, g: 160, b: 40  },   // orange
  { labA: 0.1,  labB: 0.05,  r: 230, g: 60,  b: 40  },   // red-orange
  { labA: 0.1,  labB: 0.05,  r: 200, g: 30,  b: 80  },   // red-magenta
  { labA: 0.1,  labB: 0.1,   r: 150, g: 20,  b: 150 },   // magenta
  { labA: 0,    labB: 0.1,   r: 60,  g: 20,  b: 200 },   // violet
  { labA: -0.05, labB: -0.1, r: 30,  g: 10,  b: 100 },   // deep blue
]

function gradientColor(colorX: number, colorY: number): [number, number, number] {
  // Map accumulated OkLab color to a palette position (0 to palette.length-1)
  // atan2 gives angular position; normalize to 0-1
  const angle = Math.atan2(colorY, colorX)
  const t = ((angle / Math.PI) + 1) / 2  // 0 to 1
  const pos = t * (PALETTE.length - 1)
  const idx = Math.floor(pos)
  const frac = pos - idx
  const c0 = PALETTE[idx]!
  const c1 = PALETTE[Math.min(idx + 1, PALETTE.length - 1)]!

  const r = c0.r + (c1.r - c0.r) * frac
  const g = c0.g + (c1.g - c0.g) * frac
  const b = c0.b + (c1.b - c0.b) * frac
  return [Math.round(r), Math.round(g), Math.round(b)]
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export async function renderFlameToPng(
  flame: FlameDescriptor,
  width: number,
  height: number,
  iterations: number = 5000,
): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!

  // Background
  const bg = flame.renderSettings?.backgroundColor
  const bgR = bg ? Math.round(bg[0] * 255) : 0
  const bgG = bg ? Math.round(bg[1] * 255) : 0
  const bgB = bg ? Math.round(bg[2] * 255) : 0
  ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`
  ctx.fillRect(0, 0, width, height)

  const transforms = Object.values(flame.transforms)
  if (transforms.length === 0) {
    return canvasToPng(canvas)
  }

  const totalProb = transforms.reduce((sum, t) => sum + t.probability, 0)
  const exposureScale = Math.pow(2, flame.renderSettings?.exposure ?? 0.25)
  const vibrancy = flame.renderSettings?.vibrancy ?? 0.5
  const scale = Math.min(width, height) / 3.5

  const toCanvasX = (x: number) => width / 2 + x * scale
  const toCanvasY = (y: number) => height / 2 - y * scale

  // Accumulation buffers (flat typed arrays for speed)
  const density = new Float32Array(width * height)
  const colorAccX = new Float32Array(width * height)
  const colorAccY = new Float32Array(width * height)

  // Start from origin (or slight random offset)
  let cx = 0
  let cy = 0
  let accX = 0
  let accY = 0

  const skipIters = flame.renderSettings?.skipIters ?? 20
  const firstHitIdx = new Int32Array(width * height).fill(skipIters)
  let hitCount = 0

  for (let i = 0; i < iterations + skipIters; i++) {
    // Skip initial iterations to allow convergence
    if (i < skipIters) {
      // Still need to iterate to move the point cloud into the attractor
      const r = Math.random() * totalProb
      let cum = 0
      let tf = transforms[0]!
      for (const t of transforms) {
        cum += t.probability
        if (r < cum) { tf = t; break }
      }
      let pt = applyPreAffine(
        { x: cx, y: cy },
        tf.preAffine.a, tf.preAffine.b, tf.preAffine.c,
        tf.preAffine.d, tf.preAffine.e, tf.preAffine.f,
      )
      for (const [, v] of Object.entries(tf.variations)) {
        pt = applyVariation(v.type, pt, v.params ?? {})
      }
      pt = applyPostAffine(
        pt,
        tf.postAffine.a, tf.postAffine.b, tf.postAffine.c,
        tf.postAffine.d, tf.postAffine.e, tf.postAffine.f,
      )
      cx = pt.x
      cy = pt.y
      continue
    }

    // Weighted random transform selection (chaos game)
    const r = Math.random() * totalProb
    let cum = 0
    let tf = transforms[0]!
    for (const t of transforms) {
      cum += t.probability
      if (r < cum) { tf = t; break }
    }

    let pt = applyPreAffine(
      { x: cx, y: cy },
      tf.preAffine.a, tf.preAffine.b, tf.preAffine.c,
      tf.preAffine.d, tf.preAffine.e, tf.preAffine.f,
    )

    for (const [, v] of Object.entries(tf.variations)) {
      pt = applyVariation(v.type, pt, v.params ?? {})
    }

    pt = applyPostAffine(
      pt,
      tf.postAffine.a, tf.postAffine.b, tf.postAffine.c,
      tf.postAffine.d, tf.postAffine.e, tf.postAffine.f,
    )

    cx = pt.x
    cy = pt.y

    // Accumulate color
    accX += tf.color.x
    accY += tf.color.y

    const px = Math.round(toCanvasX(pt.x))
    const py = Math.round(toCanvasY(pt.y))

    if (px >= 0 && px < width && py >= 0 && py < height) {
      const idx = py * width + px
      const bufIdx = idx * 4

      density[idx]++
      colorAccX[idx] += accX
      colorAccY[idx] += accY
      hitCount++
    }
  }

  if (hitCount === 0) {
    return canvasToPng(canvas)
  }

  // Find max density for normalization
  let maxDensity = 0
  for (let i = 0; i < density.length; i++) {
    if (density[i] > maxDensity) maxDensity = density[i]
  }

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  const alphaScale = exposureScale * (0.4 + vibrancy * 0.6) * 255

  for (let i = 0; i < width * height; i++) {
    const d = density[i]
    if (d < 0.5) continue

    const density_ = Math.min(1, (d / maxDensity) * exposureScale)
    const alpha = Math.min(255, Math.round(density_ * alphaScale))

    const colorX = colorAccX[i] / d
    const colorY = colorAccY[i] / d

    const [r, g, b] = gradientColor(colorX, colorY)

    data[i * 4]     = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = alpha
  }

  ctx.putImageData(imageData, 0, 0)
  return canvasToPng(canvas)
}

function canvasToPng(canvas: OffscreenCanvas): Promise<Uint8Array> {
  return canvas
    .convertToBlob({ type: 'image/png' })
    .then((b: Blob) => b.arrayBuffer())
    .then((buf: ArrayBuffer) => new Uint8Array(buf))
}
