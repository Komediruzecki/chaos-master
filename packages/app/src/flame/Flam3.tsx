import { createEffect, createMemo, createSignal,onCleanup } from 'solid-js'
import { arrayOf, vec2u, vec3f, vec4f } from 'typegpu/data'
import { clamp } from 'typegpu/std'
import { useTimeline } from '@/contexts/TimelineContext'
import { accumulatedPointCount, setAccumulatedPointCount, setRenderTimings, } from '@/flame/renderStats'
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
import type {FlameDescriptor as TimelineFlameDescriptor} from '@/utils/timeline';

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
}

export function Flam3(props: Flam3Props) {
  const camera = useCamera()
  const { root, device } = useRootContext()
  const { context, canvasSize, canvas, canvasFormat } = useCanvas()
  const timeline = useTimeline()

  // Create a copy of flameDescriptor that timeline will modify
  const [animatedFlame, setAnimatedFlame] = createSignal<TimelineFlameDescriptor>(
    JSON.parse(JSON.stringify(props.flameDescriptor))
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

  props.setCurrentQuality?.(
    () => 1 - sqrt(bucketProbabilityInv() / accumulatedPointCount()),
  )
  props.setQualityPointCountLimit?.(qualityPointCountLimit)

  const pointRandomSeeds = root
    .createBuffer(arrayOf(vec2u, props.pointCountPerBatch))
    .$usage('storage')

  onCleanup(() => {
    pointRandomSeeds.destroy()
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
    colorGradingUniforms.destroy()
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

    onCleanup(() => {
      accumulationBuffer.destroy()
      postprocessBuffer.destroy()
    })

    return {
      accumulationBuffer,
      postprocessBuffer,
      textureSize: [width, height] as const,
    }
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

  const currentBatchIndex = batchIndex()
  const currentAccumulatedPointCount = accumulatedPointCount()
  const currentForceDrawToScreen = forceDrawToScreen()
  const currentClearRequested = clearRequested()

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

    console.log('[Flam3] Animation playback started')

    onCleanup(() => {
      clearInterval(intervalId)
    })
  })

  function estimateIterationCount(
    timings: NonNullable<ReturnType<typeof timestampQuery.average>>,
    shouldRenderFinalImage: boolean,
  ) {
    const { ifsMs, adaptiveFilterMs, colorGradingMs } = timings
    console.log('[Flam3] Estimating iterations, ifsMs:', ifsMs, 'shouldRenderFinalImage:', shouldRenderFinalImage)
    if (ifsMs <= 0) {
      console.log('[Flam3] ifsMs <= 0, returning 1')
      return 1
    }
    const frameBudgetMs = 14
    const paintTimeMs =
      Number(shouldRenderFinalImage) *
      (colorGradingMs + Number(props.adaptiveFilterEnabled) * adaptiveFilterMs)
    console.log('[Flam3] paintTimeMs:', paintTimeMs, 'frameBudgetMs:', frameBudgetMs)
    const result = clamp(floor((frameBudgetMs - paintTimeMs) / ifsMs), 1, 100)
    console.log('[Flam3] Returning iteration count:', result)
    return result
  }

  createEffect(() => {
    console.log('[Flam3] outputTextures effect triggered')
    const o = outputTextures()
    console.log('[Flam3] outputTextures() returned:', o)
    if (!o) {
      console.log('[Flam3] No output textures available')
      return undefined
    }

    const { textureSize, accumulationBuffer } = o
    console.log('[Flam3] Creating pipeline with camera:', camera, 'animatedFlame:', animatedFlame(), 'canvasSize:', canvasSize())

    const ifsPipeline = createIFSPipeline(
      root,
      camera,
      animatedFlame().renderSettings.skipIters,
      pointRandomSeeds,
      animatedFlame().transforms,
      textureSize,
      accumulationBuffer,
      animatedFlame().renderSettings.colorInitMode,
      animatedFlame().renderSettings.pointInitMode,
    )

    let batchIndex = 0
    let accumulatedPointCount = 0
    let forceDrawToScreen = true
    let clearRequested = true

    createEffect(() => {
      console.log('[Flam3] Pipeline update effect triggered, animatedFlame:', animatedFlame())
      ifsPipeline.update(animatedFlame())
      camera.update()
      setBatchIndex(0)
      setAccumulatedPointCount(0)
      setClearRequested(true)
    })

    createEffect(() => {
      console.log('[Flam3] Uniforms write effect triggered')
      colorGradingUniforms.writePartial({
        exposure: 2 * Math.exp(animatedFlame().renderSettings.exposure),
        edgeFadeColor: props.onExportImage ? vec4f(0) : props.edgeFadeColor,
        backgroundColor: vec4f(backgroundColorFinal(), 1),
        vibrancy: animatedFlame().renderSettings.vibrancy,
        paletteEntryCount: props.palette?.entries.length ?? 0,
      })
      forceDrawToScreen = true
    })

    createEffect(() => {
      console.log('[Flam3] Color grading pipeline change detected')
      // redraw when these change
      const _ = colorGradingPipeline()
      void props.palette // track palette changes
    })

    console.log('[Flam3] RAF loop creation starting')
    const [batchIndex, setBatchIndex] = createSignal(0)
    const [accumulatedPointCount, setAccumulatedPointCount] = createSignal(0)
    const [forceDrawToScreen, setForceDrawToScreen] = createSignal(true)
    const [clearRequested, setClearRequested] = createSignal(true)

    let frameCount = 0
    const rafLoop = createAnimationFrame((frameId) => {
      frameCount++
      console.log(`[Flam3] RAF loop callback executing, frame: ${frameCount}`)
      (frameId) => {
        /**
         * Rendering to screen is expensive because it involves
         * blurring and color grading. We only want to do this
         * in the beginning while the image is still forming.
         * Later on, we can trade off rendering to screen for
         * convergence speed.
         */
        const shouldRenderFinalImage =
          currentForceDrawToScreen ||
          currentBatchIndex < OUTPUT_EVERY_FRAME_BATCH_INDEX ||
          currentBatchIndex % OUTPUT_INTERVAL_BATCH_INDEX === 0 ||
          props.onExportImage !== undefined

        const pointCountPerBatch = props.pointCountPerBatch
        const colorGradingPipeline_ = colorGradingPipeline()
        if (colorGradingPipeline_ === undefined) {
          return
        }

        const encoder = device.createCommandEncoder()

        if (currentClearRequested) {
          setClearRequested(false)
          encoder.clearBuffer(accumulationBuffer.buffer)
        }

        const timings = timestampQuery.average()
        const iterationCount = continueRendering(currentAccumulatedPointCount)
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

          setAccumulatedPointCount(
            currentAccumulatedPointCount + pointCountPerBatch * iterationCount
          )
        }

        if (shouldRenderFinalImage) {
          colorGradingUniforms.writePartial({
            averagePointCountPerBucketInv:
              bucketProbabilityInv() / currentAccumulatedPointCount,
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

        device.queue
          .onSubmittedWorkDone()
          .then(() => timestampQuery.read(frameId))
          .catch(() => {})
        props.onExportImage?.(canvas)

        setBatchIndex(currentBatchIndex + 1)
        setForceDrawToScreen(false)
      },
      () => continueRendering(accumulatedPointCount) ? () => props.renderInterval : () => Infinity,
      () => device.queue.onSubmittedWorkDone(),
    )
  })
  return null
}
