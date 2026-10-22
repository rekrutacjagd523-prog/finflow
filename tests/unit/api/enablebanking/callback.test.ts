import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_EB_STATE_SECRET, resetFakeAdmin, upstreamJson } from '@/tests/unit/helpers/fake-admin'
import { EB_STATE_TTL_SECONDS, signEbState } from '@/lib/server/eb-state'
import { GET } from '@/app/api/enablebanking/callback/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})
vi.mock('@/lib/enablebanking/jwt', () => ({ createJwt: vi.fn(async () => 'eb-jwt') }))

const fetchMock = vi.fn()

function callbackRequest(query: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/enablebanking/callback')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new Request(url)
}

function aliceState(nowSec?: number): string {
  return signEbState({ orgId: 'org-acme', uid: 'user-alice' }, TEST_EB_STATE_SECRET, nowSec)
}

describe('GET /api/enablebanking/callback', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('EB_STATE_SECRET', TEST_EB_STATE_SECRET)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns 400 "invalid state" when state is missing', async () => {
    const res = await GET(callbackRequest({ code: 'auth-code' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid state' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for the legacy unsigned base64 state', async () => {
    const legacy = Buffer.from(JSON.stringify({ orgId: 'org-acme' })).toString('base64url')
    const res = await GET(callbackRequest({ code: 'auth-code', state: legacy }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid state' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a state forged with another secret, before exchanging the code', async () => {
    const forged = signEbState({ orgId: 'org-acme', uid: 'user-alice' }, 'attacker-secret')
    const res = await GET(callbackRequest({ code: 'auth-code', state: forged }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid state' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 "expired state" for a state older than 15 minutes', async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - EB_STATE_TTL_SECONDS - 5
    const res = await GET(callbackRequest({ code: 'auth-code', state: aliceState(issuedAt) }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'expired state' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the user in the state is no longer a member, before exchanging the code', async () => {
    const state = signEbState({ orgId: 'org-acme', uid: 'user-mallory' }, TEST_EB_STATE_SECRET)
    const res = await GET(callbackRequest({ code: 'auth-code', state }))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the org in the state no longer exists', async () => {
    const state = signEbState({ orgId: 'org-ghost', uid: 'user-alice' }, TEST_EB_STATE_SECRET)
    const res = await GET(callbackRequest({ code: 'auth-code', state }))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exchanges the code and redirects to /{orgId}/settings?eb_auth=...', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ session_id: 'sess-123', accounts: [] }))

    const res = await GET(callbackRequest({ code: 'auth-code', state: aliceState() }))

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.origin).toBe('http://localhost:3000')
    expect(location.pathname).toBe('/org-acme/settings')
    const payload = JSON.parse(Buffer.from(location.searchParams.get('eb_auth')!, 'base64url').toString('utf8'))
    expect(payload).toEqual({ sessionId: 'sess-123' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.enablebanking.com/sessions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer eb-jwt')
    expect(JSON.parse(String(init.body))).toEqual({ code: 'auth-code' })
  })

  it('redirects to settings with eb_error=1 when the bank returns no code (user cancelled)', async () => {
    const res = await GET(
      callbackRequest({ state: aliceState(), error: 'access_denied', error_description: 'Denied data sharing consent' }),
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/org-acme/settings?eb_error=1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sanitizes error / error_description before logging (no log forging)', async () => {
    errorSpy.mockRestore()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorSpy = log
    await GET(
      callbackRequest({
        state: aliceState(),
        error: 'access_denied\nFAKE LOG LINE: admin logged in',
        error_description: 'x\r\u0000\u001b[31m' + 'a'.repeat(500),
      }),
    )
    const logged = log.mock.calls.flat().filter((a): a is string => typeof a === 'string')
    expect(logged.length).toBeGreaterThan(0)
    for (const a of logged) {
      expect(a).not.toMatch(/[\u0000-\u001f\u007f]/)
    }
    expect(logged.join('|')).toContain('access_denied')
    expect(logged.some((a) => a.includes('a'.repeat(201)))).toBe(false)
  })

  it('redirects to settings with eb_error=1 when the code exchange fails', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ message: 'invalid code' }, 400))
    const res = await GET(callbackRequest({ code: 'auth-code', state: aliceState() }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/org-acme/settings?eb_error=1')
  })

  it('returns 500 "server not configured" when EB_STATE_SECRET is empty', async () => {
    const state = aliceState()
    vi.stubEnv('EB_STATE_SECRET', '')
    const res = await GET(callbackRequest({ code: 'auth-code', state }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
