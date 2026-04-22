import { useTimeline } from '@/contexts/TimelineContext'
import ui from './TimelineRuler.module.css'

export function TimelineRuler() {
  const timeline = useTimeline()
  const config = timeline.config()
  const tracks = timeline.tracks

  const keyframeFrames = new Set<number>()
  for (const track of Object.values(tracks)) {
    for (const kf of track.keyframes) {
      keyframeFrames.add(kf.frame)
    }
  }

  const frameWidth = 30 // pixels per frame
  const totalWidth = config.endFrame * frameWidth

  const keyframeFramesArr = Array.from(keyframeFrames).sort((a, b) => a - b)

  return (
    <div
      class={ui.ruler}
      style={{ width: `${totalWidth}px` }}
      data-testid="timeline-ruler"
    >
      <div class={ui.markers}>
        {keyframeFramesArr.map((frame) => (
          <div
            data-key={frame}
            class={ui.keyframeMarker}
            style={{ left: `${frame * frameWidth}px` }}
            data-testid={`frame-marker-${frame}`}
          />
        ))}
      </div>
      <div class={ui.scale}>
        {Array.from({ length: config.endFrame + 1 }, (_, i) => i).map(
          (frame) => (
            <span
              data-keyframe={frame}
              style={{ width: `${frameWidth}px` }}
              data-testid={`frame-number-${frame}`}
            >
              {frame}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
