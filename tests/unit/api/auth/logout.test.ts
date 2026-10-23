import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { fakeAdmin, resetFakeAdmin } from '@/tests/unit/helpers/fake-admin'
import { POST } from '@/app/api/auth/logout/route'
import { HttpError } from '@/lib/server/http-error'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})

const CLEARED = '__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'

function logoutRequest(cookie?: string, origin: string | null = 'http://localhost:3000'): Request {
  const headers: Record<string, string> = {}
  if (origin !== null) headers.Origin = origin
  if (cookie !== undefined) headers.Cookie = cookie
  return new Request('http://localhost:3000/api/auth/logout', { method: 'POST', headers })
}

describe('POST /api/auth/logout', () => {
  let errorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    resetFakeAdmin()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('revokes the refresh tokens of a valid session and clears the cookie', async () => {
    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.verifySessionCookie).toHaveBeenCalledWith('token-alice', true)
    expect(fakeAdmin.auth.revokeRefreshTokens).toHaveBeenCalledWith('user-alice')
  })

  it('clears an already revoked cookie without revoking the newer sessions and without logging', async () => {
    // A stale tab or device must not log the user out of the session they started since. Like the
    // real SDK, a revoked cookie still decodes when the revocation check is skipped.
    fakeAdmin.auth.verifySessionCookie.mockImplementationOnce(async (_cookie: string, checkRevoked?: boolean) => {
      if (checkRevoked) throw Object.assign(new Error('revoked'), { code: 'auth/session-cookie-revoked' })
      return { uid: 'user-alice', email_verified: true }
    })

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
    expect(errorSpy.mock.calls).toEqual([])
  })

  it('clears an expired cookie without revoking anything and without logging', async () => {
    fakeAdmin.auth.verifySessionCookie.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { code: 'auth/session-cookie-expired' }),
    )

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
    expect(errorSpy.mock.calls).toEqual([])
  })

  it('clears the cookie and answers 204 even without a session', async () => {
    const res = await POST(logoutRequest())

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })

  it('clears a garbage cookie without revoking anything and without logging', async () => {
    const res = await POST(logoutRequest('__session=garbage'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
    expect(errorSpy.mock.calls).toEqual([])
  })

  it('still clears the cookie when the Admin SDK is not configured', async () => {
    fakeAdmin.auth.verifySessionCookie.mockRejectedValueOnce(new HttpError(500, 'server not configured'))

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })

  it('still clears the cookie when the session check has an outage, logging only the code', async () => {
    fakeAdmin.auth.verifySessionCookie.mockRejectedValueOnce(
      Object.assign(new Error('boom SECRET-BODY'), { code: 'auth/internal-error' }),
    )

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('SECRET-BODY')
    expect(errorSpy).toHaveBeenCalledWith('logout revoke failed', 'auth/internal-error')
  })

  it('still clears the cookie when revocation fails, logging only the code', async () => {
    fakeAdmin.auth.revokeRefreshTokens.mockRejectedValueOnce(
      Object.assign(new Error('boom SECRET-BODY'), { code: 'auth/internal-error' }),
    )
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET-BODY')
    expect(log).toHaveBeenCalledWith('logout revoke failed', 'auth/internal-error')
    log.mockRestore()
  })

  it.each([
    ['a foreign Origin', 'https://evil.example'],
    ['no Origin', null],
  ])('returns 403 for %s and neither clears nor revokes', async (_label, origin) => {
    const res = await POST(logoutRequest('__session=token-alice', origin))

    expect(res.status).toBe(403)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })
})
