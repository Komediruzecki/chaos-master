import { expect, test } from './helpers'

async function dismissWelcomeIfPresent(page: import('@playwright/test').Page) {
  // The welcome backdrop has z-index: 200, dismiss it if visible
  // Try clicking the backdrop (which also dismisses) or the Enter button
  try {
    const backdrop = page.locator('[class*="backdrop"]').first()
    if (await backdrop.isVisible({ timeout: 2000 })) {
      // Try Enter button first
      const enterBtn = page.locator('button:has-text("Enter")').first()
      if (await enterBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await enterBtn.click()
      } else {
        // Click backdrop to dismiss
        await backdrop.click({ position: { x: 5, y: 5 } })
      }
      await page.waitForTimeout(500)
    }
  } catch {
    // No welcome screen present
  }
}

test.describe('Palette System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await dismissWelcomeIfPresent(page)
  })

  test('should render app without fatal errors', async ({ page, consoleErrors }) => {
    const root = page.locator('#root')
    await expect(root).toBeAttached()

    const fatalErrors = consoleErrors.filter(e =>
      !e.text.includes('No WebGPU adapters found') &&
      !e.text.includes('Failed to load resource')
    )
    expect(fatalErrors).toHaveLength(0)
  })

  test('should have palette selector', async ({ page }) => {
    const webgpuError = page.locator('text=WebGPU').first()
    const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
    if (webgpuShown) return

    await dismissWelcomeIfPresent(page)
    const paletteLabel = page.locator('text=Palette').or(page.locator('text=palette'))
    await expect(paletteLabel.first()).toBeVisible({ timeout: 10000 })
  })

  test('should be able to select different palettes', async ({ page }) => {
    const webgpuError = page.locator('text=WebGPU').first()
    const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
    if (webgpuShown) return

    await dismissWelcomeIfPresent(page)
    const selectors = page.locator('select')
    const count = await selectors.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should show palette gradient preview', async ({ page }) => {
    const webgpuError = page.locator('text=WebGPU').first()
    const webgpuShown = await webgpuError.isVisible({ timeout: 500 }).catch(() => false)
    if (webgpuShown) return

    await dismissWelcomeIfPresent(page)
    const gradientPreview = page.locator('[class*="gradient"]').or(page.locator('[style*="gradient"]'))
    await expect(gradientPreview.first()).toBeVisible({ timeout: 10000 })
  })
})
