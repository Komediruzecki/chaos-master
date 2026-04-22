# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timeline.spec.ts >> Timeline System >> should allow frame navigation
- Location: tests/timeline.spec.ts:38:3

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: locator('button[aria-label="Previous frame"]')
Expected: enabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for locator('button[aria-label="Previous frame"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "CHAOS MASTER" [level=1] [ref=e3]
  - paragraph [ref=e4]:
    - text: Your browser or device currently does not support
    - strong [ref=e5]: WebGPU
    - text: .
  - link "Check WebGPU Browser Support" [ref=e6] [cursor=pointer]:
    - /url: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
  - generic [ref=e7]: Try the latest Chrome, Firefox, or Safari (on supported hardware) for the full experience.
```

# Test source

```ts
  1   | import { expect,test } from '@playwright/test'
  2   | 
  3   | test.describe('Timeline System', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/')
  6   |   })
  7   | 
  8   |   test('should render timeline panel', async ({ page }) => {
  9   |     const timelinePanel = page.locator('[data-testid="timeline-panel"]')
  10  |     await expect(timelinePanel).toBeVisible()
  11  |   })
  12  | 
  13  |   test('should show timeline ruler with keyframe markers', async ({ page }) => {
  14  |     const timelineRuler = page.locator('[data-testid="timeline-ruler"]')
  15  |     await expect(timelineRuler).toBeVisible()
  16  |     // Should have markers for frame positions
  17  |     const markers = timelineRuler.locator('[data-key]')
  18  |     await expect(markers).toHaveCountGreaterThan(0)
  19  |   })
  20  | 
  21  |   test('should have keyframe editor', async ({ page }) => {
  22  |     const keyframeEditor = page.locator('[data-testid="keyframe-editor"]')
  23  |     await expect(keyframeEditor).toBeVisible()
  24  |   })
  25  | 
  26  |   test('should allow parameter selection', async ({ page }) => {
  27  |     const parameterSelect = page.locator('select').first()
  28  |     await expect(parameterSelect).toBeVisible()
  29  | 
  30  |     // Should have camera options
  31  |     await parameterSelect.selectOption('exposure')
  32  |     await expect(parameterSelect).toHaveValue('exposure')
  33  | 
  34  |     await parameterSelect.selectOption('camera.zoom')
  35  |     await expect(parameterSelect).toHaveValue('camera.zoom')
  36  |   })
  37  | 
  38  |   test('should allow frame navigation', async ({ page }) => {
  39  |     const prevButton = page.locator('button[aria-label="Previous frame"]')
  40  |     const nextButton = page.locator('button[aria-label="Next frame"]')
  41  |     const frameInput = page.locator('input[type="number"]')
  42  | 
> 43  |     await expect(prevButton).toBeEnabled()
      |                              ^ Error: expect(locator).toBeEnabled() failed
  44  |     await expect(nextButton).toBeEnabled()
  45  |     await expect(frameInput).toBeEnabled()
  46  | 
  47  |     // Navigate to frame 10
  48  |     await frameInput.fill('10')
  49  |     await frameInput.blur()
  50  |     await expect(frameInput).toHaveValue('10')
  51  |   })
  52  | 
  53  |   test('should allow FPS configuration', async ({ page }) => {
  54  |     const fpsInput = page.locator('#fps-input')
  55  |     await expect(fpsInput).toBeVisible()
  56  | 
  57  |     // Change FPS to 30
  58  |     await fpsInput.fill('30')
  59  |     await fpsInput.blur()
  60  |     await expect(fpsInput).toHaveValue('30')
  61  |   })
  62  | 
  63  |   test('should allow loop toggle', async ({ page }) => {
  64  |     const loopToggle = page.locator('#loop-toggle')
  65  |     await expect(loopToggle).toBeVisible()
  66  | 
  67  |     // Toggle loop on
  68  |     await loopToggle.check()
  69  |     await expect(loopToggle).toBeChecked()
  70  |   })
  71  | 
  72  |   test('should play/pause timeline', async ({ page }) => {
  73  |     const playButton = page.locator('button[aria-label="Play"]')
  74  |     const pauseButton = page.locator('button[aria-label="Pause"]')
  75  | 
  76  |     await expect(playButton).toBeVisible()
  77  |     await expect(pauseButton).toBeVisible()
  78  | 
  79  |     // Start playback
  80  |     await playButton.click()
  81  | 
  82  |     // Wait for some time to see if animation progresses
  83  |     await page.waitForTimeout(500)
  84  |   })
  85  | 
  86  |   test('should render correctly with initial timeline state', async ({ page }) => {
  87  |     // Check that timeline components are in the DOM
  88  |     await page.waitForSelector('[data-testid="timeline-panel"]', { timeout: 5000 })
  89  | 
  90  |     // Check for keyframe editor
  91  |     await expect(page.locator('[data-testid="keyframe-editor"]')).toBeVisible()
  92  |   })
  93  | 
  94  |   test('should not throw errors with timeline changes', async ({ page }) => {
  95  |     // Trigger some timeline changes without errors
  96  |     const parameterSelect = page.locator('select').first()
  97  |     await parameterSelect.selectOption('exposure')
  98  | 
  99  |     const valueInput = page.locator('input[type="text"]')
  100 |     await expect(valueInput).toBeVisible()
  101 | 
  102 |     // Change to a different parameter
  103 |     await parameterSelect.selectOption('vibrancy')
  104 |     await parameterSelect.selectOption('camera.zoom')
  105 |   })
  106 | })
  107 | 
  108 | test.describe('Keyframe Editing', () => {
  109 |   test.beforeEach(async ({ page }) => {
  110 |     await page.goto('/')
  111 |   })
  112 | 
  113 |   test('should allow adding keyframes', async ({ page }) => {
  114 |     // Select a parameter
  115 |     const parameterSelect = page.locator('select').first()
  116 |     await parameterSelect.selectOption('exposure')
  117 | 
  118 |     // Navigate to frame 10
  119 |     const frameInput = page.locator('input[type="number"]')
  120 |     await frameInput.fill('10')
  121 |     await frameInput.blur()
  122 | 
  123 |     // Enter a value
  124 |     const valueInput = page.locator('input[type="text"]')
  125 |     await expect(valueInput).toBeVisible()
  126 |     await valueInput.fill('0.5')
  127 | 
  128 |     // Click add keyframe button
  129 |     const addButton = page.locator('button:has-text("Add Keyframe")')
  130 |     await expect(addButton).toBeVisible()
  131 |     await addButton.click()
  132 | 
  133 |     // Wait a bit for any feedback
  134 |     await page.waitForTimeout(500)
  135 |   })
  136 | 
  137 |   test('should allow updating existing keyframes', async ({ page }) => {
  138 |     // First add a keyframe
  139 |     const parameterSelect = page.locator('select').first()
  140 |     await parameterSelect.selectOption('exposure')
  141 | 
  142 |     const frameInput = page.locator('input[type="number"]')
  143 |     await frameInput.fill('10')
```