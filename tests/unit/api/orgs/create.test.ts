import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeMembers, fakeOrgs, fakeTxFault, resetFakeAdmin } from '@/tests/unit/helpers/fake-admin'
import { POST } from '@/app/api/orgs/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})

function createRequest(body: unknown, opts: { token?: string; origin?: string | null; contentType?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': opts.contentType ?? 'application/json' }
  if (opts.token !== undefined) headers.Cookie = `__session=${opts.token}`
  if (opts.origin !== null) headers.Origin = opts.origin ?? 'http://localhost:3000'
  return new Request('http://localhost:3000/api/orgs', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID = { name: 'New Co', currency: 'PLN' }

// mallory has a valid session and no companies.
const MALLORY = 'token-mallory'

describe('POST /api/orgs', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('creates the organization and the owner membership together', async () => {
    const orgsBefore = fakeOrgs.size

    const res = await POST(createRequest(VALID, { token: MALLORY }))

    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { orgId } = (await res.json()) as { orgId: string }
    expect(orgId).toMatch(/^[A-Za-z0-9]{20}$/)

    expect(fakeOrgs.size).toBe(orgsBefore + 1)
    const org = fakeOrgs.get(orgId)
    expect(org).toMatchObject({ name: 'New Co', currency: 'PLN', ownerId: 'user-mallory', plan: 'trial' })
    expect(org).not.toHaveProperty('members')
    const trialMs = (org!.trialEndsAt as { toMillis: () => number }).toMillis() - (org!.createdAt as { toMillis: () => number }).toMillis()
    expect(trialMs).toBe(14 * 24 * 60 * 60 * 1000)

    expect(fakeMembers.get(`${orgId}/user-mallory`)).toMatchObject({ uid: 'user-mallory', role: 'owner', addedBy: 'user-mallory' })
  })

  it('does not require a verified email', async () => {
    const res = await POST(createRequest(VALID, { token: 'token-bob' })) // bob is unverified
    expect(res.status).toBe(201)
  })

  it('allows three owned companies and refuses the fourth with 409 org_limit_reached', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await POST(createRequest({ name: `Co ${i}`, currency: 'EUR' }, { token: MALLORY }))).status).toBe(201)
    }
    const orgsAfterThree = fakeOrgs.size
    const membersAfterThree = fakeMembers.size

    const res = await POST(createRequest(VALID, { token: MALLORY }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'org_limit_reached' })
    expect(fakeOrgs.size).toBe(orgsAfterThree)
    expect(fakeMembers.size).toBe(membersAfterThree)
  })

  it('counts only companies the user OWNS: memberships as accountant or viewer do not count', async () => {
    fakeMembers.set('org-x/user-mallory', { uid: 'user-mallory', role: 'accountant' })
    fakeMembers.set('org-y/user-mallory', { uid: 'user-mallory', role: 'viewer' })
    fakeMembers.set('org-z/user-mallory', { uid: 'user-mallory', role: 'accountant' })

    for (let i = 0; i < 3; i++) {
      expect((await POST(createRequest(VALID, { token: MALLORY }))).status).toBe(201)
    }
    expect((await POST(createRequest(VALID, { token: MALLORY }))).status).toBe(409)
  })

  it('the limit is per user: another user is not affected', async () => {
    for (let i = 0; i < 3; i++) await POST(createRequest(VALID, { token: MALLORY }))
    expect((await POST(createRequest(VALID, { token: 'token-alice' }))).status).toBe(201)
  })

  it('leaves nothing behind when writing the membership fails (atomic)', async () => {
    fakeTxFault.failOnCreatePathIncludes = '/members/'
    const orgs = fakeOrgs.size
    const members = fakeMembers.size

    const res = await POST(createRequest(VALID, { token: MALLORY }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(fakeOrgs.size).toBe(orgs)
    expect(fakeMembers.size).toBe(members)
  })

  it.each([
    ['an empty name', { name: '', currency: 'PLN' }],
    ['a bad currency', { name: 'A', currency: 'GBP' }],
    ['an extra field', { name: 'A', currency: 'PLN', plan: 'pro' }],
    ['a non-object body', '"text"'],
    ['broken JSON', '{'],
  ])('answers 400 for %s and creates nothing', async (_label, body) => {
    const orgs = fakeOrgs.size
    const res = await POST(createRequest(body, { token: MALLORY }))
    expect(res.status).toBe(400)
    expect(fakeOrgs.size).toBe(orgs)
  })

  it('answers 401 without a session and 401 for a forged one', async () => {
    expect((await POST(createRequest(VALID))).status).toBe(401)
    expect((await POST(createRequest(VALID, { token: 'token-forged' }))).status).toBe(401)
  })

  it('answers 403 for a foreign Origin and for a missing Origin', async () => {
    expect((await POST(createRequest(VALID, { token: MALLORY, origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(createRequest(VALID, { token: MALLORY, origin: null }))).status).toBe(403)
  })

  it('answers 415 for a non-JSON content type and 413 for an oversized body', async () => {
    expect((await POST(createRequest(VALID, { token: MALLORY, contentType: 'text/plain' }))).status).toBe(415)
    const big = JSON.stringify({ name: 'x'.repeat(5000), currency: 'PLN' })
    expect((await POST(createRequest(big, { token: MALLORY }))).status).toBe(413)
  })

  it('answers 413 for a declared Content-Length over the limit before reading the body', async () => {
    const orgs = fakeOrgs.size
    const req = new Request('http://localhost:3000/api/orgs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: `__session=${MALLORY}`,
        'content-length': '999999',
      },
      body: JSON.stringify(VALID),
    })
    const textSpy = vi.spyOn(req, 'text')

    const res = await POST(req)

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'payload too large' })
    expect(textSpy).not.toHaveBeenCalled()
    expect(fakeOrgs.size).toBe(orgs)
  })
})
