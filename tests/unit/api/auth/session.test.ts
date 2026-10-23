import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAdmin, fakeIdTokenAgeSec, resetFakeAdmin } from '@/tests/unit/helpers/fake-admin'
import { POST } from '@/app/api/auth/session/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})

function mintRequest(body: unknown, origin: string | null = 'http://localhost:3000'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin !== null) headers.Origin = origin
  return new Request('http://localhost:3000/api/auth/session', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/auth/session', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('mints a 7-day HttpOnly session cookie for a freshly issued ID token', async () => {
    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(
      '__session=minted-session-cookie; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax',
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fakeAdmin.auth.verifyIdToken).toHaveBeenCalledWith('token-alice', true)
    expect(fakeAdmin.auth.createSessionCookie).toHaveBeenCalledWith('token-alice', {
      expiresIn: 604800 * 1000,
    })
  })

  it('adds Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await POST(mintRequest({ idToken: 'token-alice' }))
    expect(res.headers.get('set-cookie')).toContain('; Secure')
  })

  it('accepts a sign-in that is just inside the 5-minute window', async () => {
    fakeIdTokenAgeSec.set('token-alice', 299)
    expect((await POST(mintRequest({ idToken: 'token-alice' }))).status).toBe(204)
  })

  it('refuses a sign-in older than 5 minutes with 401 reauth_required and mints nothing', async () => {
    fakeIdTokenAgeSec.set('token-alice', 301)

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'reauth_required' })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.createSessionCookie).not.toHaveBeenCalled()
  })

  it.each([
    ['a foreign Origin', 'https://evil.example'],
    ['no Origin', null],
  ])('returns 403 for %s before touching Firebase', async (_label, origin) => {
    const res = await POST(mintRequest({ idToken: 'token-alice' }, origin))

    expect(res.status).toBe(403)
    expect(fakeAdmin.auth.verifyIdToken).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', 'not json'],
    ['an empty object', {}],
    ['a non-string idToken', { idToken: 123 }],
    ['an empty idToken', { idToken: '' }],
    ['an oversized idToken', { idToken: 'x'.repeat(5000) }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await POST(mintRequest(body))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing params' })
    expect(fakeAdmin.auth.verifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 for an ID token Firebase rejects', async () => {
    const res = await POST(mintRequest({ idToken: 'token-forged' }))

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.createSessionCookie).not.toHaveBeenCalled()
  })

  it('returns 503 when ID token verification fails for reasons on our side', async () => {
    fakeAdmin.auth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'auth/internal-error' }),
    )

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'auth unavailable' })
  })

  it('returns 503 when Firebase cannot mint the cookie', async () => {
    fakeAdmin.auth.createSessionCookie.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'auth/internal-error' }),
    )

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(503)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
