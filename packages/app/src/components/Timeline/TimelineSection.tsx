import { createSignal } from 'solid-js'
import { useTimeline } from '@/contexts/TimelineContext'
import { Checkbox } from '../Checkbox/Checkbox'
import { Cross } from '../icons'
import { Slider } from '../Sliders/Slider'
import { KeyframeEditor } from './KeyframeEditor'
import { TimelinePanel } from './TimelinePanel'
import { TimelineRuler } from './TimelineRuler'
import ui from './TimelineSection.module.css'
import type { TimelineSectionProps } from './TimelineSection'

export function TimelineSection({ onEnterAnimation }: TimelineSectionProps) {
  const timeline = useTimeline()
  const [collapsed, setCollapsed] = createSignal(false)
  const isPlaying = timeline.isPlaying

  return (
    <div class={ui.section} data-testid="timeline-section">
      <div class={ui.header}>
        <div class={ui.headerLeft}>
          <h3 class={ui.title}>Timeline</h3>
          <span class={ui.isPlayingIndicator} data-testid="timeline-playing">
            {isPlaying() ? '●' : '○'}
          </span>
        </div>
        <div class={ui.headerRight}>
          <button
            class={ui.iconButton}
            onClick={() => setCollapsed(!collapsed())}
            title={collapsed() ? 'Expand' : 'Collapse'}
            data-testid="timeline-collapse"
          >
            <Cross />
          </button>
        </div>
      </div>

      <Show when={!collapsed()}>
        <div class={ui.content}>
          <button class={ui.enterAnimationButton} onClick={onEnterAnimation}>
            Enter Animation Mode
          </button>

          <div class={ui.timelineControls}>
            <Slider
              label="FPS"
              value={timeline.config().fps}
              min={1}
              max={60}
              step={1}
              onInput={(fps) =>
                timeline.setConfig((prev) => ({ ...prev, fps }))
              }
              formatValue={(fps) => fps.toString()}
            />
            <Slider
              label="Start Frame"
              value={timeline.config().startFrame}
              min={0}
              max={timeline.config().endFrame}
              step={1}
              onInput={(startFrame) =>
                timeline.setConfig((prev) => ({ ...prev, startFrame }))
              }
              formatValue={(frame) => frame.toString()}
            />
            <Slider
              label="End Frame"
              value={timeline.config().endFrame}
              min={timeline.config().startFrame}
              max={timeline.config().endFrame + 100}
              step={1}
              onInput={(endFrame) =>
                timeline.setConfig((prev) => ({ ...prev, endFrame }))
              }
              formatValue={(frame) => frame.toString()}
            />
            <label class={ui.checkboxLabel}>
              <Checkbox
                checked={timeline.config().loop}
                onChange={(loop) =>
                  timeline.setConfig((prev) => ({ ...prev, loop }))
                }
              />
              <span>Loop Animation</span>
            </label>
          </div>

          <KeyframeEditor />

          <TimelineRuler />

          <TimelinePanel />
        </div>
      </Show>
    </div>
  )
}
