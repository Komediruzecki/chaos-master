import { createSignal } from 'solid-js'
import { clamp } from '@/utils/easing'

export type EasingCurve =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'elastic'

export type PointInitMode =
  | 'pointInitUnitDisk'
  | 'pointInitGaussianDisk'
  | 'pointInitUnitSquare'
  | 'pointInitModeGaussianSquare'
  | 'pointInitModeGaussianCircle'

export interface FlameDescriptor {
  renderSettings: {
    exposure: number
    skipIters: number
    drawMode: 'light' | 'paint'
    colorInitMode: 'colorInitZero' | 'colorInitPosition'
    pointInitMode: 'pointInitUnitDisk' | 'pointInitGaussianDisk' | 'pointInitUnitSquare' | 'pointInitModeGaussianSquare' | 'pointInitModeGaussianCircle'
    vibrancy: number
    backgroundColor?: [number, number, number]
    camera?: {
      zoom: number
      position: [number, number]
      rotation?: number
    }
    palettePhase?: number
    paletteSpeed?: number
    variationParams?: {
      waveX?: number
      waveY?: number
      intensity?: number
      periodicity?: number
      octaves?: number
      oscillationSpeed?: number
      rippleRadius?: number
      distortion?: number
    }
  }
  transforms: Record<string, unknown>
  metadata: {
    author: string
  }
  edgeFadeColor?: [number, number, number, number]
}

export type KeyframeData = {
  frame: number
  value:
    | number
    | string
    | [number, number, number]
    | [number, number, number, number]
    | boolean
    | null
  easing?: EasingCurve
}

export type TimelineTrack = {
  parameterPath: string
  keyframes: KeyframeData[]
}

export type TimelineConfig = {
  fps: number
  timeScale: number
  startFrame: number
  endFrame: number
  loop: boolean
}

function defaultConfig(): TimelineConfig {
  return { fps: 30, timeScale: 1, startFrame: 0, endFrame: 90, loop: true }
}

/**
 * Resolves the value at a given frame for a set of keyframes.
 * Returns the interpolated value or the nearest keyframe value.
 */
