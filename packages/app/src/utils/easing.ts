import type { EasingCurve } from '@/flame/schema/timeline'

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function applyEasing(t: number, curve: EasingCurve): number {
  switch (curve) {
    case 'linear':
    case 'constant':
      return t
    case 'easeIn':
      return t * t * t
    case 'easeOut':
      return 1 - (1 - t) ** 3
    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
