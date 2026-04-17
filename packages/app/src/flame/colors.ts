/**
 * Color Map system for fractal flames
 *
 * A ColorMap defines a palette of OkLab (a, b) color pairs
 * that can be applied to transform functions.
 *
 * The flame algorithm uses OkLab color space:
 * - L (lightness) comes from point density
 * - a (green-red axis, -1 to 1)
 * - b (blue-yellow axis, -1 to 1)
 *
 * Each transform has color: { x: a, y: b }
 */

import type { FlameDescriptor } from '@/flame/schema/flameSchema'

export type OkLabColor = {
  /** OkLab 'a' channel: -1 (green) to 1 (red) */
  a: number
  /** OkLab 'b' channel: -1 (blue) to 1 (yellow) */
  b: number
}

export type ColorMap = {
  id: string
  name: string
  description?: string
  /** Array of colors - applied cyclically to transforms */
  colors: OkLabColor[]
}

/** Built-in color map presets */
export const defaultColorMaps: ColorMap[] = [
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Grayscale - neutral tones',
    colors: [{ a: 0, b: 0 }],
  },
  {
    id: 'fire',
    name: 'Fire',
    description: 'Warm reds, oranges, yellows',
    colors: [
      { a: 0.3, b: 0.4 }, // orange
      { a: 0.5, b: 0.3 }, // red-orange
      { a: 0.45, b: 0.5 }, // gold
      { a: 0.6, b: 0.25 }, // deep red
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blues and cyans',
    colors: [
      { a: -0.2, b: -0.6 }, // deep blue
      { a: -0.3, b: -0.3 }, // cyan
      { a: -0.15, b: -0.5 }, // teal
      { a: -0.25, b: -0.7 }, // navy
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Greens and earth tones',
    colors: [
      { a: -0.5, b: 0.3 }, // green
      { a: -0.35, b: 0.45 }, // lime
      { a: -0.4, b: 0.2 }, // forest
      { a: -0.25, b: 0.35 }, // moss
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Purples, pinks, and magentas',
    colors: [
      { a: 0.2, b: -0.3 }, // purple
      { a: 0.35, b: -0.15 }, // magenta
      { a: 0.25, b: 0.1 }, // pink
      { a: 0.4, b: -0.2 }, // violet
    ],
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Browns, tans, and stone',
    colors: [
      { a: 0.1, b: 0.2 }, // tan
      { a: 0.15, b: 0.35 }, // brown
      { a: 0.2, b: 0.15 }, // rust
      { a: 0.05, b: 0.25 }, // sand
    ],
  },
  {
    id: 'ice',
    name: 'Ice',
    description: 'Cyan to white tints',
    colors: [
      { a: -0.2, b: -0.15 }, // white-blue
      { a: -0.3, b: -0.2 }, // ice cyan
      { a: -0.15, b: -0.1 }, // frost
      { a: -0.35, b: -0.25 }, // arctic blue
    ],
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    description: 'Full spectrum colors',
    colors: [
      { a: 0.2, b: 0.4 }, // orange
      { a: -0.4, b: 0.35 }, // green
      { a: -0.25, b: -0.55 }, // blue
      { a: 0.35, b: -0.25 }, // purple
      { a: 0.5, b: 0.25 }, // red
      { a: -0.1, b: 0.55 }, // yellow
    ],
  },
]

/** Lookup map for quick access by ID */
export const colorMapsById: ReadonlyMap<string, ColorMap> = new Map(
  defaultColorMaps.map((cm) => [cm.id, cm]),
)

/**
 * Apply a color map to a flame descriptor
 * Colors are applied to transforms in order, cycling if needed
 */
export function applyColorMap(
  flame: FlameDescriptor,
  colorMap: ColorMap,
): FlameDescriptor {
  const transforms = Object.entries(flame.transforms)
  if (transforms.length === 0) return flame

  return {
    ...flame,
    transforms: Object.fromEntries(
      transforms.map(([id, transform], index) => [
        id,
        {
          ...transform,
          color: {
            x: colorMap.colors[index % colorMap.colors.length].a,
            y: colorMap.colors[index % colorMap.colors.length].b,
          },
        },
      ]),
    ),
  }
}

/**
 * Apply a color map by ID to a flame descriptor
 * Returns undefined if color map not found
 */
export function applyColorMapById(
  flame: FlameDescriptor,
  id: string,
): FlameDescriptor | undefined {
  const colorMap = colorMapsById.get(id)
  if (!colorMap) return undefined
  return applyColorMap(flame, colorMap)
}

/**
 * Get a CSS color string for an OkLab color
 * Uses a fixed lightness for preview
 */
export function oklabToCssPreview(color: OkLabColor, lightness = 0.7): string {
  return `oklab(${lightness} ${color.a} ${color.b})`
}
