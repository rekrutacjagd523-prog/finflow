import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ebFetch } from '@/lib/enablebanking/client'
import { clearSession } from '@/lib/firebase/session'

vi.mock('@/lib/firebase/session', () => ({ clearSession: vi.fn() }))

const fetchMock = vi.fn()
const assign = vi.fn()
const clearSessionMock = vi.mocked(clearSession)

describe('ebFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    assign.mockReset()
    clearSessionMock.mockReset()
    clearSessionMock.mockResolvedValue(undefined)
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { location: { pathname: '/org-acme/settings', search: '?x=1', assign } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends same-origin credentials and never an Authorization header; keeps method, body and headers', async () => {
    await ebFetch('/api/enablebanking/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"orgId":"org-acme"}',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/enablebanking/session')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"orgId":"org-acme"}')
    expect(init.credentials).toBe('same-origin')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('works without init (plain GET)', async () => {
    const res = await ebFetch('/api/enablebanking/institutions?country=PL')
    expect(res.status).toBe(200)
    expect(assign).not.toHaveBeenCalled()
  })

  it('sends the user to /login (and back afterwards) on a 401', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))

    const res = await ebFetch('/api/enablebanking/institutions')

    expect(res.status).toBe(401)
    expect(assign).toHaveBeenCalledWith('/login?redirect=%2Forg-acme%2Fsettings%3Fx%3D1')
  })

  it('clears the rejected session cookie before navigating on a 401', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    const order: string[] = []
    clearSessionMock.mockImplementation(async () => {
      order.push('clearSession')
    })
    assign.mockImplementation(() => {
      order.push('assign')
    })

    await ebFetch('/api/enablebanking/institutions')

    expect(order).toEqual(['clearSession', 'assign'])
  })

  it.each([403, 500])('does not redirect on %s', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }))
    await ebFetch('/api/enablebanking/institutions')
    expect(assign).not.toHaveBeenCalled()
    expect(clearSessionMock).not.toHaveBeenCalled()
  })

  it('refuses any path outside /api/enablebanking/*', async () => {
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
