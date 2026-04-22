import { createEffect, createMemo, createSignal } from 'solid-js'
import { useTimeline } from '@/contexts/TimelineContext'
import type { TimelineTrack } from '@/utils/timeline'
import ui from './KeyframeEditor.module.css'

export function KeyframeEditor() {
  const timeline = useTimeline()
  const config = timeline.config()
  const currentFrame = timeline.currentFrame
  const tracks = timeline.tracks

  const [selectedPath, setSelectedPath] = createSignal('exposure')
  const [keyframeValue, setKeyframeValue] = createSignal(0.25)

  const currentPath = () => selectedPath()
  const track = createMemo(() => {
    const path = currentPath()
    const tracksData = tracks()
    return tracksData[path as keyof typeof tracksData] as TimelineTrack | undefined
  })

  // Find current value for selected path at current frame
  const currentValue = createMemo(() => {
    const value = timeline.resolveValueAtPath(currentPath(), currentFrame())
    return value as number | null
  })

  // Update value when frame changes
  createEffect(() => {
    const value = currentValue()
    if (value !== null) {
      setKeyframeValue(value)
    }
  })

  // Add keyframe at current frame
  const handleAddKeyframe = () => {
    const track = timeline.tracks()[currentPath()]
    const value = keyframeValue()
    if (track === undefined) return

    timeline.addKeyframe(currentPath(), currentFrame(), value)
  }

  // Remove keyframe at current frame
  const handleRemoveKeyframe = () => {
    timeline.removeKeyframe(currentPath(), currentFrame())
  }

  const hasKeyframeAtFrame = (): boolean => {
    const t = track()
    return (t !== undefined && t.keyframes.some((kf: any) => kf.frame === currentFrame())) ?? false
  }

  const isAnimating = (): boolean => {
    const t = track()
    return t !== undefined && t.keyframes.length > 1
  }

  return (
    <div class={ui.editor}>
      <h4 class={ui.title}>Keyframe Editor</h4>

      <div class={ui.parameterSelect}>
        <label>Parameter</label>
        <select
          value={currentPath()}
          onChange={(e) => setSelectedPath(e.currentTarget.value)}
        >
          <option value="exposure">Exposure</option>
          <option value="skipIters">Skip Iterations</option>
          <option value="vibrancy">Vibrancy</option>
          <option value="drawMode">Draw Mode</option>
        </select>
      </div>

      {currentValue() !== null && (
        <div class={ui.currentValue}>
          <span>Current:</span>
          <span>{currentValue()}</span>
        </div>
      )}

      <div class={ui.keyframeValue}>
        <label>Value at Frame {currentFrame()}</label>
        <input
          type="number"
          value={keyframeValue()}
          onInput={(e) => setKeyframeValue(Number(e.currentTarget.value))}
        />
      </div>

      <div class={ui.actions}>
        <button
          class={ui.button}
          classList={{ [ui.active as string]: hasKeyframeAtFrame() }}
          onClick={handleAddKeyframe}
        >
          {hasKeyframeAtFrame() ? 'Update' : 'Add Keyframe'}
        </button>

        {hasKeyframeAtFrame() && (
          <button class={ui.button} classList={{ [ui.danger as string]: true }} onClick={handleRemoveKeyframe}>
            Remove
          </button>
        )}
      </div>

      <div class={ui.info}>
        {hasKeyframeAtFrame() ? (
          <>
            <span>Keyframe at frame {currentFrame()}</span>
            {isAnimating() && <span class={ui.animating}>Animation active</span>}
          </>
        ) : (
          <span>No keyframe at current frame</span>
        )}
      </div>
    </div>
  )
}