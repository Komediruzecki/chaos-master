import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { arrayOf, vec2u, vec3f, vec4f } from 'typegpu/data'
import { clamp } from 'typegpu/std'
import { useTimeline } from '@/contexts/TimelineContext'
import { setRenderTimings } from '@/flame/renderStats'
import { createTimestampQuery } from '@/utils/createTimestampQuery'
import { applyTimelineToFlame } from '@/utils/timeline'
import { useCamera } from '../lib/CameraContext'
import { useCanvas } from '../lib/CanvasContext'
import { useRootContext } from '../lib/RootContext'
import { createAnimationFrame } from '../utils/createAnimationFrame'
import { createBlurPipeline } from './blurPipeline'
import { ColorGradingUniforms, createColorGradingPipeline, } from './colorGrading'
import { drawModeToImplFn } from './drawMode'
import { createIFSPipeline } from './ifsPipeline'
import { backgroundColorDefault, backgroundColorDefaultWhite, } from './schema/flameSchema'
import { Bucket } from './types'
import type { v4f } from 'typegpu/data'
import type { Palette } from './colorMap'
import type { FlameDescriptor } from './schema/flameSchema'
import type { ExportImageType } from '@/App'
import type { FlameDescriptor as TimelineFlameDescriptor } from '@/utils/timeline'

const { sqrt, floor } = Math

const OUTPUT_EVERY_FRAME_BATCH_INDEX = 20
const OUTPUT_INTERVAL_BATCH_INDEX = 10

type Flam3Props = {
  quality: number
  pointCountPerBatch: number
  renderInterval: number
  adaptiveFilterEnabled: boolean
  flameDescriptor: FlameDescriptor
  edgeFadeColor: v4f
  onExportImage?: ExportImageType
  setCurrentQuality?: (fn: () => number) => void
  setQualityPointCountLimit?: (fn: () => number) => void
  palette?: Palette
  onEnterAnimation?: () => void
}

