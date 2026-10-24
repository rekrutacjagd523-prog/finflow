import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFakeAdmin, upstreamJson } from '@/tests/unit/helpers/fake-admin'
import { GET } from '@/app/api/enablebanking/accounts/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})
vi.mock('@/lib/enablebanking/jwt', () => ({ createJwt: vi.fn(async () => 'eb-jwt') }))

const fetchMock = vi.fn()
const SESSION_ID = '3f1c9a52-7d0e-4b8e-9a6f-0c2d4e5f6a7b'

function accountsRequest(query: Record<string, string>, token?: string): Request {
  const url = new URL('http://localhost:3000/api/enablebanking/accounts')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new Request(url, { headers: token ? { Cookie: `__session=${token}` } : {} })
}

describe('GET /api/enablebanking/accounts', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('returns 401 without a session cookie', async () => {
    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 401 for a forged session cookie', async () => {
    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }, 'token-forged'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await GET(accountsRequest({ orgId: 'org-acme' }, 'token-alice'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing sessionId' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId contains path characters', async () => {
    const res = await GET(accountsRequest({ sessionId: '../aspsps', orgId: 'org-acme' }, 'token-alice'))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 when orgId is missing', async () => {
    const res = await GET(accountsRequest({ sessionId: SESSION_ID }, 'token-alice'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing orgId' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a member of the org', async () => {
    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }, 'token-mallory'))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['accountant', 'token-carol'],
    ['viewer', 'token-dave'],
  ])('returns 403 for a %s (bank connections are owner-only)', async (_role, token) => {
    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }, token))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the existing upstream call and returns { accounts }', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ accounts: ['497f6eca-6276-4993-bfeb-53cbbbba6f08'] }))

    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }, 'token-alice'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ accounts: ['497f6eca-6276-4993-bfeb-53cbbbba6f08'] })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // Unchanged in S00 (see the note above the steps); S09 moves it to GET /sessions/{session_id}.
    expect(url).toBe(`https://api.enablebanking.com/sessions/${SESSION_ID}/accounts`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer eb-jwt')
  })

  it('maps an Enable Banking failure to 502', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ message: 'session not found' }, 404))
    const res = await GET(accountsRequest({ sessionId: SESSION_ID, orgId: 'org-acme' }, 'token-alice'))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'enable banking error' })
  })
})
