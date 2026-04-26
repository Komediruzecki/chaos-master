import * as v from '@/valibot'

export const EasingCurve = v.picklist([
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'bounce',
  'elastic',
])
export type EasingCurve = v.InferOutput<typeof EasingCurve>

export const Keyframe = v.object({
  frame: v.number(),
  easing: v.optional(EasingCurve, 'linear'),
})
export type Keyframe = v.InferOutput<typeof Keyframe>

export const TimelineTrack = v.object({
  parameterPath: v.string(),
  keyframes: v.array(Keyframe),
})
export type TimelineTrack = v.InferOutput<typeof TimelineTrack>

export const TimelineConfig = v.object({
  fps: v.pipe(v.number(), v.minValue(1), v.maxValue(60)),
  startFrame: v.pipe(v.number(), v.minValue(0)),
  endFrame: v.pipe(v.number(), v.minValue(1)),
  loop: v.boolean(),
})
export type TimelineConfig = v.InferOutput<typeof TimelineConfig>

export type TimelineData = {
  config: TimelineConfig
  tracks: Record<string, TimelineTrack>
}

export function defaultTimelineConfig(): TimelineConfig {
  return {
    fps: 30,
    startFrame: 0,
    endFrame: 90,
    loop: true,
  }
}
