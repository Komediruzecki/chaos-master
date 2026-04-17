/**
 * Parser for flam3 palette XML files.
 *
 * Flam3 uses a specific XML format for palettes. This parser handles
 * the standard flam3-palettes.xml format and converts palettes to our
 * internal Palette format using OkLab color space.
 */

import { paletteEntry } from './colorMap'
import type { Palette } from './colorMap'

export type Flam3Palette = {
  name: string
  colors: { position: number; r: number; g: number; b: number }[]
}

/**
 * Parse a flam3 palette XML string and return the palettes.
 */
export function parseFlam3Palettes(xmlContent: string): Flam3Palette[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid XML format in palette file')
  }

  const palettes: Flam3Palette[] = []
  const paletteNodes = doc.querySelectorAll('palette')

  paletteNodes.forEach((node) => {
    const name = node.getAttribute('name') ?? 'Unnamed Palette'
    const colorNodes = node.querySelectorAll('color')

    if (colorNodes.length === 0) {
      palettes.push({ name, colors: [] })
      return
    }

    const colors: Flam3Palette['colors'] = []

    colorNodes.forEach((colorNode) => {
      const index = parseInt(colorNode.getAttribute('index') ?? '0', 10)
      const r = parseFloat(colorNode.getAttribute('red') ?? '0')
      const g = parseFloat(colorNode.getAttribute('green') ?? '0')
      const b = parseFloat(colorNode.getAttribute('blue') ?? '0')

      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        colors.push({
          position: index / 255, // Index is 0-255
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255),
        })
      }
    })

    // Sort by position
    colors.sort((a, b) => a.position - b.position)

    palettes.push({ name, colors })
  })

  return palettes
}

/**
 * Convert flam3 palette colors (RGB 0-255) to OkLab a/b coordinates.
 */
function rgbToOklab(r: number, g: number, b: number): { a: number; b: number } {
  // Normalize to 0-1
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  // RGB to linear RGB (sRGB gamma correction)
  const toLinear = (c: number) =>
    c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92

  const rLin = toLinear(rNorm)
  const gLin = toLinear(gNorm)
  const bLin = toLinear(bNorm)

  // Linear RGB to XYZ (D65)
  const x = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin
  const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.072175 * bLin
  const z = 0.0193339 * rLin + 0.119192 * gLin + 0.9503041 * bLin

  // XYZ to Lab (D65)
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883

  const f = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : (903.3 * t + 16) / 116

  const fx = f(x / xn)
  const fy = f(y / yn)
  const fz = f(z / zn)

  const a = 500 * (fx - fy)
  const bLab = 200 * (fy - fz)

  // Normalize to -1 to 1
  return { a: a / 100, b: bLab / 100 }
}

/**
 * Convert a Flam3Palette to our internal Palette format.
 */
export function flam3PaletteToPalette(flam3Palette: Flam3Palette): Palette {
  const entries = flam3Palette.colors.map((color) => {
    const { a, b } = rgbToOklab(color.r, color.g, color.b)
    return paletteEntry(color.position, a, b)
  })

  return {
    id: `imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: flam3Palette.name,
    entries,
    source: 'imported',
    createdAt: Date.now(),
  }
}

/**
 * Import palettes from a flam3 XML file.
 */
export async function importFlam3Palettes(file: File): Promise<Palette[]> {
  const content = await file.text()
  const flam3Palettes = parseFlam3Palettes(content)
  return flam3Palettes.map(flam3PaletteToPalette)
}

/**
 * Check if a file is a valid flam3 palette XML file.
 */
export function isFlam3PaletteFile(file: File): boolean {
  return (
    file.name.endsWith('.xml') ||
    file.type === 'text/xml' ||
    file.type === 'application/xml'
  )
}
