import { oklabToRgb } from '@typegpu/color'
import { onCleanup } from 'solid-js'
import { tgpu } from 'typegpu'
import { arrayOf, builtin, f32, struct, vec2f, vec2i, vec3f, vec4f, } from 'typegpu/data'
import { abs, add, clamp, div, log, max, mix, mul, pow, saturate, smoothstep, sub, } from 'typegpu/std'
import { Bucket, BUCKET_FIXED_POINT_MULTIPLIER_INV } from './types'
import type { LayoutEntryToInput, TgpuRoot } from 'typegpu'
import type { DrawModeFn } from './drawMode'

export const ColorGradingUniforms = struct({
  averagePointCountPerBucketInv: f32,
  exposure: f32,
  backgroundColor: vec4f,
  /** Adds a slight fade towards the edge of the viewport */
  edgeFadeColor: vec4f,
  /** Vibrancy: 0 = none, 1 = full saturation boost in dense regions */
  vibrancy: f32,
})

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
) {
  const textureSizeBuffer = root
    .createBuffer(vec2i, vec2i(...textureSize))
    .$usage('uniform')

  onCleanup(() => {
    textureSizeBuffer.destroy()
  })

  const bindGroup = root.createBindGroup(bindGroupLayout, {
    uniforms,
    accumulationBuffer,
    textureSize: textureSizeBuffer,
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
    const uniforms = bindGroupLayout.$.uniforms
    const textureSize = bindGroupLayout.$.textureSize
    const accumulationBuffer = bindGroupLayout.$.accumulationBuffer
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
    const ab = div(
      mul(
        vec2f(f32(tex.color.a), f32(tex.color.b)),
        BUCKET_FIXED_POINT_MULTIPLIER_INV,
      ),
      count,
    )
    // Density: normalized count where PREFILTER_WHITE=255 marks a "full" texel.
    // averagePointCountPerBucketInv = unitSquareArea / accumulatedPointCount.
    // This means density=1.0 when the bucket has average hit count.
    const density = div(
      mul(count, uniforms.averagePointCountPerBucketInv),
      f32(255),
    )

    // adjustedCount is still used for the brightness/value calculation below
    const adjustedCount = mul(
      mul(count, uniforms.averagePointCountPerBucketInv),
      f32(0.1),
    )

    // Apply vibrancy: boost saturation in denser regions.
    // Port of flam3_calc_alpha from flam3/palettes.c.
    // alpha = (1-frac)*density*(funcval/linrange) + frac*density^gamma  (for density < linrange)
    // alpha = density^gamma  (for density >= linrange)
    // vibrancy multiplies the chroma by (1 + vibrancy * alpha) — at vibrancy=1, alpha=1, chroma doubles.
    const gamma = f32(0.5)
    const linrange = f32(1.0)
    const frac = div(density, linrange)
    const funcval = pow(linrange, gamma)
    const baseAlpha = add(
      mul(
        mul(sub(f32(1), frac), density),
        div(funcval, linrange),
      ),
      mul(frac, pow(density, gamma)),
    )
    let vibrancyMultiplier = f32(1)
    if (density > f32(0) && uniforms.vibrancy > f32(0)) {
      vibrancyMultiplier = add(
        f32(1),
        mul(uniforms.vibrancy, saturate(baseAlpha)),
      )
    }

    const value = uniforms.exposure * pow(log(adjustedCount + 1), 0.4545)
    // Apply vibrancy multiplier to the color's saturation (ab channel)
    const vibrantAb = mul(ab, vibrancyMultiplier)
    const rgb = saturate(oklabToRgb(vec3f(drawMode(value), vibrantAb)))
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
