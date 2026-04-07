import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'playwright@finflow.test'
const TEST_PASSWORD = 'Playwright1!'

test('yapily connect flow debug', async ({ page }) => {
  // Login
  await page.goto(`/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/transactions/, { timeout: 30000 })
  const match = page.url().match(/\/([^/]+)\/transactions/)
  const orgSlug = match![1]

  // Go to settings
  await page.goto(`/${orgSlug}/settings`)
  await page.waitForLoadState('load')

  // Capture console errors
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('requestfailed', req => errors.push(`FAILED: ${req.url()} — ${req.failure()?.errorText}`))

  // Intercept the institutions API call
  let institutionsResponse: unknown = null
  page.on('response', async (res) => {
    if (res.url().includes('/api/yapily/institutions')) {
      institutionsResponse = await res.json().catch(() => 'parse error')
    }
  })

  // Click "Підключити банк"
  await page.locator('text=Підключити банк').first().click()
  await page.waitForTimeout(3000)

  // Screenshot
  await page.screenshot({ path: 'tests/screenshots/yapily-debug.png', fullPage: true })

  console.log('Institutions API response:', JSON.stringify(institutionsResponse, null, 2))
  console.log('Errors:', errors)

  // Check if institutions list appeared
  const pickerVisible = await page.locator('[class*="overflow-y-auto"]').isVisible()
  console.log('Picker visible:', pickerVisible)
})
