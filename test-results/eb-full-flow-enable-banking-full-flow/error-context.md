# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: eb-full-flow.spec.ts >> enable banking full flow
- Location: tests\eb-full-flow.spec.ts:5:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 45000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - paragraph [ref=e3]: Initializing...
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | const TEST_EMAIL = 'playwright@finflow.test'
  3  | const TEST_PASSWORD = 'Playwright1!'
  4  | 
  5  | test('enable banking full flow', async ({ page }) => {
  6  |   // Warm up compilation
  7  |   await page.goto('/', { waitUntil: 'domcontentloaded' })
  8  | 
  9  |   // Get orgId via API
  10 |   const res = await page.request.get(`/api/test/auth?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`)
  11 |   const { orgId } = await res.json()
  12 |   console.log('orgId:', orgId)
  13 | 
  14 |   // Set session cookie and login
  15 |   await page.context().addCookies([{ name: '__session', value: '1', domain: 'localhost', path: '/' }])
  16 |   await page.goto(`/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`, { waitUntil: 'domcontentloaded' })
> 17 |   await page.waitForURL(/\/transactions/, { timeout: 60000 })
     |              ^ Error: page.waitForURL: Test timeout of 45000ms exceeded.
  18 | 
  19 |   // Settings
  20 |   await page.goto(`/${orgId}/settings`, { waitUntil: 'load' })
  21 |   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  22 |   await page.waitForTimeout(1000)
  23 | 
  24 |   await page.getByRole('button', { name: /Підключити банк/ }).click()
  25 |   await expect(page.locator('text=Mock ASPSP')).toBeVisible({ timeout: 12000 })
  26 |   await page.screenshot({ path: 'tests/screenshots/eb-picker.png', fullPage: true })
  27 | 
  28 |   const navPromise = page.waitForURL(/tilisy|enablebanking\.com/, { timeout: 20000 })
  29 |   await page.locator('text=Mock ASPSP').click()
  30 |   await navPromise
  31 |   console.log('Bank URL:', page.url().slice(0, 80))
  32 |   await page.screenshot({ path: 'tests/screenshots/eb-bank.png' })
  33 | 
  34 |   await page.locator('text=Kontynuuj').click({ timeout: 8000 })
  35 |   await page.waitForTimeout(2000)
  36 | 
  37 |   if (page.url().includes('mock-aspsp')) {
  38 |     await page.locator('text=Create Account').click({ timeout: 5000 }).catch(() => {})
  39 |     await page.waitForTimeout(3000)
  40 |     await page.screenshot({ path: 'tests/screenshots/eb-mock.png', fullPage: true })
  41 |     console.log('Mock account URL:', page.url().slice(0, 80))
  42 |   }
  43 | 
  44 |   try {
  45 |     await page.waitForURL(/localhost:3000.*settings/, { timeout: 30000 })
  46 |     console.log('SUCCESS:', page.url().slice(0, 100))
  47 |     await page.waitForTimeout(2000)
  48 |     await page.screenshot({ path: 'tests/screenshots/eb-connected.png', fullPage: true })
  49 |   } catch {
  50 |     console.log('Final URL:', page.url())
  51 |     await page.screenshot({ path: 'tests/screenshots/eb-final.png', fullPage: true })
  52 |   }
  53 | })
  54 | 
```