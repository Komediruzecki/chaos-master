import { For } from 'solid-js'
import { vec2f } from 'typegpu/data'
import { handleColor } from '@/components/FlameColorEditor/FlameColorEditor'
import { useTheme } from '@/contexts/ThemeContext'
import { recordEntries } from '@/utils/record'
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

  return (
    <div class={props.class}>
      <For each={recordEntries(props.transforms)}>
        {([_tid, transform]) => (
          <div class="transformGridRow">
            <withKeyframeTarget
              parameterPath="transform.color.x"
              class="variationButtonSvgColor"
            >
              <svg>
                <g
                  class="variationButtonColor"
                  style={{
                    '--color': handleColor(
                      theme(),
                      vec2f(transform.color.x, transform.color.y),
                    ),
                  }}
                >
                  <circle class="variationButtonColorCircle" />
                </g>
              </svg>
            </withKeyframeTarget>

            <withKeyframeTarget
              parameterPath="transform.color.y"
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