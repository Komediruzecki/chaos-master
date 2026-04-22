import { useTimeline } from '@/contexts/TimelineContext'
import ui from './TimelinePanel.module.css'

export function TimelinePanel() {
  const timeline = useTimeline()

  const config = timeline.config
  const currentFrame = timeline.currentFrame
  const isPlaying = timeline.isPlaying

  const handlePlayPause = () => {
    timeline.setIsPlaying(!isPlaying())
  }

  const handleStepForward = () => {
    timeline.advanceFrame()
  }
  const handleStepBackward = () => {
    timeline.goBackFrame()
  }
  const handleGoToStart = () => {
    timeline.goToFrame(config().startFrame)
  }
  const handleGoToEnd = () => {
    timeline.goToFrame(config().endFrame)
  }

  const handleFpsChange = (newFps: number) => {
    if (Number.isNaN(newFps)) return
    const clamped = Math.max(1, Math.min(60, Math.round(newFps)))
    timeline.setConfig({ ...config(), fps: clamped })
  }

  const handleEndFrameChange = (newEnd: number) => {
    if (Number.isNaN(newEnd)) return
    const clamped = Math.max(1, Math.round(newEnd))
    timeline.setConfig({ ...config(), endFrame: clamped })
  }

  const handleLoopToggle = () => {
    timeline.setConfig({ ...config(), loop: !config().loop })
  }

  return (
    <div class={ui.panel}>
      <div class={ui.toolbar}>
        <div class={ui.transportControls}>
          <button
            class={ui.transportBtn}
            onClick={handleGoToStart}
            title="Go to start"
          >
            &lArr;
          </button>
          <button
            class={ui.transportBtn}
            onClick={handleStepBackward}
            title="Previous frame"
          >
            &laquo;
          </button>
          <button
            class={ui.transportBtn}
            classList={{ active: isPlaying() }}
            onClick={handlePlayPause}
            title="Play/Pause"
          >
            {isPlaying() ? '\u23F8' : '\u25B6'}
          </button>
          <button
            class={ui.transportBtn}
            onClick={handleStepForward}
            title="Next frame"
          >
            &raquo;
          </button>
          <button
            class={ui.transportBtn}
            onClick={handleGoToEnd}
            title="Go to end"
          >
            &rArr;
          </button>
          <label class={ui.labeledInput}>
            <span>Loop</span>
            <input
              type="checkbox"
              checked={config().loop}
              onChange={handleLoopToggle}
            />
          </label>
        </div>
        <div class={ui.frameInfo}>
          <span class={ui.frameDisplay}>
            Frame {currentFrame()} / {config().endFrame}
          </span>
        </div>
        <div class={ui.settingsControls}>
          <label class={ui.labeledInput}>
            <span>FPS</span>
            <input
              type="number"
              class={ui.numberInput}
              value={config().fps}
              min={1}
              max={60}
              onBlur={(e) => { handleFpsChange(Number(e.currentTarget.value)); }}
            />
          </label>
          <label class={ui.labeledInput}>
            <span>Frames</span>
            <input
              type="number"
              class={ui.numberInput}
              value={config().endFrame}
              min={1}
              onBlur={(e) =>
                { handleEndFrameChange(Number(e.currentTarget.value)); }
              }
            />
          </label>
        </div>
      </div>
    </div>
  )
}
