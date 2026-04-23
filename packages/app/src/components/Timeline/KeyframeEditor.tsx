import { createEffect, createMemo, createSignal } from 'solid-js'
import { useTimeline } from '@/contexts/TimelineContext'
import { Cross, Redo } from '@/icons'
import { addKeyframeToTimeline } from '@/utils/timeline'
import ui from './KeyframeEditor.module.css'
import type { EasingCurve } from '@/flame/schema/timeline'
import type { KeyframeData, TimelineTrack } from '@/utils/timeline'

export function KeyframeEditor() {
  const timeline = useTimeline()!
  const [selectedPath, setSelectedPath] = createSignal('exposure')
  const [keyframeValue, setKeyframeValue] = createSignal('0.25')
  const [interpolationMode, setInterpolationMode] =
    createSignal<EasingCurve>('linear')

  const currentPath = () => selectedPath()
  const currentFrame = createMemo(() => timeline.currentFrame())
  const tracks = createMemo(() => timeline.tracks())

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
      timeline.resolveValueAtPath(currentPath(), currentFrame() ?? 0) ?? null
    return value
  })

  // Check if current path expects a number or string
  const isNumberValue = (): boolean => {
    const path = currentPath()
    return [
      'exposure',
      'skipIters',
      'vibrancy',
      'paletteSpeed',
      'waveX',
      'waveY',
      'intensity',
      'periodicity',
      'octaves',
      'oscillationSpeed',
      'rippleRadius',
      'distortion',
    ].includes(path)
  }

  // Check if current path expects an array value (like backgroundColor, edgeFadeColor)
  const isArrayValue = (): boolean => {
    const path = currentPath()
    return path === 'backgroundColor' || path === 'edgeFadeColor'
  }

  // Format array value for display/input
  const formatArrayValue = (value: unknown): string => {
    if (Array.isArray(value) && value.length === 3) {
      return value.join(', ')
    }
    if (Array.isArray(value) && value.length === 4) {
      return value.join(', ')
    }
    return String(value)
  }

  // Check if current path expects a variation parameter
  const isVariationParam = (): boolean => {
    const path = currentPath()
    return [
      'waveX',
      'waveY',
      'intensity',
      'periodicity',
      'octaves',
      'oscillationSpeed',
      'rippleRadius',
      'distortion',
    ].includes(path)
  }

  // Parse array value from input string
  const parseArrayValue = (
    input: string,
  ): [number, number, number] | [number, number, number, number] | null => {
    try {
      const parts = input.split(',').map((s) => parseFloat(s.trim()))
      if (parts.length === 3) {
        return [parts[0]!, parts[1]!, parts[2]!]
      }
      if (parts.length === 4) {
        return [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
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
    } else if (isNumberValue() || isVariationParam()) {
      keyValue = Number(value)
    }

    addKeyframeToTimeline(
      timeline,
      currentPath(),
      currentFrame() ?? 0,
      keyValue,
      interpolationMode(),
    )
  }

  // Remove keyframe at current frame
  const handleRemoveKeyframe = () => {
    timeline.removeKeyframe(currentPath(), currentFrame())
  }

  // Duplicate keyframe to next frame
  const handleDuplicateKeyframe = () => {
    const currentKf = track()?.keyframes.find(
      (kf: KeyframeData) => kf.frame === currentFrame(),
    )
    if (
      !currentKf ||
      currentKf.value === null ||
      typeof currentKf.value === 'boolean'
    )
      return

    const nextFrame = currentFrame() + 1
    let keyValue:
      | string
      | number
      | [number, number, number]
      | [number, number, number, number] = currentKf.value

    if (isArrayValue()) {
      const parsed = parseArrayValue(String(currentKf.value))
      keyValue = parsed ? `[${parsed.join(', ')}]` : '[0, 0, 0]'
    } else if (isNumberValue()) {
      keyValue = Number(currentKf.value)
    }

    addKeyframeToTimeline(
      timeline,
      currentPath(),
      nextFrame,
      keyValue,
      currentKf.easing,
    )
  }

  // Freeze keyframe (copy current value to next frame)
  const handleFreezeKeyframe = () => {
    const nextFrame = currentFrame() + 1
    let keyValue:
      | string
      | number
      | [number, number, number]
      | [number, number, number, number] = keyframeValue()

    if (isArrayValue()) {
      const parsed = parseArrayValue(keyframeValue())
      keyValue = parsed ? `[${parsed.join(', ')}]` : '[0, 0, 0]'
    } else if (isNumberValue()) {
      keyValue = Number(keyframeValue())
    }

    addKeyframeToTimeline(
      timeline,
      currentPath(),
      nextFrame,
      keyValue,
      interpolationMode(),
    )
  }

  const hasKeyframeAtFrame = (): boolean => {
    const t = track()
    if (!t) return false
    return t.keyframes.some((kf: KeyframeData) => (kf as any).frame === (currentFrame() ?? 0))
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
          <option value="exposure">Render - Exposure</option>
          <option value="skipIters">Render - Skip Iterations</option>
          <option value="vibrancy">Render - Vibrancy</option>
          <option value="palettePhase">Render - Palette Phase</option>
          <option value="paletteSpeed">Render - Palette Speed</option>
          <option value="drawMode">Render - Draw Mode</option>
          <option value="colorInitMode">Render - Color Init Mode</option>
          <option value="pointInitMode">Render - Point Init Mode</option>
          <option value="backgroundColor">
            Render - Background Color (RGB)
          </option>
          <option value="edgeFadeColor">Render - Edge Fade Color (RGBA)</option>
          <option value="camera.x">Camera - X Position</option>
          <option value="camera.y">Camera - Y Position</option>
          <option value="camera.zoom">Camera - Zoom</option>
          <option value="camera.rotation">Camera - Rotation</option>
          <option value="waveX">Variation - Wave X</option>
          <option value="waveY">Variation - Wave Y</option>
          <option value="intensity">Variation - Intensity</option>
          <option value="periodicity">Variation - Periodicity</option>
          <option value="octaves">Variation - Octaves</option>
          <option value="oscillationSpeed">
            Variation - Oscillation Speed
          </option>
          <option value="rippleRadius">Variation - Ripple Radius</option>
          <option value="distortion">Variation - Distortion</option>
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
            isNumberValue() || isVariationParam()
              ? '0.25'
              : isArrayValue()
                ? '0, 0, 0, 0.8'
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

      {hasKeyframeAtFrame() && (
        <div class={ui.keyframeOptions}>
          <div class={ui.optionGroup}>
            <label>Interpolation</label>
            <select
              value={interpolationMode()}
              onChange={(e) =>
                setInterpolationMode(e.currentTarget.value as EasingCurve)
              }
              data-testid="interpolation-select"
            >
              <option value="linear">Linear</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="bounce">Bounce</option>
              <option value="elastic">Elastic</option>
            </select>
          </div>

          <div class={ui.keyframeActions}>
            <button
              class={ui.actionButton}
              onClick={handleDuplicateKeyframe}
              data-testid="duplicate-keyframe"
              title="Duplicate keyframe"
            >
              <Redo />
            </button>
            <button
              class={ui.actionButton}
              onClick={handleFreezeKeyframe}
              data-testid="freeze-keyframe"
              title="Freeze keyframe (hold current value)"
            >
              <Cross />
            </button>
          </div>
        </div>
      )}

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
