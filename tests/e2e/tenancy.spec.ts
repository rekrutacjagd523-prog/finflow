import { test, expect, type Browser, type Page } from '@playwright/test'
import { registerViaUi, waitForShell, type RegisteredUser } from './helpers/app-ui'
import { signInEmulatorUser } from './helpers/emulator-auth'
import { createDocAs, readDoc, seedMember } from './helpers/emulator-firestore'

const NEEDS_EMULATORS =
  'Needs the Auth + Firestore emulators. Run: firebase emulators:exec --only auth,firestore --project demo-finflow "npm run test:e2e"'

// A second signed-in user in a separate browser context (own cookies).
async function registerSecondUser(browser: Browser, prefix: string): Promise<{ page: Page; user: RegisteredUser; close: () => Promise<void> }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  const user = await registerViaUi(page, prefix)
  return { page, user, close: () => context.close() }
}

test.describe('tenancy (emulators)', () => {
  test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST, NEEDS_EMULATORS)

  test('registration creates the company and the owner membership on the server', async ({ page, request }) => {
    const user = await registerViaUi(page, 'tenant')
    const { uid } = await signInEmulatorUser(request, user.email, user.password)

    const member = await readDoc(request, `organizations/${user.orgId}/members/${uid}`)
    expect(member).not.toBeNull()
    expect(member).toMatchObject({ uid: { stringValue: uid }, role: { stringValue: 'owner' }, addedBy: { stringValue: uid } })

    const org = await readDoc(request, `organizations/${user.orgId}`)
    expect(org).not.toHaveProperty('members')
    expect(org).toMatchObject({ ownerId: { stringValue: uid }, plan: { stringValue: 'trial' } })
  })

  test("another company's URL shows «Немає доступу» and a way back to the own company", async ({ page, browser }) => {
    const a = await registerViaUi(page, 'noaccessa')
    const b = await registerSecondUser(browser, 'noaccessb')
    try {
      await page.goto(`/${b.user.orgId}/transactions`)

      await expect(page.getByRole('heading', { name: 'Немає доступу до цієї компанії' })).toBeVisible()
      await expect(page.getByTestId('shell-loading')).toHaveCount(0)

      await page.getByRole('button', { name: 'До моєї компанії' }).click()
      await page.waitForURL(new RegExp(`/${a.orgId}/transactions$`))
      await waitForShell(page, a.companyName)
    } finally {
      await b.close()
    }
  })

  test('a viewer sees a read-only interface and the rules reject their writes', async ({ page, browser, request }) => {
    const owner = await registerViaUi(page, 'viewerown')
    const second = await registerSecondUser(browser, 'viewerusr')
    try {
      const { uid: viewerUid, idToken: viewerToken } = await signInEmulatorUser(request, second.user.email, second.user.password)
      await seedMember(request, owner.orgId, viewerUid, 'viewer', (await signInEmulatorUser(request, owner.email, owner.password)).uid)

      const v = second.page
      await v.goto(`/${owner.orgId}/transactions`)
      await waitForShell(v, owner.companyName)
      await expect(v.getByRole('button', { name: 'Дохід' })).toHaveCount(0)
      await expect(v.getByRole('button', { name: 'Витрата' })).toHaveCount(0)
      await expect(v.getByRole('button', { name: 'Додати рахунок' })).toHaveCount(0)
      await expect(v.getByRole('link', { name: 'Підключити банк' })).toHaveCount(0)

      // Settings: no Banks and no Subscription; a direct URL shows the "insufficient rights" card.
      await v.goto(`/${owner.orgId}/settings/company`)
      const menu = v.getByRole('complementary', { name: 'Налаштування' })
      await expect(menu.getByRole('link', { name: 'Категорії' })).toBeVisible()
      await expect(menu.getByRole('link', { name: 'Банки' })).toHaveCount(0)
      await expect(menu.getByRole('link', { name: 'Підписка' })).toHaveCount(0)
      await v.goto(`/${owner.orgId}/settings/banks`)
      await expect(v.getByTestId('insufficient-rights')).toBeVisible()

      // The protection is the rules, not the UI: the viewer's own token cannot write.
      expect(await createDocAs(request, viewerToken, `organizations/${owner.orgId}/accounts`, 'viewer-write', { orgId: owner.orgId, name: 'x' })).toBe(403)
      const ownerToken = (await signInEmulatorUser(request, owner.email, owner.password)).idToken
      expect(await createDocAs(request, ownerToken, `organizations/${owner.orgId}/accounts`, 'owner-write', { orgId: owner.orgId, name: 'x' })).toBe(200)
    } finally {
      await second.close()
    }
  })

  test('an accountant works with data but has no banks and no subscription', async ({ page, browser, request }) => {
    const owner = await registerViaUi(page, 'acctown')
    const second = await registerSecondUser(browser, 'acctusr')
    try {
      const { uid, idToken } = await signInEmulatorUser(request, second.user.email, second.user.password)
      await seedMember(request, owner.orgId, uid, 'accountant', (await signInEmulatorUser(request, owner.email, owner.password)).uid)

      const a = second.page
      await a.goto(`/${owner.orgId}/transactions`)
      await waitForShell(a, owner.companyName)
      await expect(a.getByRole('button', { name: 'Дохід' })).toBeVisible()
      await expect(a.getByRole('button', { name: 'Додати рахунок' }).first()).toBeVisible()
      await expect(a.getByRole('link', { name: 'Підключити банк' })).toHaveCount(0)

      await a.goto(`/${owner.orgId}/settings/subscription`)
      await expect(a.getByTestId('insufficient-rights')).toBeVisible()

      expect(await createDocAs(request, idToken, `organizations/${owner.orgId}/accounts`, 'acct-write', { orgId: owner.orgId, name: 'x' })).toBe(200)
      expect(await createDocAs(request, idToken, `organizations/${owner.orgId}/bankConnections`, 'acct-bank', { orgId: owner.orgId })).toBe(403)
    } finally {
      await second.close()
    }
  })

  test('the fourth owned company is refused by the API with 409', async ({ page }) => {
    await registerViaUi(page, 'limit') // company 1 of 3

    const statuses = await page.evaluate(async () => {
      const out: Array<{ status: number; error?: string }> = []
      for (let i = 2; i <= 4; i++) {
        const res = await fetch('/api/orgs', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Company ${i}`, currency: 'PLN' }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        out.push({ status: res.status, error: body.error })
      }
      return out
    })

    expect(statuses.map((s) => s.status)).toEqual([201, 201, 409])
    expect(statuses[2].error).toBe('org_limit_reached')
  })

  test('the browser cannot create a company or a membership directly (rules)', async ({ page, request }) => {
    const user = await registerViaUi(page, 'direct')
    const { idToken } = await signInEmulatorUser(request, user.email, user.password)
    expect(await createDocAs(request, idToken, 'organizations', 'sneaky-org', { name: 'x', currency: 'PLN', ownerId: 'x', plan: 'trial' })).toBe(403)
    expect(await createDocAs(request, idToken, `organizations/${user.orgId}/members`, 'someone-else', { uid: 'someone-else', role: 'owner' })).toBe(403)
  })
})
