/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/strict-boolean-expressions */
import { createSignal } from 'solid-js'
import { applyEasing, clamp, lerp } from './easing'
import type { FlameDescriptor as FlameSchemaDescriptor } from '@/flame/schema/flameSchema'
import type { EasingCurve } from '@/flame/schema/timeline'

export interface FlameDescriptor extends Omit<FlameSchemaDescriptor, 'pointInitMode' | 'drawMode' | 'colorInitMode'> {
  renderSettings: {
    exposure: number
    skipIters: number
    drawMode: 'light' | 'paint'
    colorInitMode: 'colorInitZero' | 'colorInitPosition'
    pointInitMode: 'pointInitUnitDisk' | 'pointInitGaussianDisk' | 'pointInitUnitSquare' | 'pointInitModeGaussianSquare' | 'pointInitModeGaussianCircle' | 'pointInitModeUniform' | 'pointInitModeBiUnitDisk'
    vibrancy: number
    backgroundColor?: [number, number, number]
    camera?: {
      zoom: number
      position: [number, number]
    }
  }
  transforms: Record<string, unknown>
}

export type KeyframeData = {
  frame: number
  value: number | string | [number, number, number]
  easing?: EasingCurve
}

export type TimelineTrack = {
  parameterPath: string
  keyframes: KeyframeData[]
}

export type TimelineConfig = {
  fps: number
  startFrame: number
  endFrame: number
  loop: boolean
}

function defaultConfig(): TimelineConfig {
  return { fps: 30, startFrame: 0, endFrame: 90, loop: true }
}

/**
 * Resolves the value at a given frame for a set of keyframes.
 * Returns the interpolated value or the nearest keyframe value.
 */
export function resolveKeyframeValue(
  keyframes: KeyframeData[],
  frame: number,
): number | string | [number, number, number] | null {
  if (keyframes.length === 0) return null

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)

  // Before first keyframe
  const firstKf = sorted[0]!
  if (frame <= firstKf.frame) return firstKf.value

  // After last keyframe
  const lastKf = sorted[sorted.length - 1]!
  if (frame >= lastKf.frame) return lastKf.value

  // Find surrounding keyframes
  let prev = sorted[0]!
  let next = sorted[sorted.length - 1]!
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!
    const after = sorted[i + 1]!
    if (current.frame <= frame && after.frame >= frame) {
      prev = current
      next = after
      break
    }
  }

  const frameRange = next.frame - prev.frame
  if (frameRange === 0) return prev.value

  const rawT = (frame - prev.frame) / frameRange
  const t = applyEasing(rawT, prev.easing ?? 'linear')
  return lerp(prev.value, next.value, t)
}

/**
 * Gets all unique frames from all tracks for the timeline ruler.
 */
export function getAllTrackFrames(tracks: TimelineTrack[]): number[] {
  const frames = new Set<number>()
  for (const track of tracks) {
    for (const kf of track.keyframes) {
      frames.add(kf.frame)
    }
  }
  return [...frames].sort((a, b) => a - b)
}

/**
 * Creates a timeline state manager.
 * Returns current frame, config, tracks, and utility functions.
 */