export function resolveKeyframeValue(
  keyframes: KeyframeData[],
  frame: number,
): number | string | boolean | [number, number, number] | null | [number, number, number, number] {
  if (keyframes.length === 0) return null

  const sorted = [...keyframes].sort((a: KeyframeData, b: KeyframeData) => a.frame - b.frame)

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
  const t = clamp(rawT, 0, 1)

  // Type guard: if values are numbers, use lerp, otherwise interpolate strings
  if (typeof prev.value === 'number' && typeof next.value === 'number') {
    return prev.value + (next.value - prev.value) * t
  }

  // For string interpolation (drawMode, colorInitMode, pointInitMode) or boolean
  if (typeof prev.value === 'string' || typeof prev.value === 'boolean') {
    return prev.value
  }
  return next.value
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
  return [...frames].sort((a: number, b: number) => a - b)
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
  let animationFrameId: number | null = null

  function addKeyframe(
    parameterPath: string,
    frame: number,
    value: number | string | [number, number, number] | [number, number, number, number],
    easing?: EasingCurve,
  ) {
    setTracks((prev: TimelineTrack[]) => {
      const existingTrack = prev.find((t: TimelineTrack) => t.parameterPath === parameterPath)
      if (existingTrack) {
        const existingKf = existingTrack.keyframes.find(
          (kf: KeyframeData) => kf.frame === frame,
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
    setTracks((prev: TimelineTrack[]) =>
      prev
        .map((t: TimelineTrack) =>
          t.parameterPath === parameterPath
            ? {
                ...t,
                keyframes: t.keyframes.filter((kf: KeyframeData) => kf.frame !== frame),
              }
            : t,
        )
        .filter((t: TimelineTrack) => t.keyframes.length > 0),
    )
  }

  function getKeysForFrame(frame: number): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const track of tracks()) {
      const hasKf = track.keyframes.some((kf: KeyframeData) => kf.frame === frame)
      if (hasKf) {
        result[track.parameterPath] = true
      }
    }
    return result
  }

  function hasKeyframeAtFrame(parameterPath: string, frame: number): boolean {
    const track = tracks().find(
      (t: TimelineTrack): t is TimelineTrack => t.parameterPath === parameterPath,
    )
    return (
      track?.keyframes.some((kf: KeyframeData) => kf.frame === frame) ?? false
    )
  }

  function resolveValueAtPath(
    parameterPath: string,
    frame: number,
  ): number | string | boolean | [number, number, number] | [number, number, number, number] | null {
    const track = tracks().find(
      (t: TimelineTrack): t is TimelineTrack => t.parameterPath === parameterPath,
    )
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

  function play() {
    if (isPlaying()) return

    setIsPlaying(true)
    const frameLoop = () => {
      if (!isPlaying()) {
        animationFrameId = null
        return
      }

      const cfg = config()
      for (let i = 0; i < cfg.timeScale; i++) {
        advanceFrame()
      }
      animationFrameId = requestAnimationFrame(frameLoop)
    }

    animationFrameId = requestAnimationFrame(frameLoop)
  }

  function pause() {
    setIsPlaying(false)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function togglePlay() {
    if (isPlaying()) {
      pause()
    } else {
      play()
    }
  }

  /**
   * Applies timeline values to a flame descriptor for the current frame.
   * Updates the descriptor with camera position, zoom, exposure, and other animated parameters.
   */
  function applyToFlame(flame: FlameDescriptor): void {
    const frame = currentFrame()

    // Animate camera position
    const xTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.x')
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

    const yTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.y')
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

    // Animate camera rotation
    const rotationTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.rotation')
    if (rotationTrack) {
      const value = resolveKeyframeValue(rotationTrack.keyframes, frame)
      if (
        value !== null &&
        typeof value === 'number' &&
        flame.renderSettings.camera
      ) {
        flame.renderSettings.camera.rotation = value
      }
    }

    // Animate camera zoom
    const zoomTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.zoom')
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
    const exposureTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'exposure')
    if (exposureTrack) {
      const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.exposure = value
      }
    }

    const skipItersTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'skipIters')
    if (skipItersTrack) {
      const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.skipIters = value
      }
    }

    const vibrancyTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'vibrancy')
    if (vibrancyTrack) {
      const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
      if (value !== null && typeof value === 'number') {
        flame.renderSettings.vibrancy = value
      }
    }

    const drawModeTrack = tracks().find((t: TimelineTrack) => t.parameterPath === 'drawMode')
    if (drawModeTrack) {
      const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
      if (value !== null && typeof value === 'string') {
        flame.renderSettings.drawMode = value as 'light' | 'paint'
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
    play,
    pause,
    togglePlay,
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
  value: number | string | [number, number, number] | [number, number, number, number],
  easing: EasingCurve = 'linear',
) {
  timeline.addKeyframe(parameterPath, frame, value, easing)
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
  const xTrack = timeline.tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.x')
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

  const yTrack = timeline.tracks().find((t: TimelineTrack) => t.parameterPath === 'camera.y')
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
    .find((t: TimelineTrack) => t.parameterPath === 'camera.zoom')
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
    .find((t: TimelineTrack) => t.parameterPath === 'exposure')
  if (exposureTrack) {
    const value = resolveKeyframeValue(exposureTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.exposure = value
    }
  }

  const skipItersTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'skipIters')
  if (skipItersTrack) {
    const value = resolveKeyframeValue(skipItersTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.skipIters = value
    }
  }

  const vibrancyTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'vibrancy')
  if (vibrancyTrack) {
    const value = resolveKeyframeValue(vibrancyTrack.keyframes, frame)
    if (value !== null && typeof value === 'number') {
      flame.renderSettings.vibrancy = value
    }
  }

  const drawModeTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'drawMode')
  if (drawModeTrack) {
    const value = resolveKeyframeValue(drawModeTrack.keyframes, frame)
    if (value !== null && typeof value === 'string') {
      flame.renderSettings.drawMode = value as 'light' | 'paint'
    }
  }

  // Animate string parameters (colorInitMode, pointInitMode)
  const colorInitModeTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'colorInitMode')
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
    .find((t: TimelineTrack) => t.parameterPath === 'pointInitMode')
  if (pointInitModeTrack) {
    const value = resolveKeyframeValue(pointInitModeTrack.keyframes, frame)
    if (value !== null && typeof value === 'string') {
      flame.renderSettings.pointInitMode = value as PointInitMode
    }
  }

  // Animate backgroundColor (array of 3 numbers)
  const backgroundColorTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'backgroundColor')
  if (backgroundColorTrack) {
    const value = resolveKeyframeValue(backgroundColorTrack.keyframes, frame)
    if (
      value !== null &&
      Array.isArray(value) &&
      value.length === 3 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number' &&
      typeof value[2] === 'number'
    ) {
      flame.renderSettings.backgroundColor = value
    }
  }

  // Animate edgeFadeColor (array of 4 numbers)
  const edgeFadeColorTrack = timeline
    .tracks()
    .find((t: TimelineTrack) => t.parameterPath === 'edgeFadeColor')
  if (edgeFadeColorTrack) {
    const value = resolveKeyframeValue(edgeFadeColorTrack.keyframes, frame)
    if (value !== null && Array.isArray(value) && value.length === 4) {
      const typed = value as unknown as [number, number, number, number]
      (flame as unknown as Record<string, unknown>).edgeFadeColor = typed
    }
  }
}