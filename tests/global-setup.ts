import { chromium } from '@playwright/test'

const FIREBASE_API_KEY = 'AIzaSyAd6w8bKRY2UkHtHgrwkZkju0h03E1tM-w'
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'playwright@finflow.test'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'Playwright1!'

async function firebaseSignUp(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  return res.json() as Promise<{ idToken?: string; error?: { message: string } }>
}

export default async function globalSetup() {
  // Create test user (ignore "EMAIL_EXISTS" error)
  const result = await firebaseSignUp(TEST_EMAIL, TEST_PASSWORD)
  if (result.error && result.error.message !== 'EMAIL_EXISTS') {
    console.warn('Firebase signup error:', result.error.message)
  }

  // Login via test-login page and save storage state
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(
      `http://localhost:3000/test-login?email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`,
      { waitUntil: 'domcontentloaded' }
    )

    // Wait for redirect to /transactions (confirms auth worked)
    await page.waitForURL(/\/transactions/, { timeout: 30000 })
    await context.storageState({ path: 'tests/fixtures/auth.json' })
    console.log('✓ Auth state saved to tests/fixtures/auth.json')
  } catch (e) {
    console.error('globalSetup login failed:', e)
    // Don't throw — tests that need auth will fail individually
  } finally {
    await browser.close()
  }
}
