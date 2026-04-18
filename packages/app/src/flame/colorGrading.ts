import { oklabToRgb } from '@typegpu/color'
import { onCleanup } from 'solid-js'
import { tgpu } from 'typegpu'
import { arrayOf, builtin, f32, i32, struct, texture1d, vec2f, vec2i, vec3f, vec4f, } from 'typegpu/data'
import { abs, add, clamp, div, log, max, mix, mul, pow, saturate, smoothstep, sub, textureSample, } from 'typegpu/std'
import { Bucket, BUCKET_FIXED_POINT_MULTIPLIER_INV } from './types'
import type { LayoutEntryToInput, TgpuRoot } from 'typegpu'
import type { Palette } from './colorMap'
import type { DrawModeFn } from './drawMode'

export const ColorGradingUniforms = struct({
  averagePointCountPerBucketInv: f32,
  exposure: f32,
  backgroundColor: vec4f,
  /** Adds a slight fade towards the edge of the viewport */
  edgeFadeColor: vec4f,
  /** Vibrancy: 0 = none, 1 = full saturation boost in dense regions */
  vibrancy: f32,
  /** Number of palette entries */
  paletteEntryCount: i32,
  /** Palette texture width (1D texture dimensions) */
  paletteTextureWidth: i32,
})

/** Palette entry as stored in the 1D texture (RGBA32F: R=a, G=b, B=unused, A=position) */
const bindGroupLayout = tgpu.bindGroupLayout({
  uniforms: {
    uniform: ColorGradingUniforms,
  },
  textureSize: {
    uniform: vec2i,
  },
  accumulationBuffer: {
    storage: arrayOf(Bucket),
    access: 'readonly',
  },
  paletteTexture: {
    texture: texture1d(),
  },
  paletteSampler: {
    sampler: 'filtering',
  },
})

