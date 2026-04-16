import { Portal } from 'solid-js/web'
import { vec2f, vec4f } from 'typegpu/data'
import { DEFAULT_QUALITY } from '@/defaults'
import { example1 } from '@/flame/examples/example1'
import { Flam3 } from '@/flame/Flam3'
import { AutoCanvas } from '@/lib/AutoCanvas'
import { Camera2D } from '@/lib/Camera2D'
import { Root } from '@/lib/Root'
import ui from './WelcomeScreen.module.css'

type WelcomeScreenProps = {
  showDontShowAgain?: boolean
  onDontShowAgainChange?: (checked: boolean, ev: Event) => void
  onEnter: () => void
}

function ExamplePreview() {
  return (
    <Root adapterOptions={{ powerPreference: 'high-performance' }}>
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
    <Portal>
      <div class={ui.backdrop}>
        <div class={ui.card}>
          <button
            class={ui.preview}
            onClick={props.onEnter}
            title="Click to enter"
          >
            <ExamplePreview />
            <div class={ui.overlay}>Click to explore</div>
          </button>

          <div class={ui.content}>
            <div>
              <h1 class={ui.title}>Chaos Master</h1>
              <p class={ui.subtitle}>
                Create beautiful fractal flames with WebGPU
              </p>
            </div>

            <div class={ui.tagline}>
              <h2 class={ui['tagline-title']}>Welcome to Chaos</h2>
              <p class={ui['tagline-body']}>
                Are you ready to create something beautiful?
              </p>
            </div>

            <div class={ui.actions}>
              <label class={ui['dont-show']}>
                <input
                  type="checkbox"
                  checked={props.showDontShowAgain ?? false}
                  onChange={(ev) => {
                    props.onDontShowAgainChange?.(ev.target.checked, ev)
                  }}
                />
                <span>Don't show on startup</span>
              </label>

              <button class={ui['enter-btn']} onClick={props.onEnter}>
                Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
