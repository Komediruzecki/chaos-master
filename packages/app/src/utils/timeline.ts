/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSignal } from 'solid-js'
import { applyEasing, clamp } from './easing'
import type { DrawMode } from '@/flame/drawMode'
import type { PointInitMode } from '@/flame/pointInitMode'
import type { EasingCurve } from '@/flame/schema/timeline'

export interface FlameDescriptor {
  renderSettings: {
    exposure: number
    skipIters: number
    drawMode: DrawMode
    colorInitMode: 'colorInitZero' | 'colorInitPosition'
    pointInitMode: PointInitMode
    vibrancy: number
    backgroundColor?: [number, number, number]
    camera?: {
      zoom: number
      position: [number, number]
    }
  }
  transforms: Record<string, unknown>
  metadata: {
    author: string
  }
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

  // Type guard: if values are numbers, use lerp, otherwise interpolate strings
  if (typeof prev.value === 'number' && typeof next.value === 'number') {
    return prev.value + (next.value - prev.value) * t
  }

  // For string interpolation (drawMode, colorInitMode, pointInitMode)
  return prev.value
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
    return (
      track?.keyframes.some((kf: KeyframeData) => kf.frame === frame) ?? false
    )
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
    const xTrack = tracks().find((t) => t.parameterPath === 'camera.x')
    if (xTrack) {
      const value = resolveKeyframeValue(xTrack.keyframes, frame)
      if (
        value !== null &&
        typeof value === 'number' &&
        flame.renderSettings.camera?.position
      ) {
        flame.renderSettings.camera.position[0] = value
      }
    }

    const yTrack = tracks().find((t) => t.parameterPath === 'camera.y')
    if (yTrack) {
      const value = resolveKeyframeValue(yTrack.keyframes, frame)
      if (
        value !== null &&
        typeof value === 'number' &&
        flame.renderSettings.camera?.position
      ) {
        flame.renderSettings.camera.position[1] = value
      }
    }

    const zoomTrack = tracks().find((t) => t.parameterPath === 'camera.zoom')
    if (zoomTrack) {
      const value = resolveKeyframeValue(zoomTrack.keyframes, frame)
      if (
        value !== null &&
        typeof value === 'number' &&
        flame.renderSettings.camera
      ) {
        flame.renderSettings.camera.zoom = value
      }
    }

    // Animate flame parameters
    const exposureTrack = tracks().find((t) => t.parameterPath === 'exposure')
    if (exposureTrack) {
      const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.exposure = value
      }
    }

    const skipItersTrack = tracks().find((t) => t.parameterPath === 'skipIters')
    if (skipItersTrack) {
      const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.skipIters = value
      }
    }

    const vibrancyTrack = tracks().find((t) => t.parameterPath === 'vibrancy')
    if (vibrancyTrack) {
      const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.vibrancy = value
      }
    }

    const drawModeTrack = tracks().find((t) => t.parameterPath === 'drawMode')
    if (drawModeTrack) {
      const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
      if (value !== null && typeof value === 'string') {
        flame.renderSettings.drawMode = value as DrawMode
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
export function applyTimelineToFlame(
  timeline: TimelineState,
  flame: FlameDescriptor,
): void {
  const frame = timeline.currentFrame()

  // Animate camera position
  const xTrack = timeline.tracks().find((t) => t.parameterPath === 'camera.x')
  if (xTrack) {
    const value = resolveKeyframeValue(xTrack.keyframes, frame)
    if (
      value !== null &&
      typeof value === 'number' &&
      flame.renderSettings.camera?.position
    ) {
      flame.renderSettings.camera.position[0] = value
    }
  }

  const yTrack = timeline.tracks().find((t) => t.parameterPath === 'camera.y')
  if (yTrack) {
    const value = resolveKeyframeValue(yTrack.keyframes, frame)
    if (
      value !== null &&
      typeof value === 'number' &&
      flame.renderSettings.camera?.position
    ) {
      flame.renderSettings.camera.position[1] = value
    }
  }

  const zoomTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'camera.zoom')
  if (zoomTrack) {
    const value = resolveKeyframeValue(zoomTrack.keyframes, frame)
    if (
      value !== null &&
      typeof value === 'number' &&
      flame.renderSettings.camera
    ) {
      flame.renderSettings.camera.zoom = value
    }
  }

  // Animate flame parameters
  const exposureTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'exposure')
  if (exposureTrack) {
    const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.exposure = value
    }
  }

  const skipItersTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'skipIters')
  if (skipItersTrack) {
    const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.skipIters = value
    }
  }

  const vibrancyTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'vibrancy')
  if (vibrancyTrack) {
    const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.vibrancy = value
    }
  }

  const drawModeTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'drawMode')
  if (drawModeTrack) {
    const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
    if (value !== null && typeof value === 'string') {
      flame.renderSettings.drawMode = value as DrawMode
    }
  }

  // Animate string parameters (colorInitMode, pointInitMode)
  const colorInitModeTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'colorInitMode')
  if (colorInitModeTrack) {
    const value = resolveKeyframeValue(colorInitModeTrack.keyframes, frame)
    if (value !== null && typeof value === 'string') {
      flame.renderSettings.colorInitMode = value as
        | 'colorInitZero'
        | 'colorInitPosition'
    }
  }

  const pointInitModeTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'pointInitMode')
  if (pointInitModeTrack) {
    const value = resolveKeyframeValue(pointInitModeTrack.keyframes, frame)
    if (value !== null && typeof value === 'string') {
      flame.renderSettings.pointInitMode = value as PointInitMode
    }
  }

  // Animate backgroundColor (array of 3 numbers)
  const backgroundColorTrack = timeline
    .tracks()
    .find((t) => t.parameterPath === 'backgroundColor')
  if (backgroundColorTrack) {
    const value = resolveKeyframeValue(backgroundColorTrack.keyframes, frame)
    if (value !== null && Array.isArray(value)) {
      flame.renderSettings.backgroundColor = value
    }
  }
}