export function createColorGradingPipeline(
  root: TgpuRoot,
  uniforms: LayoutEntryToInput<(typeof bindGroupLayout)['entries']['uniforms']>,
  textureSize: readonly [number, number],
  accumulationBuffer: LayoutEntryToInput<
    (typeof bindGroupLayout)['entries']['accumulationBuffer']
  >,
  canvasFormat: GPUTextureFormat,
  drawMode: DrawModeFn,
  palette: Palette | undefined,
) {
  const textureSizeBuffer = root
    .createBuffer(vec2i, vec2i(...textureSize))
    .$usage('uniform')

  onCleanup(() => {
    textureSizeBuffer.destroy()
  })

  // Palette sampler is always needed — texture/sampler are only sampled when paletteEntryCount > 0
  const paletteSampler = root['~unstable'].createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let paletteTextureView: any = undefined

  if (palette) {
    const tex = root['~unstable']
      .createTexture({
        size: [palette.entries.length, 1],
        format: 'rgba32float',
        dimension: '1d',
      })
      .$usage('sampled')

    // Write palette data to texture
    const data = new Float32Array(palette.entries.length * 4)
    const sorted = [...palette.entries].sort((a, b) => a.position - b.position)
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i]!
      data[i * 4 + 0] = entry.a
      data[i * 4 + 1] = entry.b
      data[i * 4 + 2] = 0
      data[i * 4 + 3] = entry.position
    }
    tex.write(data)
    paletteTextureView = tex.createView()

    onCleanup(() => {
      tex.destroy()
    })
  }

  const bindGroup = root.createBindGroup(bindGroupLayout, {
    uniforms,
    accumulationBuffer,
    textureSize: textureSizeBuffer,
    paletteTexture: paletteTextureView,
    paletteSampler,
  })

  const VertexOutput = {
    pos: builtin.position,
    uv: vec2f,
  }

  const vertex = tgpu.vertexFn({
    in: { vertexIndex: builtin.vertexIndex },
    out: VertexOutput,
  })(({ vertexIndex }) => {
    const pos = [vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3)]
    return {
      pos: vec4f(pos[vertexIndex]!, 0.0, 1.0),
      uv: pos[vertexIndex]!,
    }
  })

  const fragment = tgpu.fragmentFn({
    in: VertexOutput,
    out: vec4f,
  })(({ pos, uv }) => {
    'use gpu'
    const uniforms = bindGroupLayout.$.uniforms
    const textureSize = bindGroupLayout.$.textureSize
    const accumulationBuffer = bindGroupLayout.$.accumulationBuffer
    const paletteTexture = bindGroupLayout.$.paletteTexture
    const paletteSampler = bindGroupLayout.$.paletteSampler

    const edgeFade =
      uniforms.edgeFadeColor.a * smoothstep(0.98, 1, max(abs(uv.x), abs(uv.y)))
    const backgroundColor = mix(
      uniforms.backgroundColor,
      uniforms.edgeFadeColor,
      edgeFade,
    )
    const pos2i = vec2i(pos.xy)
    const texelIndex = pos2i.y * textureSize.x + pos2i.x
    const tex = accumulationBuffer[texelIndex]!
    const count = f32(tex.count) * BUCKET_FIXED_POINT_MULTIPLIER_INV
    const texColorAb = div(
      mul(
        vec2f(f32(tex.color.a), f32(tex.color.b)),
        BUCKET_FIXED_POINT_MULTIPLIER_INV,
      ),
      max(count, f32(1)),
    )

    // density: normalized count where PREFILTER_WHITE=255 marks a "full" texel.
    // averagePointCountPerBucketInv = unitSquareArea / accumulatedPointCount.
    // This means density=1.0 when the bucket has average hit count.
    const density = div(
      mul(count, uniforms.averagePointCountPerBucketInv),
      f32(255),
    )

    let finalAb = texColorAb
    if (uniforms.paletteEntryCount > i32(0) && uniforms.vibrancy > f32(0)) {
      // Log-density index for palette sampling.
      // count is in [0, ∞). We map it to [0, 1] for palette lookup.
      // log(count + 1) is in [0, ∞). We scale by a factor so that the
      // typical density range maps to interesting parts of the palette.
      // A count equal to the average bucket count (density=1) should sample
      // near the center of the palette (position 0.5).
      const logDensity = clamp(log(add(count, f32(1))), f32(0), f32(10))
      const paletteScale = f32(0.1)
      const logDensityNorm = clamp(
        mul(logDensity, paletteScale),
        f32(0),
        f32(1),
      )

      // Sample palette by log-density (using linear sampler for smooth gradients)
      // textureSample returns vec4f which maps to (R=a, G=b, B=?, A=position)
      const paletteSample = textureSample(
        paletteTexture,
        paletteSampler,
        logDensityNorm,
      )
      const paletteAb = vec2f(paletteSample.x, paletteSample.y)

      // Calculate alpha for vibrancy blend factor
      const gamma = f32(0.5)
      const linrange = f32(1.0)
      const frac = div(density, linrange)
      const funcval = pow(linrange, gamma)
      const baseAlpha = add(
        mul(mul(sub(f32(1), frac), density), div(funcval, linrange)),
        mul(frac, pow(density, gamma)),
      )

      // Interpolate between texel-averaged color and palette-sampled color
      // Palette samples provide better color depth awareness
      const paletteBlend = clamp(
        mul(uniforms.vibrancy, saturate(baseAlpha)),
        f32(0),
        f32(1),
      )
      finalAb = mix(texColorAb, paletteAb, paletteBlend)
    }

    // Brightness from log-count
    const adjustedCount = mul(
      mul(count, uniforms.averagePointCountPerBucketInv),
      f32(0.1),
    )
    const value = uniforms.exposure * pow(log(adjustedCount + 1), 0.4545)

    const rgb = saturate(oklabToRgb(vec3f(drawMode(value), finalAb)))
    const alpha = saturate(value) * (1 - edgeFade)
    const rgba = vec4f(rgb, alpha)
    return mix(backgroundColor, rgba, alpha)
  })

  const renderPipeline = root
    .createRenderPipeline({
      vertex,
      fragment,
      targets: { format: canvasFormat },
    })
    .with(bindGroup)

  return {
    run: (pass: GPURenderPassEncoder) => {
      renderPipeline.with(pass).draw(3)
    },
  }
}
