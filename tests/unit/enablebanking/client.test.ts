import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ebFetch } from '@/lib/enablebanking/client'

const fakeAuth = vi.hoisted(() => ({
  authStateReady: vi.fn(async () => {}),
  currentUser: null as null | { getIdToken: () => Promise<string> },
}))
vi.mock('@/lib/firebase/firebase', () => ({ auth: fakeAuth }))

const fetchMock = vi.fn()

describe('ebFetch', () => {
  beforeEach(() => {
    fakeAuth.authStateReady.mockClear()
    fakeAuth.currentUser = { getIdToken: vi.fn(async () => 'id-token-1') }
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds Authorization: Bearer <ID token> and keeps method, body and other headers', async () => {
    await ebFetch('/api/enablebanking/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"orgId":"org-acme"}',
    })

    expect(fakeAuth.authStateReady).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/enablebanking/session')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"orgId":"org-acme"}')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer id-token-1')
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('works without init (plain GET)', async () => {
    const res = await ebFetch('/api/enablebanking/institutions?country=PL')
    expect(res.status).toBe(200)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer id-token-1')
  })

  it('throws "not signed in" when there is no current user', async () => {
    fakeAuth.currentUser = null
    await expect(ebFetch('/api/enablebanking/institutions')).rejects.toThrow('not signed in')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to send the ID token anywhere except /api/enablebanking/*', async () => {
    await expect(ebFetch('https://evil.example/api/enablebanking/x')).rejects.toThrow(
      'ebFetch: only /api/enablebanking/* paths are allowed',
    )
    await expect(ebFetch('/api/other')).rejects.toThrow('ebFetch: only /api/enablebanking/* paths are allowed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    '/api/enablebanking/../x',
    '/api/enablebanking/a/../../other',
    '/api/enablebanking/%2e%2e/x',
    '/api/enablebanking/./x',
    '//evil.example',
    '/api/enablebanking//x',
    '/api/enablebanking/a\\..\\x',
  ])('rejects the path-traversal / double-slash path %s', async (path) => {
    await expect(ebFetch(path)).rejects.toThrow('ebFetch: only /api/enablebanking/* paths are allowed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still allows "//" inside the query string', async () => {
    await ebFetch('/api/enablebanking/institutions?next=https://x.test/a')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
