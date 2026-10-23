import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { registerViaUi, waitForShell } from '../e2e/helpers/app-ui'
import { seedDoc } from '../e2e/helpers/emulator-firestore'

const OUT_DIR = join(process.cwd(), 'ui-shots')
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const
const DAY_MS = 24 * 60 * 60 * 1000
const SETTINGS = ['company', 'categories', 'banks', 'subscription'] as const

async function seedDemoData(request: APIRequestContext, orgId: string): Promise<void> {
  const base = `organizations/${orgId}`
  const now = Date.now()
  const accounts = [
    { id: 'demo-main', name: 'Основний рахунок', balance: 48250.4, currency: 'UAH', color: '#00c896' },
    { id: 'demo-cash', name: 'Каса', balance: 3200, currency: 'UAH', color: '#f59e0b' },
    { id: 'demo-eur', name: 'Рахунок EUR', balance: 1250, currency: 'EUR', color: '#6366f1' },
  ]
  for (const a of accounts) {
    await seedDoc(request, `${base}/accounts`, a.id, {
      name: a.name,
      type: 'bank',
      balance: a.balance,
      currency: a.currency,
      color: a.color,
      orgId,
      createdAt: new Date(now),
    })
  }
  await seedDoc(request, `${base}/categories`, 'demo-rent', {
    name: 'Оренда офісу (демо)',
    type: 'expense',
    color: '#ef4444',
    orgId,
    createdAt: new Date(now),
  })
  await seedDoc(request, `${base}/categories`, 'demo-sales', {
    name: 'Послуги клієнтам',
    type: 'income',
    color: '#22c55e',
    orgId,
    createdAt: new Date(now),
  })
  const txs: { id: string; type: string; accountId: string; amount: number; daysAgo: number; description: string; categoryId?: string; counterpartyId?: string }[] = [
    { id: 'demo-t1', type: 'income', accountId: 'demo-main', amount: 18500, daysAgo: 0, description: 'Оплата рахунку №112', categoryId: 'demo-sales' },
    { id: 'demo-t2', type: 'expense', accountId: 'demo-main', amount: 12000, daysAgo: 0, description: 'Оренда офісу', categoryId: 'demo-rent' },
    { id: 'demo-t3', type: 'expense', accountId: 'demo-cash', amount: 640.5, daysAgo: 1, description: 'Канцелярія' },
    { id: 'demo-t4', type: 'income', accountId: 'demo-main', amount: 7300, daysAgo: 2, description: 'Консультація', categoryId: 'demo-sales' },
    { id: 'demo-t5', type: 'transfer', accountId: 'demo-main', amount: 2000, daysAgo: 2, description: 'Поповнення каси', counterpartyId: 'demo-cash' },
  ]
  for (const t of txs) {
    await seedDoc(request, `${base}/transactions`, t.id, {
      type: t.type,
      accountId: t.accountId,
      amount: t.amount,
      currency: 'UAH',
      date: new Date(now - t.daysAgo * DAY_MS),
      description: t.description,
      categoryId: t.categoryId,
      counterpartyId: t.counterpartyId,
      isRecurring: false,
      tags: [],
      fileUrls: [],
      orgId,
      createdAt: new Date(now),
    })
  }
}

// next-themes leaves `dark` on <html> (the landing default); the app shell must stay light.
async function assertLightShellUnderDarkRoot(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
  const background = await page.locator('.app-shell').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(background).toBe('rgb(244, 246, 245)')
}

test.describe('ui shots', () => {
  test.skip(
    !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST,
    'Run with `npm run ui:shots` (it starts the Auth + Firestore emulators)',
  )

  test('key screens at 1440x900 and 390x844 with a dark <html>', async ({ page, request }) => {
    test.setTimeout(300_000)
    mkdirSync(OUT_DIR, { recursive: true })

    await page.setViewportSize({ width: 1440, height: 900 })
    const user = await registerViaUi(page, 'shots')
    await waitForShell(page, user.companyName)
    await seedDemoData(request, user.orgId)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      let index = 0
      const shot = async (name: string) => {
        await assertLightShellUnderDarkRoot(page)
        index += 1
        const file = `${viewport.name}-${String(index).padStart(2, '0')}-${name}.png`
        await page.screenshot({ path: join(OUT_DIR, file), animations: 'disabled' })
      }
      const open = async (path: string) => {
        await page.goto(`/${user.orgId}/${path}`)
        await waitForShell(page, user.companyName)
      }

      await open('transactions')
      await expect(page.getByRole('row').filter({ hasText: 'Оренда офісу' }).first()).toBeVisible()
      await shot('payments')

      await page.getByRole('button', { name: 'Дохід', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await shot('transaction-form')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()

      if (viewport.name === 'mobile') {
        await page.getByRole('button', { name: 'Відкрити рахунки' }).click()
        await expect(page.getByTestId('accounts-drawer')).toBeVisible()
        await shot('accounts-drawer')
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('accounts-drawer')).toBeHidden()
      } else {
        await page.getByRole('button', { name: 'Згорнути сайдбар' }).click()
        await shot('sidebar-collapsed')
        await page.getByRole('button', { name: 'Розгорнути сайдбар' }).click()
      }

      await open('analytics/cashflow')
      await expect(page.getByRole('heading', { name: 'Cash Flow' })).toBeVisible()
      // Recharts animates its bars in JavaScript (not CSS), so let the animation finish.
      await page.waitForTimeout(1500)
      await shot('analytics-cashflow')

      for (const section of SETTINGS) {
        await open(`settings/${section}`)
        await expect(page.getByRole('navigation', { name: 'Розділи налаштувань' })).toBeVisible()
        await shot(`settings-${section}`)
      }
    }
  })
})
