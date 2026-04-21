/**
 * URL-safe base64url decode.
 * Matches the encodeBase64() used in the main app (packages/app/src/utils/base64.ts).
 * The main app uses url-safe chars (no + / padding with ''), so we decode here.
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const lookup = new Uint8Array(256)
for (let i = 0; i < B64_CHARS.length; i++) {
  lookup[B64_CHARS.charCodeAt(i)] = i
}

/**
 * Decode a base64url string (url-safe alphabet, no + / =) to a Uint8Array.
 */
export function decodeBase64url(input: string): Uint8Array {
  // Add padding if needed
  let base64 = input
  const padCount = (4 - (input.length % 4)) % 4
  base64 += '='.repeat(padCount)
  // Swap -_ back to +/
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/')

  let bufferLength = (base64.length * 3) / 4
  if (base64.endsWith('==')) {
    bufferLength -= 2
  } else if (base64.endsWith('=')) {
    bufferLength -= 1
  }

  const bytes = new Uint8Array(bufferLength)
  let p = 0

  for (let i = 0; i < base64.length; i += 4) {
    const a = lookup[base64.charCodeAt(i)]
    const b = lookup[base64.charCodeAt(i + 1)]
    const c = lookup[base64.charCodeAt(i + 2)]
    const d = lookup[base64.charCodeAt(i + 3)]

    bytes[p++] = (a << 2) | (b >> 4)
    bytes[p++] = ((b & 15) << 4) | (c >> 2)
    bytes[p++] = ((c & 3) << 6) | d
  }

  // Trim any padding bytes
  return bytes.subarray(0, bufferLength)
}
