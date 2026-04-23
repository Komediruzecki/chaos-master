# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: palettes.spec.ts >> Palette System >> should be able to select different palettes
- Location: tests/palettes.spec.ts:34:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  1  | import { dismissWelcomeIfPresent, expect, test } from './helpers'
  2  | // import type { Page } from '@playwright/test'
  3  | 
  4  | test.describe('Palette System', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await page.goto('/', { waitUntil: 'domcontentloaded' })
  7  |     await page.waitForTimeout(3000)
  8  |     await dismissWelcomeIfPresent(page)
  9  |   })
  10 | 
  11 |   test('should render app without fatal errors', async ({ page, consoleErrors }) => {
  12 |     const root = page.locator('#root')
  13 |     await expect(root).toBeAttached()
  14 | 
  15 |     const webgpuMsg = 'No WebGPU adapters found'
  16 |     const resourceMsg = 'Failed to load resource'
  17 |     const fatalErrors = consoleErrors.filter((e) => {
  18 |       const text = e.text
  19 |       return !text.includes(webgpuMsg) && !text.includes(resourceMsg)
  20 |     })
  21 |     expect(fatalErrors).toHaveLength(0)
  22 |   })
  23 | 
  24 |   test('should have palette selector', async ({ page }) => {
  25 |     const webgpuError = page.locator('text=WebGPU').first()
  26 |     const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
  27 |     if (webgpuShown) return
  28 | 
  29 |     await dismissWelcomeIfPresent(page)
  30 |     const paletteLabel = page.locator('text=Palette').or(page.locator('text=palette'))
  31 |     await expect(paletteLabel.first()).toBeVisible({ timeout: 10000 })
  32 |   })
  33 | 
  34 |   test('should be able to select different palettes', async ({ page }) => {
  35 |     const webgpuError = page.locator('text=WebGPU').first()
  36 |     const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
  37 |     if (webgpuShown) return
  38 | 
  39 |     await dismissWelcomeIfPresent(page)
  40 |     const selectors = page.locator('select')
  41 |     const count = await selectors.count()
> 42 |     expect(count).toBeGreaterThan(0)
     |                   ^ Error: expect(received).toBeGreaterThan(expected)
  43 |   })
  44 | 
  45 |   test('should show palette gradient preview', async ({ page }) => {
  46 |     const webgpuError = page.locator('text=WebGPU').first()
  47 |     const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
  48 |     if (webgpuShown) return
  49 | 
  50 |     await dismissWelcomeIfPresent(page)
  51 |     const gradientPreview = page.locator('[class*="gradient"]').or(page.locator('[style*="gradient"]'))
  52 |     await expect(gradientPreview.first()).toBeVisible({ timeout: 10000 })
  53 |   })
  54 | })
  55 | 
```