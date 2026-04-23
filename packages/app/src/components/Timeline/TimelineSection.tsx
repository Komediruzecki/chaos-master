import { createSignal, createMemo, Show } from 'solid-js'
import { useTimeline } from '@/contexts/TimelineContext'
import { Cross, Pause, PlayPause, SkipBack, SkipForward } from '@/icons'
import { Checkbox } from '../Checkbox/Checkbox'
import { Slider } from '../Sliders/Slider'
import { KeyframeEditor } from './KeyframeEditor'
import { TimelinePanel } from './TimelinePanel'
import { TimelineRuler } from './TimelineRuler'
import ui from './TimelineSection.module.css'
import type { TimelineConfig } from '@/utils/timeline'

export interface TimelineSectionProps {
  onEnterAnimation?: () => void
}

export function TimelineSection({ onEnterAnimation }: TimelineSectionProps) {
  const timeline = useTimeline()!
  const [collapsed, setCollapsed] = createSignal(false)
  const isPlaying = createMemo(() => timeline.isPlaying())

  const setConfig = (updates: Partial<TimelineConfig>) => {
    timeline.setConfig((prev) => ({ ...prev, ...updates }) as TimelineConfig)
  }

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

          <div class={ui.playbackControls}>
            <button
              class={ui.controlButton}
              onClick={timeline.goBackFrame}
              title="Previous Frame"
              data-testid="prev-frame"
            >
              <SkipBack />
            </button>
            <button
              class={ui.controlButton}
              onClick={timeline.togglePlay}
              title={isPlaying() ? 'Pause' : 'Play'}
              data-testid="play-pause"
            >
              {isPlaying() ? <Pause /> : <PlayPause />}
            </button>
            <button
              class={ui.controlButton}
              onClick={() => {
                timeline.goToFrame(timeline.currentFrame())
              }}
              title="Go to Frame"
            >
              <span>{timeline.currentFrame()}</span>
            </button>
            <button
              class={ui.controlButton}
              onClick={timeline.advanceFrame}
              title="Next Frame"
              data-testid="next-frame"
            >
              <SkipForward />
            </button>
          </div>

          <div class={ui.timelineControls}>
            <Slider
              label="FPS"
              value={timeline.config().fps}
              min={1}
              max={60}
              step={1}
              onInput={(fps: number) => {
                setConfig({ fps })
              }}
              formatValue={(fps) => fps.toString()}
            />
            <Slider
              label="Time Scale"
              value={timeline.config().timeScale}
              min={0.1}
              max={4}
              step={0.1}
              onInput={(timeScale: number) => {
                setConfig({ timeScale })
              }}
              formatValue={(timeScale) => `${timeScale.toFixed(1)}x`}
            />
            <Slider
              label="Start Frame"
              value={timeline.config().startFrame}
              min={0}
              max={timeline.config().endFrame}
              step={1}
              onInput={(startFrame: number) => {
                setConfig({ startFrame })
              }}
              formatValue={(frame) => frame.toString()}
            />
            <Slider
              label="End Frame"
              value={timeline.config().endFrame}
              min={timeline.config().startFrame}
              max={timeline.config().endFrame + 100}
              step={1}
              onInput={(endFrame: number) => {
                setConfig({ endFrame })
              }}
              formatValue={(frame) => frame.toString()}
            />
            <label class={ui.checkboxLabel}>
              <Checkbox
                checked={timeline.config().loop}
                onChange={(loop: boolean) => {
                  setConfig({ loop })
                }}
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