export function createTimelineState() {
  const [currentFrame, setCurrentFrame] = createSignal(0)
  const [config, setConfig] = createSignal<TimelineConfig>(defaultConfig())
  const [tracks, setTracks] = createSignal<TimelineTrack[]>([], {
    equals: false,
  })
  const [isPlaying, setIsPlaying] = createSignal(false)

  function addKeyframe(
    parameterPath: string,
    frame: number,
    value: number | string | [number, number, number],
    easing?: EasingCurve,
  ) {
    setTracks((prev) => {
      const existingTrack = prev.find((t) => t.parameterPath === parameterPath)
      if (existingTrack) {
        const existingKf = existingTrack.keyframes.find(
          (kf) => kf.frame === frame,
        )
        if (existingKf) {
          // Update existing keyframe
          existingKf.value = value
          existingKf.easing = easing ?? existingKf.easing
        } else {
          existingTrack.keyframes.push({ frame, value, easing })
        }
        return [...prev]
      }
      return [...prev, { parameterPath, keyframes: [{ frame, value, easing }] }]
    })
  }

  function removeKeyframe(parameterPath: string, frame: number) {
    setTracks((prev) =>
      prev
        .map((t) =>
          t.parameterPath === parameterPath
            ? {
                ...t,
                keyframes: t.keyframes.filter((kf) => kf.frame !== frame),
              }
            : t,
        )
        .filter((t) => t.keyframes.length > 0),
    )
  }

  function getKeysForFrame(frame: number): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const track of tracks()) {
      const hasKf = track.keyframes.some((kf) => kf.frame === frame)
      if (hasKf) {
        result[track.parameterPath] = true
      }
    }
    return result
  }

  function hasKeyframeAtFrame(parameterPath: string, frame: number): boolean {
    const track = tracks().find((t: any) => t.parameterPath === parameterPath)
    return track?.keyframes.some((kf: KeyframeData) => kf.frame === frame) ?? false
  }

  function resolveValueAtPath(
    parameterPath: string,
    frame: number,
  ): number | string | [number, number, number] | null {
    const track = tracks().find((t: any) => t.parameterPath === parameterPath)
    if (!track) return null
    return resolveKeyframeValue(track.keyframes, frame)
  }

  function advanceFrame() {
    const cfg = config()
    const next = currentFrame() + 1
    if (next > cfg.endFrame) {
      setCurrentFrame(cfg.loop ? cfg.startFrame : cfg.endFrame)
    } else {
      setCurrentFrame(next)
    }
  }

  function goBackFrame() {
    const cfg = config()
    const prev = currentFrame() - 1
    if (prev < cfg.startFrame) {
      setCurrentFrame(cfg.loop ? cfg.endFrame : cfg.startFrame)
    } else {
      setCurrentFrame(prev)
    }
  }

  function goToFrame(frame: number) {
    setCurrentFrame(clamp(frame, config().startFrame, config().endFrame))
  }

  /**
   * Applies timeline values to a flame descriptor for the current frame.
   * Updates the descriptor with camera position, zoom, exposure, and other animated parameters.
   */
  function applyToFlame(flame: FlameDescriptor): void {
    const frame = currentFrame()

    // Animate camera position
    const xTrack = tracks().find((t: any) => t.parameterPath === 'camera.x') as any
    if (xTrack) {
      const value = resolveKeyframeValue(xTrack.keyframes, frame)
      if (value !== null && flame.renderSettings.camera) {
        flame.renderSettings.camera.position[0] = value
      }
    }

    const yTrack = tracks().find((t: any) => t.parameterPath === 'camera.y') as any
    if (yTrack) {
      const value = resolveKeyframeValue(yTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.camera.position[1] = value
      }
    }

    const zoomTrack = tracks().find((t: any) => t.parameterPath === 'camera.zoom') as any
    if (zoomTrack) {
      const value = resolveKeyframeValue(zoomTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.camera.zoom = value
      }
    }

    // Animate flame parameters
    const exposureTrack = tracks().find((t: any) => t.parameterPath === 'exposure') as any
    if (exposureTrack) {
      const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.exposure = value
      }
    }

    const skipItersTrack = tracks().find((t: any) => t.parameterPath === 'skipIters') as any
    if (skipItersTrack) {
      const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.skipIters = value
      }
    }

    const vibrancyTrack = tracks().find((t: any) => t.parameterPath === 'vibrancy') as any
    if (vibrancyTrack) {
      const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.vibrancy = value
      }
    }

    const drawModeTrack = tracks().find((t: any) => t.parameterPath === 'drawMode') as any
    if (drawModeTrack) {
      const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
      if (value !== null) {
        flame.renderSettings.drawMode = (value > 0.5 ? 'paint' : 'light')
      }
    }
  }

  return {
    currentFrame,
    setCurrentFrame,
    config,
    setConfig,
    tracks,
    setTracks,
    isPlaying,
    setIsPlaying,
    addKeyframe,
    removeKeyframe,
    getKeysForFrame,
    hasKeyframeAtFrame,
    resolveValueAtPath,
    advanceFrame,
    goBackFrame,
    goToFrame,
    applyToFlame,
  } as const
}

/**
 * Exported version of addKeyframe for use in components
 */
export function addKeyframeToTimeline(
  timeline: TimelineState,
  parameterPath: string,
  frame: number,
  value: number | string,
) {
  timeline.addKeyframe(parameterPath, frame, value)
}

export type TimelineState = ReturnType<typeof createTimelineState>

/**
 * Applies timeline values to a flame descriptor for the current frame.
 * This function is the module-level version used by components.
 */
