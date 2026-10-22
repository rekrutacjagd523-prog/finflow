import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('loads with logo and auth links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('FinFlow').first()).toBeVisible()
    await expect(page.locator('a[href="/login"]').first()).toBeVisible()
    await expect(page.locator('a[href="/register"]').first()).toBeVisible()
  })

  test('login link -> /login page', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/login"]').first().click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('register link -> /register page', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/register"]').first().click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})

test.describe('Login page', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]').first()).toBeVisible()
  })

  test('has a link to register', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a[href="/register"]')).toBeVisible()
  })
})

test.describe('Register page', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('has a link back to login', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
})
