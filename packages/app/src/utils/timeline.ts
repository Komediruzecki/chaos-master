import { createSignal } from 'solid-js'
import { applyEasing, clamp, lerp } from './easing'
import type { EasingCurve } from '@/flame/schema/timeline'

export interface FlameDescriptor {
  version?: string
  metadata: { author: string }
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
  transforms: Record<string, any>
}

export type KeyframeData = {
  frame: number
  value: number
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
): number | null {
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
    value: number,
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
                keyframes: t.keyframes.filter((kf: any) => kf.frame !== frame),
              }
            : t,
        )
        .filter((t) => t.keyframes.length > 0),
    )
  }

  function getKeysForFrame(frame: number): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const track of tracks()) {
      const hasKf = track.keyframes.some((kf: any) => kf.frame === frame)
      if (hasKf) {
        result[track.parameterPath] = true
      }
    }
    return result
  }

  function hasKeyframeAtFrame(parameterPath: string, frame: number): boolean {
    const track = tracks().find((t: any) => t.parameterPath === parameterPath)
    return track?.keyframes.some((kf: any) => kf.frame === frame) ?? false
  }

  function resolveValueAtPath(
    parameterPath: string,
    frame: number,
  ): number | null {
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
    const cfg = config()
    setCurrentFrame(clamp(frame, cfg.startFrame, cfg.endFrame))
  }

  /**
   * Applies timeline values to a flame descriptor for the current frame.
   * Updates the descriptor with camera position, zoom, exposure, and other animated parameters.
   */
  function applyToFlame(flame: FlameDescriptor): void {
    const frame = currentFrame()
    const cfg = config()

    // Animate camera position
    if (flame.renderSettings?.camera?.position) {
      const xTrack = tracks().find((t: any) => t.parameterPath === 'camera.x')
      if (xTrack) {
        const value = resolveKeyframeValue(xTrack.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.camera.position[0] = value
        }
      }

      const yTrack = tracks().find((t: any) => t.parameterPath === 'camera.y')
      if (yTrack) {
        const value = resolveKeyframeValue(yTrack.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.camera.position[1] = value
        }
      }
    }

    if (flame.renderSettings?.camera?.zoom !== undefined) {
      const track = tracks().find((t: any) => t.parameterPath === 'camera.zoom')
      if (track) {
        const value = resolveKeyframeValue(track.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.camera.zoom = value
        }
      }
    }

    // Animate flame parameters
    if (flame.renderSettings?.exposure !== undefined) {
      const track = tracks().find((t: any) => t.parameterPath === 'exposure')
      if (track) {
        const value = resolveKeyframeValue(track.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.exposure = value
        }
      }
    }

    if (flame.renderSettings?.skipIters !== undefined) {
      const track = tracks().find((t: any) => t.parameterPath === 'skipIters')
      if (track) {
        const value = resolveKeyframeValue(track.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.skipIters = value
        }
      }
    }

    if (flame.renderSettings?.vibrancy !== undefined) {
      const track = tracks().find((t: any) => t.parameterPath === 'vibrancy')
      if (track) {
        const value = resolveKeyframeValue(track.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.vibrancy = value
        }
      }
    }

    if (flame.renderSettings?.drawMode !== undefined) {
      const track = tracks().find((t: any) => t.parameterPath === 'drawMode')
      if (track) {
        const value = resolveKeyframeValue(track.keyframes, frame)
        if (value !== null) {
          flame.renderSettings.drawMode = value as 'light' | 'paint'
        }
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

export type TimelineState = ReturnType<typeof createTimelineState>