import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { clearSession, establishSession } from '@/lib/firebase/session'

const fetchMock = vi.fn()

function fakeUser(token = 'id-token-1') {
  const getIdToken = vi.fn<(forceRefresh?: boolean) => Promise<string>>(async () => token)
  return { user: { getIdToken } as unknown as User, getIdToken }
}

describe('establishSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts a force-refreshed ID token to /api/auth/session', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const { user, getIdToken } = fakeUser()

    await establishSession(user)

    expect(getIdToken).toHaveBeenCalledWith(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/session')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(String(init.body))).toEqual({ idToken: 'id-token-1' })
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('throws when the server refuses the session', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"reauth_required"}', { status: 401 }))
    await expect(establishSession(fakeUser().user)).rejects.toThrow('session setup failed (401)')
  })
})

describe('clearSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts to /api/auth/logout', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await clearSession()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/logout')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
  })

  it('never throws (offline): the cookie then expires on its own', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(clearSession()).resolves.toBeUndefined()
  })
})
