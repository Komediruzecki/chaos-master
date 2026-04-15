import { vec2f, vec4f } from 'typegpu/data'
import { DEFAULT_QUALITY } from '@/defaults'
import { example1 } from '@/flame/examples/example1'
import { Flam3 } from '@/flame/Flam3'
import { AutoCanvas } from '@/lib/AutoCanvas'
import { Camera2D } from '@/lib/Camera2D'
import { Root } from '@/lib/Root'
import ui from './WelcomeScreen.module.css'

function ArrowRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

type WelcomeScreenProps = {
  showDontShowAgain?: boolean
  onDontShowAgainChange?: (checked: boolean, ev: Event) => void
  onEnter: () => void
}

function ExamplePreview() {
  return (
    <Root
      adapterOptions={{
        powerPreference: 'high-performance',
      }}
    >
      <AutoCanvas pixelRatio={1}>
        <Camera2D
          position={vec2f(...example1.renderSettings.camera.position)}
          zoom={example1.renderSettings.camera.zoom}
        >
          <Flam3
            quality={DEFAULT_QUALITY}
            pointCountPerBatch={2e4}
            adaptiveFilterEnabled={true}
            flameDescriptor={example1}
            renderInterval={1}
            onExportImage={undefined}
            edgeFadeColor={vec4f(0)}
          />
        </Camera2D>
      </AutoCanvas>
    </Root>
  )
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <div class={ui['welcome-backdrop']}>
      <div class={ui['welcome-card']}>
        <button
          class={ui['welcome-preview']}
          onClick={props.onEnter}
          title="Click to enter"
        >
          <ExamplePreview />
          <div class={ui['preview-overlay']}>Click to explore</div>
        </button>

        <div class={ui['welcome-content']}>
          <div class={ui['branding']}>
            <h1 class={ui['logo-title']}>Chaos Master</h1>
            <p class={ui['logo-subtitle']}>
              Create beautiful fractal flames with WebGPU
            </p>
          </div>

          <div class={ui['tagline']}>
            <h2 class={ui['tagline-title']}>Welcome to Chaos</h2>
            <p class={ui['tagline-body']}>Are you ready to create something beautiful?</p>
          </div>

          <div class={ui['welcome-actions']}>
            <label class={ui['dont-show-again']}>
              <input
                type="checkbox"
                checked={props.showDontShowAgain ?? false}
                onChange={(ev) => {
                  props.onDontShowAgainChange?.(ev.target.checked, ev)
                }}
              />
              <span>Don't show on startup</span>
            </label>

            <button class={ui['enter-button']} onClick={props.onEnter}>
              Enter
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
