import { createEffect, createMemo, createSignal } from 'solid-js'
import { useTimeline } from '@/contexts/TimelineContext'
import { addKeyframeToTimeline } from '@/utils/timeline'
import ui from './KeyframeEditor.module.css'
import type { KeyframeData, TimelineTrack } from '@/utils/timeline'

export function KeyframeEditor() {
  const timeline = useTimeline()
  const currentFrame = timeline.currentFrame
  const tracks = timeline.tracks

  const [selectedPath, setSelectedPath] = createSignal('exposure')
  const [keyframeValue, setKeyframeValue] = createSignal('0.25')
  const [_isArrayValue, _setIsArrayValue] = createSignal(false)

  const currentPath = () => selectedPath()
  const track = createMemo(() => {
    const path = currentPath()
    const tracksData = tracks()
    return tracksData[path as keyof typeof tracksData] as
      | TimelineTrack
      | undefined
  })

  // Find current value for selected path at current frame
  const currentValue = createMemo(() => {
    const value =
      timeline.resolveValueAtPath(currentPath(), currentFrame()) ?? null
    return value
  })

  // Check if current path expects a number or string
  const isNumberValue = (): boolean => {
    const path = currentPath()
    return ['exposure', 'skipIters', 'vibrancy'].includes(path)
  }

  // Check if current path expects an array value (like backgroundColor)
  const isArrayValue = (): boolean => {
    const path = currentPath()
    return path === 'backgroundColor'
  }

  // Format array value for display/input
  const formatArrayValue = (value: unknown): string => {
    if (Array.isArray(value) && value.length === 3) {
      return value.join(', ')
    }
    return String(value)
  }

  // Parse array value from input string
  const parseArrayValue = (input: string): [number, number, number] | null => {
    try {
      const parts = input.split(',').map((s) => parseFloat(s.trim()))
      if (parts.length === 3) {
        return [parts[0]!, parts[1]!, parts[2]!]
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  // Update value when frame changes
  createEffect(() => {
    const value = currentValue()
    if (value !== null) {
      if (isArrayValue()) {
        setKeyframeValue(formatArrayValue(value))
      } else {
        setKeyframeValue(String(value))
      }
    }
  })

  // Add keyframe at current frame
  const handleAddKeyframe = () => {
    const value = keyframeValue()
    if (track() === undefined) return

    let keyValue: string | number = value

    if (isArrayValue()) {
      const parsed = parseArrayValue(value)
      keyValue = parsed ? `[${parsed.join(', ')}]` : '[0, 0, 0]'
    } else if (isNumberValue()) {
      keyValue = Number(value)
    }

    addKeyframeToTimeline(timeline, currentPath(), currentFrame(), keyValue)
  }

  // Remove keyframe at current frame
  const handleRemoveKeyframe = () => {
    timeline.removeKeyframe(currentPath(), currentFrame())
  }

  const hasKeyframeAtFrame = (): boolean => {
    const t = track()
    if (!t) return false
    return t.keyframes.some((kf: KeyframeData) => kf.frame === currentFrame())
  }

  const isAnimating = (): boolean => {
    const t = track()
    return t !== undefined && t.keyframes.length > 1
  }

  return (
    <div class={ui.editor} data-testid="keyframe-editor">
      <h4 class={ui.title}>Keyframe Editor</h4>

      <div class={ui.parameterSelect}>
        <label>Parameter</label>
        <select
          value={currentPath()}
          onChange={(e) => setSelectedPath(e.currentTarget.value)}
          data-testid="parameter-select"
        >
          <option value="exposure">Exposure</option>
          <option value="skipIters">Skip Iterations</option>
          <option value="vibrancy">Vibrancy</option>
          <option value="drawMode">Draw Mode</option>
          <option value="colorInitMode">Color Init Mode</option>
          <option value="pointInitMode">Point Init Mode</option>
          <option value="backgroundColor">Background Color</option>
        </select>
      </div>

      {currentValue() !== null && (
        <div class={ui.currentValue}>
          <span>Current:</span>
          <span data-testid="current-value">{currentValue()}</span>
        </div>
      )}

      <div class={ui.keyframeValue}>
        <label>Value at Frame {currentFrame()}</label>
        <input
          type="text"
          value={keyframeValue()}
          onInput={(e) => setKeyframeValue(e.currentTarget.value)}
          placeholder={
            isNumberValue()
              ? '0.25'
              : isArrayValue()
                ? '0, 0, 0'
                : 'colorInitZero'
          }
          data-testid="keyframe-value-input"
        />
        {isArrayValue() && (
          <div
            class={ui.colorPreview}
            style={{
              background: `rgb(${keyframeValue()})`,
            }}
            data-testid="color-preview"
          />
        )}
      </div>

      <div class={ui.actions}>
        <button
          class={ui.button}
          classList={{ [ui.active as string]: hasKeyframeAtFrame() }}
          onClick={handleAddKeyframe}
          data-testid={
            hasKeyframeAtFrame() ? 'update-keyframe' : 'add-keyframe'
          }
        >
          {hasKeyframeAtFrame() ? 'Update' : 'Add Keyframe'}
        </button>

        {hasKeyframeAtFrame() && (
          <button
            class={ui.button}
            classList={{ [ui.danger as string]: true }}
            onClick={handleRemoveKeyframe}
            data-testid="remove-keyframe"
          >
            Remove
          </button>
        )}
      </div>

      <div class={ui.info}>
        {hasKeyframeAtFrame() ? (
          <>
            <span>
              Keyframe at frame{' '}
              <span data-testid="keyframe-frame">{currentFrame()}</span>
            </span>
            {isAnimating() && (
              <span class={ui.animating}>Animation active</span>
            )}
          </>
        ) : (
          <span>No keyframe at current frame</span>
        )}
      </div>
    </div>
  )
}
