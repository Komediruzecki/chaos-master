/**
 * Decompress a flame descriptor from a compressed + base64url-encoded string.
 * Matches the encoding used by the main app in packages/app/src/utils/jsonQueryParam.ts.
 *
 * The main app uses CompressionStream('deflate') + base64url encoding.
 * Note: the deflate format is the "raw" deflate format (no zlib header),
 * which is what CompressionStream produces.
 */

import type { FlameDescriptor } from '../types/flameDescriptor'

/**
 * Decompress a raw deflate byte stream into a FlameDescriptor.
 * Uses Web Standard CompressionStream API (available in Cloudflare Workers).
 */
export async function decompressJsonQuery(
  compressed: Uint8Array,
): Promise<FlameDescriptor> {
  const cs = new CompressionStream('deflate')
  const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>
  const reader = cs.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>

  writer.write(compressed)
  writer.close()

  const chunks: Uint8Array[] = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value!)
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) {
    result.set(c, offset)
    offset += c.length
  }

  const json = new TextDecoder().decode(result)
  return JSON.parse(json) as FlameDescriptor
}
