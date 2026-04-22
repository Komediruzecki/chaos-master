# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timeline.spec.ts >> Keyframe Editing >> should allow adding keyframes
- Location: tests/timeline.spec.ts:113:3

# Error details

```
Error: Channel closed
```

```
Error: locator.selectOption: Target page, context or browser has been closed
Call log:
  - waiting for locator('select').first()

```

# Test source

```ts
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
  43  |     await expect(prevButton).toBeEnabled()
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
> 116 |     await parameterSelect.selectOption('exposure')
      |                           ^ Error: locator.selectOption: Target page, context or browser has been closed
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
  144 |     await frameInput.blur()
  145 | 
  146 |     const valueInput = page.locator('input[type="text"]')
  147 |     await valueInput.fill('0.5')
  148 |     await valueInput.blur()
  149 | 
  150 |     const addButton = page.locator('button:has-text("Add Keyframe")')
  151 |     await addButton.click()
  152 | 
  153 |     // Navigate to same frame with different value
  154 |     await frameInput.fill('10')
  155 |     await frameInput.blur()
  156 |     await valueInput.fill('0.75')
  157 |     await valueInput.blur()
  158 | 
  159 |     // Click update button
  160 |     const updateButton = page.locator('button:has-text("Update")')
  161 |     await expect(updateButton).toBeVisible()
  162 |     await updateButton.click()
  163 | 
  164 |     await page.waitForTimeout(500)
  165 |   })
  166 | 
  167 |   test('should allow removing keyframes', async ({ page }) => {
  168 |     // Add a keyframe first
  169 |     const parameterSelect = page.locator('select').first()
  170 |     await parameterSelect.selectOption('exposure')
  171 | 
  172 |     const frameInput = page.locator('input[type="number"]')
  173 |     await frameInput.fill('10')
  174 |     await frameInput.blur()
  175 | 
  176 |     const valueInput = page.locator('input[type="text"]')
  177 |     await valueInput.fill('0.5')
  178 |     await valueInput.blur()
  179 | 
  180 |     const addButton = page.locator('button:has-text("Add Keyframe")')
  181 |     await addButton.click()
  182 | 
  183 |     // Now remove it
  184 |     const removeButton = page.locator('button:has-text("Remove")')
  185 |     await expect(removeButton).toBeVisible()
  186 |     await removeButton.click()
  187 | 
  188 |     await page.waitForTimeout(500)
  189 |   })
  190 | 
  191 |   test('should handle array values like backgroundColor', async ({ page }) => {
  192 |     // Select backgroundColor parameter
  193 |     const parameterSelect = page.locator('select').first()
  194 |     await parameterSelect.selectOption('backgroundColor')
  195 | 
  196 |     // Navigate to frame 20
  197 |     const frameInput = page.locator('input[type="number"]')
  198 |     await frameInput.fill('20')
  199 |     await frameInput.blur()
  200 | 
  201 |     // Enter RGB value
  202 |     const valueInput = page.locator('input[type="text"]')
  203 |     await expect(valueInput).toBeVisible()
  204 |     await valueInput.fill('1, 0, 0') // Red background
  205 | 
  206 |     // Add keyframe
  207 |     const addButton = page.locator('button:has-text("Add Keyframe")')
  208 |     await addButton.click()
  209 | 
  210 |     await page.waitForTimeout(500)
  211 |   })
  212 | })
  213 | 
  214 | test.describe('Timeline Playback', () => {
  215 |   test.beforeEach(async ({ page }) => {
  216 |     await page.goto('/')
```