export function Flam3(props: Flam3Props) {
  const camera = useCamera()
  const { root, device } = useRootContext()
  const { context, canvasSize, canvas, canvasFormat } = useCanvas()
  const timeline = useTimeline()

  // Add enter animation mode button state (to be implemented in App.tsx)

  // Create a copy of flameDescriptor that timeline will modify
  const [animatedFlame, setAnimatedFlame] =
    createSignal<TimelineFlameDescriptor>(
      JSON.parse(JSON.stringify(props.flameDescriptor)),
    )

  // Apply timeline values to animatedFlame
  createEffect(() => {
    const flame = { ...props.flameDescriptor } as FlameDescriptor
    applyTimelineToFlame(timeline, flame)
    setAnimatedFlame(flame)
  })

  const backgroundColorFinal = () => {
    if (props.flameDescriptor.renderSettings.backgroundColor === undefined) {
      return props.flameDescriptor.renderSettings.drawMode === 'light'
        ? vec3f(...backgroundColorDefault)
        : vec3f(...backgroundColorDefaultWhite)
    }
    return vec3f(...props.flameDescriptor.renderSettings.backgroundColor)
  }

  const bucketProbabilityInv = () => {
    const { height } = canvasSize()
    const unitSquareArea = (height ** 2 * camera.zoom() ** 2) / 4
    return unitSquareArea
  }

  const qualityPointCountLimit = () => {
    const q = props.quality
    return bucketProbabilityInv() / (q ** 2 - 2 * q + 1)
  }

  const [_accumulatedPointCount, _setAccumulatedPointCount] = createSignal(0)
  const [_batchIndex, _setBatchIndex] = createSignal(0)

  props.setCurrentQuality?.(
    () => 1 - sqrt(bucketProbabilityInv() / _accumulatedPointCount()),
  )
  props.setQualityPointCountLimit?.(qualityPointCountLimit)

  const pointRandomSeeds = root
    .createBuffer(arrayOf(vec2u, props.pointCountPerBatch))
    .$usage('storage')

  // Track buffers that need cleanup to avoid destroying while GPU still references them
  const [buffersToCleanup, setBuffersToCleanup] = createSignal<Set<unknown>>(
    new Set(),
  )

  onCleanup(() => {
    // Mark for cleanup after GPU work completes
    setBuffersToCleanup((current) => new Set([...current, pointRandomSeeds]))
  })

  const colorGradingUniforms = root
    .createBuffer(ColorGradingUniforms, {
      averagePointCountPerBucketInv: 0,
      exposure: 1,
      backgroundColor: vec4f(0, 0, 0, 0),
      edgeFadeColor: vec4f(0, 0, 0, 0.8),
      vibrancy: 0.5,
      paletteEntryCount: 0,
    })
    .$usage('uniform')

  onCleanup(() => {
    // Mark for cleanup after GPU work completes
    const current = buffersToCleanup()
    setBuffersToCleanup(new Set([...current, colorGradingUniforms]))
  })

  const outputTextures = createMemo(() => {
    const { width, height } = canvasSize()
    if (width * height === 0) {
      return
    }

    const accumulationBuffer = root
      .createBuffer(arrayOf(Bucket, width * height))
      .$usage('storage')

    const postprocessBuffer = root
      .createBuffer(arrayOf(Bucket, width * height))
      .$usage('storage')

    return {
      accumulationBuffer,
      postprocessBuffer,
      textureSize: [width, height] as const,
    }
  })

  // Properly clean up buffers after GPU work completes
  createEffect(() => {
    const buffers = buffersToCleanup()
    if (buffers.size === 0) return

    void device.queue.onSubmittedWorkDone().then(() => {
      buffers.forEach((buffer: unknown) => {
        try {
          ;(buffer as { destroy: () => void }).destroy()
        } catch (_e) {
          // Ignore cleanup errors
        }
      })
      setBuffersToCleanup(new Set())
    })
  })

  const colorGradingPipeline = createMemo(() => {
    const o = outputTextures()
    if (!o) {
      return undefined
    }
    const { textureSize, postprocessBuffer, accumulationBuffer } = o
    return createColorGradingPipeline(
      root,
      colorGradingUniforms,
      textureSize,
      props.adaptiveFilterEnabled ? postprocessBuffer : accumulationBuffer,
      canvasFormat,
      drawModeToImplFn[props.flameDescriptor.renderSettings.drawMode],
      props.palette,
    )
  })

  const runBlur = createMemo(() => {
    const o = outputTextures()
    if (!o) {
      return undefined
    }
    const { textureSize, accumulationBuffer, postprocessBuffer } = o
    return createBlurPipeline(
      root,
      textureSize,
      accumulationBuffer,
      postprocessBuffer,
    )
  })

  const continueRendering = (accumulatedPointCount: number) => {
    return accumulatedPointCount <= qualityPointCountLimit()
  }

  const timestampQuery = createTimestampQuery(device, [
    'ifsMs',
    'adaptiveFilterMs',
    'colorGradingMs',
  ])

  /**
   * Timeline animation playback loop.
   * When isPlaying is true, advances the frame at the configured FPS rate.
   */
  createEffect(() => {
    if (!timeline.isPlaying()) return

    const intervalMs = 1000 / timeline.config().fps
    const intervalId = window.setInterval(() => {
      timeline.advanceFrame()
    }, intervalMs)

    onCleanup(() => {
      clearInterval(intervalId)
    })
  })

  function estimateIterationCount(
    timings: NonNullable<ReturnType<typeof timestampQuery.average>>,
    shouldRenderFinalImage: boolean,
  ) {
    const { ifsMs, adaptiveFilterMs, colorGradingMs } = timings
    if (ifsMs <= 0) {
      return 1
    }
    const frameBudgetMs = 14
    const paintTimeMs =
      Number(shouldRenderFinalImage) *
      (colorGradingMs + Number(props.adaptiveFilterEnabled) * adaptiveFilterMs)
    const result = clamp(floor((frameBudgetMs - paintTimeMs) / ifsMs), 1, 100)
    return result
  }

  createEffect(() => {
    const o = outputTextures()
    if (!o) {
      return undefined
    }

    const { textureSize, accumulationBuffer } = o

    const ifsPipeline = createIFSPipeline(
      root,
      camera,
      animatedFlame().renderSettings.skipIters,
      pointRandomSeeds,
      animatedFlame().transforms as never,
      textureSize,
      accumulationBuffer,
      animatedFlame().renderSettings.colorInitMode,
      animatedFlame().renderSettings.pointInitMode,
    )

    createEffect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ifsPipeline.update(animatedFlame() as any)
      camera.update()
    })

    createEffect(() => {
      colorGradingUniforms.writePartial({
        exposure: 2 * Math.exp(animatedFlame().renderSettings.exposure),
        edgeFadeColor: props.onExportImage ? vec4f(0) : props.edgeFadeColor,
        backgroundColor: vec4f(backgroundColorFinal(), 1),
        vibrancy: animatedFlame().renderSettings.vibrancy,
        paletteEntryCount: props.palette?.entries.length ?? 0,
      })
    })

    createEffect(() => {
      const _ = colorGradingPipeline()
      void props.palette // track palette changes
    })

    const [forceDrawToScreen, setForceDrawToScreen] = createSignal(true)
    const [clearRequested, setClearRequested] = createSignal(true)
    const [_batchIndex, _setBatchIndex] = createSignal(0)
    const [_accumulatedPointCount, _setAccumulatedPointCount] = createSignal(0)

    createAnimationFrame(
      (frameId: number) => {
        /**
         * Rendering to screen is expensive because it involves
         * blurring and color grading. We only want to do this
         * in the beginning while the image is still forming.
         * Later on, we can trade off rendering to screen for
         * convergence speed.
         */
        const shouldRenderFinalImage =
          forceDrawToScreen() ||
          _batchIndex() < OUTPUT_EVERY_FRAME_BATCH_INDEX ||
          _batchIndex() % OUTPUT_INTERVAL_BATCH_INDEX === 0 ||
          props.onExportImage !== undefined

        const pointCountPerBatch = props.pointCountPerBatch
        const colorGradingPipeline_ = colorGradingPipeline()
        if (colorGradingPipeline_ === undefined) {
          return
        }

        const encoder = device.createCommandEncoder()

        if (clearRequested()) {
          encoder.clearBuffer(accumulationBuffer.buffer)
          setClearRequested(false)
        }

        const timings = timestampQuery.average()
        const iterationCount = continueRendering(_accumulatedPointCount())
          ? timings
            ? estimateIterationCount(timings, shouldRenderFinalImage)
            : 1
          : 0

        if (timings) {
          setRenderTimings({
            ...timings,
            adaptiveFilterMs: props.adaptiveFilterEnabled
              ? timings.adaptiveFilterMs
              : 0,
          })
        }

        const timestampWrites = timestampQuery.timestampWrites(frameId)

        {
          for (let i = 0; i < iterationCount; i++) {
            const pass = encoder.beginComputePass({
              timestampWrites: timestampWrites.ifsMs,
            })
            ifsPipeline.run(pass, pointCountPerBatch)
            pass.end()
          }

          _setAccumulatedPointCount(
            _accumulatedPointCount() + pointCountPerBatch * iterationCount,
          )
        }

        if (shouldRenderFinalImage) {
          colorGradingUniforms.writePartial({
            averagePointCountPerBucketInv:
              bucketProbabilityInv() / _accumulatedPointCount(),
          })
          if (props.adaptiveFilterEnabled) {
            const pass = encoder.beginComputePass({
              timestampWrites: timestampWrites.adaptiveFilterMs,
            })
            runBlur()?.(pass)
            pass.end()
          }

          {
            const pass = encoder.beginRenderPass({
              timestampWrites: timestampWrites.colorGradingMs,
              colorAttachments: [
                {
                  loadOp: 'clear',
                  storeOp: 'store',
                  view: context.getCurrentTexture().createView(),
                },
              ],
            })
            colorGradingPipeline_.run(pass)
            pass.end()
          }
        }

        timestampQuery.write(encoder)
        device.queue.submit([encoder.finish()])

        // Mark buffers for cleanup after GPU work completes
        device.queue
          .onSubmittedWorkDone()
          .then(() => {
            const currentBuffers =
              outputTextures()?.accumulationBuffer ||
              outputTextures()?.postprocessBuffer
            if (currentBuffers) {
              const cleanupSet = buffersToCleanup()
              setBuffersToCleanup(new Set([...cleanupSet, currentBuffers]))
            }
            timestampQuery.read(frameId).catch(() => {})
          })
          .catch(() => {})

        props.onExportImage?.(canvas)

        _setBatchIndex(_batchIndex() + 1)
        setForceDrawToScreen(false)
      },
      continueRendering(_accumulatedPointCount())
        ? () => props.renderInterval
        : 0,
      () => Promise.resolve(device.queue.onSubmittedWorkDone()),
    )
  })
  return null
}
