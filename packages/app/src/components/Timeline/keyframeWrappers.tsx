import { For } from 'solid-js'
import { recordEntries } from '@/utils/record'
import { handleColor } from '@/components/FlameColorEditor/FlameColorEditor'
import { useTheme } from '@/contexts/ThemeContext'
import { withKeyframeTarget } from './withKeyframeTarget'
import type { TransformFunction } from '@/flame/schema/flameSchema'

type WrappedFlameColorEditorProps = {
  transforms: Record<string, TransformFunction>
  setTransforms: (fn: (draft: TransformFunction) => void) => void
  class?: string
}

export function WrappedFlameColorEditor(
  props: WrappedFlameColorEditorProps,
) {
  const { theme } = useTheme()

  const colorVar = () => `transform.color.x`
  const colorVarY = () => `transform.color.y`

  return (
    <div class={props.class}>
      <For each={recordEntries(props.transforms)}>
        {([tid, transform]) => (
          <div class="transformGridRow">
            <withKeyframeTarget
              parameterPath={colorVar()}
              class="variationButtonSvgColor"
            >
              <svg>
                <g
                  class="variationButtonColor"
                  style={{
                    '--color': handleColor(
                      theme(),
                      { x: transform.color.x, y: transform.color.y },
                    ),
                  }}
                >
                  <circle class="variationButtonColorCircle" />
                </g>
              </svg>
            </withKeyframeTarget>

            <withKeyframeTarget
              parameterPath={colorVarY()}
              class="colorValueDisplay"
            >
              <span class="colorValueText">
                RGB({transform.color.x.toFixed(3)}, {transform.color.y.toFixed(3)})
              </span>
            </withKeyframeTarget>
          </div>
        )}
      </For>
    </div>
  )
}

type WrappedFlameColorRowProps = {
  tid: string
  transform: TransformFunction
  onRemove: () => void
  index: number
}

export function WrappedFlameColorRow(props: WrappedFlameColorRowProps) {
  const { theme } = useTheme()

  return (
    <div class="transformGridRow">
      <withKeyframeTarget parameterPath={`transform.${props.tid}.color.x`}>
        <span class="colorValueDisplay">
          <span class="colorValueText">
            R: {props.transform.color.x.toFixed(3)}
          </span>
        </span>
      </withKeyframeTarget>

      <withKeyframeTarget parameterPath={`transform.${props.tid}.color.y`}>
        <span class="colorValueDisplay">
          <span class="colorValueText">
            G: {props.transform.color.y.toFixed(3)}
          </span>
        </span>
      </withKeyframeTarget>
    </div>
  )
}