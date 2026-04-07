import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'playwright@finflow.test'
const TEST_PASSWORD = 'Playwright1!'

test('enable banking connect flow', async ({ page }) => {
  // Login
  await page.goto(`/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/transactions/, { timeout: 30000 })
  const match = page.url().match(/\/([^/]+)\/transactions/)
  const orgSlug = match![1]
  console.log('orgSlug:', orgSlug)

  // Go to settings
  await page.goto(`/${orgSlug}/settings`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'tests/screenshots/eb-settings.png', fullPage: true })

  // Check institutions API
  const apiRes = await page.evaluate(async () => {
    const r = await fetch('/api/enablebanking/institutions?country=PL')
    return r.json()
  })
  console.log('Institutions:', JSON.stringify(apiRes))

  // Click connect button
  await page.locator('text=Підключити банк').first().click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'tests/screenshots/eb-picker.png', fullPage: true })

  // Check if institutions appeared
  const mockBank = page.locator('text=Mock ASPSP')
  const visible = await mockBank.isVisible()
  console.log('Mock ASPSP visible:', visible)

  if (visible) {
    // Intercept navigation to bank auth
    const [popup] = await Promise.all([
      page.waitForURL(/enablebanking|tilisy/, { timeout: 5000 }).catch(() => null),
      mockBank.click(),
    ])
    console.log('After click URL:', page.url())
    await page.screenshot({ path: 'tests/screenshots/eb-auth.png', fullPage: true })
  }
})
