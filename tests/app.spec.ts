/**
 * Authenticated app tests.
 * Uses /test-login page (dev-only) to bypass React 19 form event issues.
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'playwright@finflow.test'
const TEST_PASSWORD = 'Playwright1!'

let cachedOrgSlug: string | null = null

async function ensureLoggedIn(page: Page): Promise<string> {
  if (cachedOrgSlug && page.url().includes(cachedOrgSlug)) {
    return cachedOrgSlug
  }

  await page.goto(
    `/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`,
    { waitUntil: 'domcontentloaded' }
  )
  await page.waitForURL(/\/transactions/, { timeout: 30000 })

  const match = page.url().match(/\/([^/]+)\/transactions/)
  cachedOrgSlug = match ? match[1] : null
  if (!cachedOrgSlug) throw new Error('Could not extract orgSlug from URL: ' + page.url())
  return cachedOrgSlug
}

// Register test user before any tests run
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  // First visit: warm up Next.js compilation
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' }).catch(() => {})
  // Register test user via Firebase REST API
  await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyAd6w8bKRY2UkHtHgrwkZkju0h03E1tM-w`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: true }),
    }
  ).catch(() => {}) // Ignore EMAIL_EXISTS
  await ctx.close()
})

test('transactions page loads and shows header', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.waitForLoadState('load')
  await expect(page.locator('text=Транзакції').first()).toBeVisible({ timeout: 8000 })
  await page.screenshot({ path: 'tests/screenshots/transactions.png', fullPage: true })
  console.log(`orgSlug: ${orgSlug}`)
})

test('settings page — all sections present', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/settings`)
  await page.waitForLoadState('load')

  await expect(page.locator('text=Налаштування').first()).toBeVisible({ timeout: 8000 })
  await expect(page.locator('text=Організація').first()).toBeVisible({ timeout: 8000 })
  await expect(page.locator('text=Категорії').first()).toBeVisible({ timeout: 8000 })
  await expect(page.locator('text=Monobank').first()).toBeVisible({ timeout: 8000 })
  await expect(page.locator('text=Банки Європи').first()).toBeVisible({ timeout: 8000 })
  await page.screenshot({ path: 'tests/screenshots/settings.png', fullPage: true })
})

test('settings — Yapily connect button', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/settings`)
  await page.waitForLoadState('load')
  await expect(page.locator('text=Підключити банк').first()).toBeVisible({ timeout: 8000 })
})

test('settings — Monobank connect button', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/settings`)
  await page.waitForLoadState('load')
  await expect(page.locator('text=Підключити Monobank').first()).toBeVisible({ timeout: 8000 })
})

test('cashflow analytics chart', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/analytics/cashflow`)
  await page.waitForLoadState('load')
  await expect(page.locator('text=Cash Flow').first()).toBeVisible({ timeout: 8000 })
  await page.screenshot({ path: 'tests/screenshots/cashflow.png', fullPage: true })
})

test('P&L analytics page', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/analytics/pl`)
  await page.waitForLoadState('load')
  await expect(page.locator('body')).not.toContainText('Application error')
  await page.screenshot({ path: 'tests/screenshots/pl.png', fullPage: true })
})

test('calendar analytics page', async ({ page }) => {
  const orgSlug = await ensureLoggedIn(page)
  await page.goto(`/${orgSlug}/analytics/calendar`)
  await page.waitForLoadState('load')
  await expect(page.locator('body')).not.toContainText('Application error')
  await page.screenshot({ path: 'tests/screenshots/calendar.png', fullPage: true })
})
