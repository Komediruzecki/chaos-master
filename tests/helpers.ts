import { test as base } from '@playwright/test'
import type { ConsoleMessage,Page } from '@playwright/test';

export type ConsoleError = {
  type: string
  text: string
  location: { url: string; lineNumber: number; columnNumber: number }
  args: unknown[]
}

export async function captureConsoleErrors(
  page: Page,
): Promise<ConsoleError[]> {
  const errors: ConsoleError[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const loc = msg.location()
      errors.push({
        type: msg.type(),
        text: msg.text(),
        location: {
          url: loc.url,
          lineNumber: loc.lineNumber,
          columnNumber: loc.columnNumber,
        },
        args: msg.args(),
      })
    }
  })
  page.on('pageerror', (err: Error) => {
    errors.push({
      type: 'pageerror',
      text: err.message,
      location: { url: '', lineNumber: 0, columnNumber: 0 },
      args: [],
    })
  })
  // Small delay to allow listeners to register
  await new Promise((resolve) => setTimeout(resolve, 0))
  return errors
}

export interface TestContext {
  page: Page
  consoleErrors: ConsoleError[]
}

/** Extended test fixture that captures console errors automatically */
export const test = base.extend<TestContext>({
  consoleErrors: async ({ page }, use) => {
    const errors: ConsoleError[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const loc = msg.location()
        errors.push({
          type: 'error',
          text: msg.text(),
          location: {
            url: loc.url,
            lineNumber: loc.lineNumber,
            columnNumber: loc.columnNumber,
          },
          args: [],
        })
      }
    })
    page.on('pageerror', (err: Error) => {
      errors.push({
        type: 'pageerror',
        text: err.message,
        location: { url: '', lineNumber: 0, columnNumber: 0 },
        args: [],
      })
    })
    await use(errors)
  },
})

export { expect } from '@playwright/test'