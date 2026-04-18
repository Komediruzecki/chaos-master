import { oklabToRgb } from '@typegpu/color'
import { onCleanup } from 'solid-js'
import { tgpu } from 'typegpu'
import { arrayOf, builtin, f32, struct, vec2f, vec2i, vec3f, vec4f, } from 'typegpu/data'
import { abs, add, clamp, div, log, max, mix, mul, pow, saturate, smoothstep, } from 'typegpu/std'
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
    const adjustedCount = 0.1 * count * uniforms.averagePointCountPerBucketInv

    // Apply vibrancy: boost saturation in denser regions
    // Based on flam3_calc_alpha from flam3/palettes.c
    // Density normalized to 0-1 range where 1 is very dense
    const density = clamp(adjustedCount * 10, 0, 1)
    const gamma = 0.5 // gamma=0.5 makes dense areas more vibrant
    const linrange = 1.0
    const funcval = pow(linrange, gamma)
    let vibrancyMultiplier = f32(1)
    if (density > 0 && uniforms.vibrancy > 0) {
      // interpolation formula matches C flam3_calc_alpha
      const frac = density / linrange
      const baseAlpha =
        (1 - frac) * density * (funcval / linrange) + frac * pow(density, gamma)
      // Scale ab by baseAlpha, boosted by vibrancy uniform (0-1)
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
