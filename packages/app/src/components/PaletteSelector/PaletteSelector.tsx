import { createSignal, For, Show } from 'solid-js'
import { deleteCustomPalette, loadCustomPalettes, saveCustomPalettes, } from '@/flame/colorMap'
import { getAllPalettes, paletteToGradientCSS } from '@/flame/palettes'
import ui from './PaletteSelector.module.css'
import type { Palette } from '@/flame/colorMap'

type PaletteSelectorProps = {
  selectedPaletteId: string
  onSelect: (palette: Palette) => void
  onEditCustom?: (palette: Palette) => void
}

export function PaletteSelector(props: PaletteSelectorProps) {
  const [showCustom, setShowCustom] = createSignal(false)
  const [_forceUpdate, setForceUpdate] = createSignal(0)

  const customPalettes = () => {
    void _forceUpdate()
    return loadCustomPalettes()
  }
  const allPalettes = () => {
    void _forceUpdate()
    return getAllPalettes(customPalettes())
  }

  const handleDelete = (e: MouseEvent, palette: Palette) => {
    e.stopPropagation()
    if (palette.source !== 'custom' && palette.source !== 'imported') return
    if (!confirm(`Delete palette "${palette.name}"?`)) return
    deleteCustomPalette(palette.id)
    setForceUpdate((n) => n + 1)
  }

  const handleImportPalettes = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,application/xml,text/xml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const { parseFlam3Palettes, flam3PaletteToPalette } =
          await import('@/flame/flam3PaletteParser')
        const flam3Palettes = parseFlam3Palettes(text)
        const palettes = flam3Palettes.map(flam3PaletteToPalette)

        const existing = loadCustomPalettes()
        saveCustomPalettes([...existing, ...palettes])
        setForceUpdate((n) => n + 1)
        console.info(`Imported ${palettes.length} palettes from ${file.name}`)
      } catch (err) {
        console.error('Failed to import palettes:', err)
      }
    }
    input.click()
  }

  return (
    <div class={ui.selector}>
      <div class={ui.header}>
        <span class={ui.label}>Palettes</span>
        <span class={ui.count}>{allPalettes().length}</span>
      </div>

      <div class={ui.gallery}>
        {/* Custom palette option */}
        <button
          class={ui.paletteButton}
          classList={{
            [ui.selected as string]: props.selectedPaletteId === 'custom',
          }}
          onClick={() => {
            setShowCustom(!showCustom())
          }}
          title="Create or edit custom palette"
        >
          <div class={ui.previewCustom}>
            <span class={ui.customIcon}>+</span>
          </div>
          <span class={ui.name}>Custom</span>
        </button>

        <For each={allPalettes()}>
          {(palette) => (
            <button
              class={ui.paletteButton}
              classList={{
                [ui.selected as string]: props.selectedPaletteId === palette.id,
              }}
              onClick={() => {
                props.onSelect(palette)
              }}
              title={palette.name}
            >
              <div
                class={ui.preview}
                style={{ background: paletteToGradientCSS(palette) }}
              />
              <span class={ui.name}>{palette.name}</span>

              {/* Delete button for custom/imported palettes */}
              <Show
                when={
                  palette.source === 'custom' || palette.source === 'imported'
                }
              >
                <button
                  class={ui.deleteBtn}
                  onClick={(e) => {
                    handleDelete(e, palette)
                  }}
                  title="Delete palette"
                >
                  ×
                </button>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Import button */}
      <button class={ui.importBtn} onClick={handleImportPalettes}>
        Import flam3 Palettes
      </button>

      <Show when={showCustom()}>
        <div class={ui.customSection}>
          <div class={ui.customHeader}>Custom Palette Editor</div>
          <p class={ui.customHint}>
            Click on the gradient below to add color stops. Drag stops to
            reposition, click to edit.
          </p>
          {/* Placeholder for future custom palette editor */}
          <div class={ui.customPlaceholder}>
            Custom palette editor coming soon
          </div>
        </div>
      </Show>
    </div>
  )
}
