import { createSignal, For, onMount } from 'solid-js'
import { vec2f,vec4f } from 'typegpu/data'
import { DEFAULT_QUALITY } from '@/defaults'
import { examples } from '@/flame/examples'
import { Flam3 } from '@/flame/Flam3'
import { Cross } from '@/icons'
import { AutoCanvas } from '@/lib/AutoCanvas'
import { Camera2D } from '@/lib/Camera2D'
import { Root } from '@/lib/Root'
import { deleteRecentFlame,loadRecentFlames } from '@/utils/recentFlames'
import { recordEntries } from '@/utils/record'
import { Button } from '../Button/Button'
import { Checkbox } from '../Checkbox/Checkbox'
import { Card } from '../ControlCard/ControlCard'
import { DelayedShow } from '../DelayedShow/DelayedShow'
import { createLoadFlame } from '../LoadFlameModal/LoadFlameModal'
import ui from './WelcomeScreen.module.css'
import type { FlameDescriptor } from '@/flame/schema/flameSchema'
import type { ChangeHistory } from '@/utils/createStoreHistory'
import type { RecentFlame } from '@/utils/recentFlames'

const tips = [
  {
    title: 'Add Variation Types',
    body: 'Click on a variation name to open the selector and browse 40+ variation types. Mix and match them to create unique patterns.',
  },
  {
    title: 'Tune the Probability',
    body: 'Adjust the probability slider to control how often each transform is selected. Probabilities should sum to 1 for balanced results.',
  },
  {
    title: 'Adjust Exposure',
    body: 'Use the Exposure slider to brighten or darken your flame. Values between -1 and 1 usually work best.',
  },
  {
    title: 'Transform the Canvas',
    body: 'Right-click and drag to pan the camera. Scroll to zoom. These affine transforms shape how each variation affects the final image.',
  },
  {
    title: 'Share Your Creations',
    body: 'Click "Share Link" to copy a URL containing your flame. Or export as PNG to save the rendered image with embedded flame data.',
  },
  {
    title: 'Load Examples',
    body: "Click \"Load Flame\" to browse built-in examples. Each one demonstrates different variation combinations and settings.",
  },
]

type WelcomeScreenProps = {
  onLoadFlame: (flame: FlameDescriptor) => void
  onNewFlame: () => void
  history: ChangeHistory<FlameDescriptor>
  showDontShowAgain?: boolean
  onDontShowAgainChange?: (checked: boolean, ev: Event) => void
}

function FlamePreview(props: { flameDescriptor: FlameDescriptor }) {
  return (
    <Root
      adapterOptions={{
        powerPreference: 'high-performance',
      }}
    >
      <AutoCanvas pixelRatio={1}>
        <Camera2D
          position={vec2f(
            ...props.flameDescriptor.renderSettings.camera.position,
          )}
          zoom={props.flameDescriptor.renderSettings.camera.zoom}
        >
          <Flam3
            quality={DEFAULT_QUALITY}
            pointCountPerBatch={2e4}
            adaptiveFilterEnabled={true}
            flameDescriptor={props.flameDescriptor}
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
  const [recentFlames, setRecentFlames] = createSignal<RecentFlame[]>([])
  const { showLoadFlameModal } = createLoadFlame(props.history)

  onMount(() => {
    setRecentFlames(loadRecentFlames())
  })

  function refreshRecentFlames() {
    setRecentFlames(loadRecentFlames())
  }

  function handleDeleteRecent(e: MouseEvent, id: string) {
    e.stopPropagation()
    deleteRecentFlame(id)
    refreshRecentFlames()
  }

  function formatDate(timestamp: number) {
    const d = new Date(timestamp)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div class={ui['welcome-screen']}>
      <section class={ui['logo-section']}>
        <h1 class={ui['logo-title']}>Chaos Master</h1>
        <p class={ui['logo-subtitle']}>
          Create beautiful fractal flames with WebGPU
        </p>
        <div class={ui['quick-actions']}>
          <Button
            class={ui['quick-action-button']}
            onClick={props.onNewFlame}
          >
            New Flame
          </Button>
          <Button
            class={ui['quick-action-button']}
            onClick={async () => {
              const result = await showLoadFlameModal()
              if (result !== undefined) {
                props.onLoadFlame(result)
              }
            }}
          >
            Load Flame
          </Button>
        </div>
      </section>

      <section class={ui['section']}>
        <div class={ui['section-header']}>
          <h2 class={ui['section-title']}>Recent Flames</h2>
        </div>
        <div class={ui['gallery']}>
          {recentFlames().length === 0 && (
            <p class={ui['gallery-empty']}>
              No recent flames yet. Export a PNG or save a flame to see it
              here.
            </p>
          )}
          <For each={recentFlames()}>
            {(recent, i) => (
              <button
                class={ui['item']}
                onClick={() => {
                  props.onLoadFlame(recent.flame)
                }}
              >
                <DelayedShow delayMs={i() * 30}>
                  <FlamePreview flameDescriptor={recent.flame} />
                </DelayedShow>
                <div class={ui['item-title']}>
                  <span class={ui['item-name']}>{recent.name}</span>
                  <span class={ui['item-date']}>{formatDate(recent.savedAt)}</span>
                </div>
                <span
                  class={ui['delete-button']}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    handleDeleteRecent(e, recent.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleDeleteRecent(e as unknown as MouseEvent, recent.id)
                    }
                  }}
                  title="Delete"
                >
                  <Cross />
                </span>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class={ui['section']}>
        <div class={ui['section-header']}>
          <h2 class={ui['section-title']}>Example Gallery</h2>
        </div>
        <div class={ui['gallery']}>
          <For each={recordEntries(examples)}>
            {([exampleId, example], i) => (
              <button
                class={ui['item']}
                onClick={() => {
                  props.onLoadFlame(example)
                }}
              >
                <DelayedShow delayMs={i() * 50}>
                  <FlamePreview flameDescriptor={example} />
                </DelayedShow>
                <div class={ui['item-title']}>
                  <span class={ui['item-name']}>{exampleId}</span>
                </div>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class={ui['section']}>
        <h2 class={ui['section-title']}>Tips</h2>
        <div class={ui['tips-grid']}>
          <For each={tips}>
            {(tip) => (
              <Card class={ui['tip-card']}>
                <h3 class={ui['tip-title']}>{tip.title}</h3>
                <p class={ui['tip-body']}>{tip.body}</p>
              </Card>
            )}
          </For>
        </div>
      </section>

      <section class={ui['about-section']}>
        <label class={ui['dont-show-again']}>
          <Checkbox
            checked={props.showDontShowAgain ?? false}
            onChange={props.onDontShowAgainChange ?? (() => {})}
          />
          <span>Don't show on startup</span>
        </label>
        <a
          href="https://github.com/chaos-matters/chaos-master"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </section>
    </div>
  )
}
