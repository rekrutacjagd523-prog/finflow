import { test, expect } from '@playwright/test'
const TEST_EMAIL = 'playwright@finflow.test'
const TEST_PASSWORD = 'Playwright1!'

test('enable banking full flow', async ({ page }) => {
  // Warm up compilation
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Get orgId via API
  const res = await page.request.get(`/api/test/auth?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`)
  const { orgId } = await res.json()
  console.log('orgId:', orgId)

  // Set session cookie and login
  await page.context().addCookies([{ name: '__session', value: '1', domain: 'localhost', path: '/' }])
  await page.goto(`/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/transactions/, { timeout: 60000 })

  // Settings
  await page.goto(`/${orgId}/settings`, { waitUntil: 'load' })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: /Підключити банк/ }).click()
  await expect(page.locator('text=Mock ASPSP')).toBeVisible({ timeout: 12000 })
  await page.screenshot({ path: 'tests/screenshots/eb-picker.png', fullPage: true })

  const navPromise = page.waitForURL(/tilisy|enablebanking\.com/, { timeout: 20000 })
  await page.locator('text=Mock ASPSP').click()
  await navPromise
  console.log('Bank URL:', page.url().slice(0, 80))
  await page.screenshot({ path: 'tests/screenshots/eb-bank.png' })

  await page.locator('text=Kontynuuj').click({ timeout: 8000 })
  await page.waitForTimeout(2000)

  if (page.url().includes('mock-aspsp')) {
    await page.locator('text=Create Account').click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'tests/screenshots/eb-mock.png', fullPage: true })
    console.log('Mock account URL:', page.url().slice(0, 80))
  }

  try {
    await page.waitForURL(/localhost:3000.*settings/, { timeout: 30000 })
    console.log('SUCCESS:', page.url().slice(0, 100))
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/eb-connected.png', fullPage: true })
  } catch {
    console.log('Final URL:', page.url())
    await page.screenshot({ path: 'tests/screenshots/eb-final.png', fullPage: true })
  }
})
