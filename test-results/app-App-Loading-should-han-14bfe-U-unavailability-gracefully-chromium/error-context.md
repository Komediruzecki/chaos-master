# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> App Loading >> should handle WebGPU unavailability gracefully
- Location: tests/app.spec.ts:42:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:esbuild] Transform failed with 1 error: /opt/repos/chaos-master/packages/app/src/utils/timeline.ts:138:6: ERROR: Unexpected \"}\""
  - generic [ref=e5]: /opt/repos/chaos-master/packages/app/src/utils/timeline.ts:138:6
  - generic [ref=e6]: "Unexpected \"}\" 136 | } 137 | return [...prev] 138 | } | ^ 139 | return [...prev, { parameterPath, keyframes: [{ frame, value, easing }] }] 140 | })"
  - generic [ref=e7]: at failureErrorWithLog (/opt/repos/chaos-master/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js:1467:15) at /opt/repos/chaos-master/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js:736:50 at responseCallbacks.<computed> (/opt/repos/chaos-master/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js:603:9) at handleIncomingPacket (/opt/repos/chaos-master/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js:658:12) at Socket.readFromStdout (/opt/repos/chaos-master/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js:581:7) at Socket.emit (node:events:518:28) at addChunk (node:internal/streams/readable:561:12) at readableAddChunkPushByteMode (node:internal/streams/readable:512:3) at Readable.push (node:internal/streams/readable:392:5) at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```

# Test source

```ts
  1  | import { expect, test } from './helpers'
  2  | 
  3  | test.describe('App Loading', () => {
  4  |   test('should load the app without fatal errors', async ({ page, consoleErrors }) => {
  5  |     await page.goto('/', { waitUntil: 'domcontentloaded' })
  6  |     await page.waitForTimeout(3000)
  7  | 
  8  |     // App should have rendered something in the root
  9  |     const root = page.locator('#root')
  10 |     await expect(root).toBeAttached()
  11 | 
  12 |     // Filter out expected errors (WebGPU not available in headless, devtools network errors)
  13 |     const fatalErrors = consoleErrors.filter(e =>
  14 |       !e.text.includes('No WebGPU adapters found') &&
  15 |       !e.text.includes('Failed to load resource') &&
  16 |       !e.text.includes('solid-devtools')
  17 |     )
  18 |     expect(fatalErrors).toHaveLength(0)
  19 |   })
  20 | 
  21 |   test('should have correct page title', async ({ page }) => {
  22 |     await page.goto('/', { waitUntil: 'domcontentloaded' })
  23 |     await expect(page).toHaveTitle(/Chaos Master/)
  24 |   })
  25 | 
  26 |   test('should render the app DOM structure', async ({ page }) => {
  27 |     await page.goto('/', { waitUntil: 'domcontentloaded' })
  28 |     await page.waitForTimeout(3000)
  29 | 
  30 |     // App should have rendered the root structure
  31 |     const root = page.locator('#root')
  32 |     await expect(root).toBeAttached()
  33 | 
  34 |     // Should have at least one child element rendered
  35 |     const childCount = await page.evaluate(() => {
  36 |       const root = document.getElementById('root')
  37 |       return root ? root.querySelectorAll('*').length : 0
  38 |     })
  39 |     expect(childCount).toBeGreaterThan(5)
  40 |   })
  41 | 
  42 |   test('should handle WebGPU unavailability gracefully', async ({ page }) => {
  43 |     await page.goto('/', { waitUntil: 'domcontentloaded' })
  44 |     await page.waitForTimeout(3000)
  45 | 
  46 |     // App should handle WebGPU unavailability gracefully
  47 |     // Either it shows WebGPU not supported, or it renders without crashing
  48 |     const webgpuError = page.locator('text=WebGPU is not supported')
  49 |     const hasRoot = page.locator('#root')
  50 | 
  51 |     // Either WebGPU error is shown OR the app rendered without crashing
  52 |     const webgpuShown = await webgpuError.isVisible({ timeout: 1000 }).catch(() => false)
  53 |     const rootHasContent = await hasRoot.evaluate(el => el.children.length > 0)
  54 | 
> 55 |     expect(webgpuShown || rootHasContent).toBeTruthy()
     |                                           ^ Error: expect(received).toBeTruthy()
  56 |   })
  57 | })
  58 | 
```