export function applyTimelineToFlame(timeline: TimelineState, flame: FlameDescriptor): void {
  const frame = timeline.currentFrame()

  console.log('[Timeline] Applying values at frame', frame)

  // Animate camera position
  const xTrack = timeline.tracks().find((t: any) => t.parameterPath === 'camera.x') as any
  if (xTrack) {
    const value = resolveKeyframeValue(xTrack.keyframes, frame)
    console.log('[Timeline] camera.x value:', value)
    if (value !== null && flame.renderSettings.camera) {
      flame.renderSettings.camera.position[0] = value
    }
  }

  const yTrack = timeline.tracks().find((t: any) => t.parameterPath === 'camera.y') as any
  if (yTrack) {
    const value = resolveKeyframeValue(yTrack.keyframes, frame)
    console.log('[Timeline] camera.y value:', value)
    if (value !== null && flame.renderSettings.camera) {
      flame.renderSettings.camera.position[1] = value
    }
  }

  const zoomTrack = timeline.tracks().find((t: any) => t.parameterPath === 'camera.zoom') as any
  if (zoomTrack) {
    const value = resolveKeyframeValue(zoomTrack.keyframes, frame)
    console.log('[Timeline] camera.zoom value:', value)
    if (value !== null && flame.renderSettings.camera) {
      flame.renderSettings.camera.zoom = value
    }
  }

  // Animate flame parameters
  const exposureTrack = timeline.tracks().find((t: any) => t.parameterPath === 'exposure') as any
  if (exposureTrack) {
    const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
    console.log('[Timeline] exposure value:', value)
    if (value !== null) {
      flame.renderSettings.exposure = value
    }
  }

  const skipItersTrack = timeline.tracks().find((t: any) => t.parameterPath === 'skipIters') as any
  if (skipItersTrack) {
    const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
    console.log('[Timeline] skipIters value:', value)
    if (value !== null) {
      flame.renderSettings.skipIters = value
    }
  }

  const vibrancyTrack = timeline.tracks().find((t: any) => t.parameterPath === 'vibrancy') as any
  if (vibrancyTrack) {
    const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
    console.log('[Timeline] vibrancy value:', value)
    if (value !== null) {
      flame.renderSettings.vibrancy = value
    }
  }

  const drawModeTrack = timeline.tracks().find((t: any) => t.parameterPath === 'drawMode') as any
  if (drawModeTrack) {
    const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
    console.log('[Timeline] drawMode value:', value)
    if (value !== null) {
      flame.renderSettings.drawMode = (value > 0.5 ? 'paint' : 'light')
    }
  }

  // Animate string parameters (colorInitMode, pointInitMode)
  const colorInitModeTrack = timeline.tracks().find((t: any) => t.parameterPath === 'colorInitMode') as any
  if (colorInitModeTrack) {
    const value = resolveKeyframeValue(colorInitModeTrack.keyframes, frame)
    console.log('[Timeline] colorInitMode value:', value)
    if (value !== null) {
      flame.renderSettings.colorInitMode = value as unknown as 'colorInitZero' | 'colorInitPosition'
    }
  }

  const pointInitModeTrack = timeline.tracks().find((t: any) => t.parameterPath === 'pointInitMode') as any
  if (pointInitModeTrack) {
    const value = resolveKeyframeValue(pointInitModeTrack.keyframes, frame)
    console.log('[Timeline] pointInitMode value:', value)
    if (value !== null) {
      flame.renderSettings.pointInitMode = value as unknown as 'pointInitUnitDisk' | 'pointInitGaussianDisk' | 'pointInitUnitSquare' | 'pointInitModeGaussianSquare' | 'pointInitModeGaussianCircle' | 'pointInitModeUniform' | 'pointInitModeBiUnitDisk'
    }
  }

  // Animate backgroundColor (array of 3 numbers)
  const backgroundColorTrack = timeline.tracks().find((t: any) => t.parameterPath === 'backgroundColor') as any
  if (backgroundColorTrack) {
    const value = resolveKeyframeValue(backgroundColorTrack.keyframes, frame)
    console.log('[Timeline] backgroundColor value:', value)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    if (value !== null && typeof value === 'object' && Array.isArray(value)) {
      flame.renderSettings.backgroundColor = value as unknown as [number, number, number]
    }
  }
}