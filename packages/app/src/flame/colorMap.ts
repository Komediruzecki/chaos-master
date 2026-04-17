/**
 * Color map system for fractal flames.
 *
 * A ColorMap defines how points are colored during flame iteration.
 * Each entry maps a color index (0-based) to OkLab a/b coordinates.
 * When a flame has N transforms, each transform gets a color from the map
 * based on its index. For example, with 3 transforms and a 3-entry map:
 *   transform 0 → map[0]
 *   transform 1 → map[1]
 *   transform 2 → map[2]
 *
 * If the flame has more transforms than the map, the last entry is reused.
 * Maps with fewer entries than transforms will cycle through their entries.
 */

export type ColorMapEntry = {
  /** OkLab 'a' channel (typically -1 to 1) */
  a: number
  /** OkLab 'b' channel (typically -1 to 1) */
  b: number
  /** Optional label for this color (e.g. "Warm Red", "Cool Blue") */
  label?: string
}

export type ColorMap = {
  id: string
  name: string
  /** Ordered list of OkLab a/b color entries */
  entries: ColorMapEntry[]
  /** Optional short description */
  description?: string
}

/** Helper to create a color entry */
export function colorEntry(
  a: number,
  b: number,
  label?: string,
): ColorMapEntry {
  return label !== undefined ? { a, b, label } : { a, b }
}

/** Helper to create a color map */
export function colorMap(
  id: string,
  name: string,
  entries: ColorMapEntry[],
  description?: string,
): ColorMap {
  return description !== undefined
    ? { id, name, entries, description }
    : { id, name, entries }
}

/**
 * Apply a color map to a flame's transforms.
 * Each transform gets the color at its index (wrapping around if needed).
 */
export function applyColorMapToFlame(
  flame: { transforms: Record<string, { color: { x: number; y: number } }> },
  colorMap: ColorMap,
): void {
  const keys = Object.keys(flame.transforms)
  keys.forEach((key, index) => {
    const entry = colorMap.entries[index % colorMap.entries.length]
    flame.transforms[key]!.color = { x: entry.a, y: entry.b }
  })
}

export const defaultColorMaps: ColorMap[] = [
  colorMap(
    'grayscale',
    'Grayscale',
    [colorEntry(0, 0, 'Neutral')],
    'Classic grayscale flame rendering',
  ),
  colorMap(
    'fire',
    'Fire',
    [
      colorEntry(-0.5, 0.1, 'Deep Red'),
      colorEntry(0.2, 0.5, 'Orange'),
      colorEntry(0.6, 0.4, 'Yellow'),
    ],
    'Warm fire-like palette',
  ),
  colorMap(
    'ocean',
    'Ocean',
    [
      colorEntry(-0.3, -0.6, 'Deep Blue'),
      colorEntry(-0.1, -0.3, 'Teal'),
      colorEntry(0.2, 0.1, 'Aqua'),
      colorEntry(0.5, 0.2, 'Sea Green'),
    ],
    'Cool oceanic blues and teals',
  ),
  colorMap(
    'sunset',
    'Sunset',
    [
      colorEntry(0.5, 0.4, 'Pink'),
      colorEntry(0.6, 0.3, 'Orange'),
      colorEntry(0.7, 0.1, 'Amber'),
      colorEntry(-0.1, 0.5, 'Magenta'),
    ],
    'Warm sunset gradient',
  ),
  colorMap(
    'neon',
    'Neon',
    [
      colorEntry(0.8, 0.8, 'Magenta'),
      colorEntry(-0.6, 0.6, 'Cyan'),
      colorEntry(0.5, -0.6, 'Lime'),
      colorEntry(-0.8, -0.3, 'Violet'),
    ],
    'Vibrant neon colors',
  ),
  colorMap(
    'pastel',
    'Pastel',
    [
      colorEntry(0.2, 0.1, 'Blush'),
      colorEntry(-0.1, 0.2, 'Lavender'),
      colorEntry(0.1, -0.2, 'Mint'),
      colorEntry(0.3, 0.3, 'Peach'),
    ],
    'Soft pastel tones',
  ),
  colorMap(
    'earth',
    'Earth',
    [
      colorEntry(0.3, 0.4, 'Sienna'),
      colorEntry(0.5, 0.5, 'Ochre'),
      colorEntry(-0.2, 0.3, 'Olive'),
      colorEntry(0.1, 0.5, 'Rust'),
    ],
    'Natural earth tones',
  ),
  colorMap(
    'ice',
    'Ice',
    [
      colorEntry(-0.2, -0.3, 'Ice Blue'),
      colorEntry(-0.4, -0.1, 'Glacier'),
      colorEntry(0, -0.5, 'Arctic'),
      colorEntry(0.1, 0.1, 'Frost'),
    ],
    'Cold icy blues',
  ),
  colorMap(
    'rainbow',
    'Rainbow',
    [
      colorEntry(0.8, 0.6, 'Red'),
      colorEntry(0.7, 0.5, 'Orange'),
      colorEntry(0.5, 0.4, 'Yellow'),
      colorEntry(-0.3, 0.5, 'Green'),
      colorEntry(-0.6, 0.3, 'Cyan'),
      colorEntry(-0.8, 0.5, 'Blue'),
      colorEntry(-0.6, 0.7, 'Violet'),
    ],
    'Full rainbow spectrum',
  ),
  colorMap(
    'monochrome-blue',
    'Monochrome Blue',
    [
      colorEntry(-0.2, -0.4, 'Dark Blue'),
      colorEntry(-0.1, -0.3, 'Medium Blue'),
      colorEntry(0.1, -0.5, 'Cyan Blue'),
    ],
    'Blue channel variation',
  ),
]
