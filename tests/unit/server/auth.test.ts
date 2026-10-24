import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import {
  errorKind,
  isCredentialError,
  isSessionCookieValid,
  requireOrgRole,
  requireUser,
  requireVerifiedUser,
} from '@/lib/server/auth'

// lib/server/auth.ts talks to Firebase only through getAdmin(); replace it with
// a fake { auth: { verifySessionCookie, getUser }, db: { doc(path).get() } }.
const admin = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  verifySessionCookie: vi.fn(),
  getUser: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/lib/server/firebase-admin', () => ({ getAdmin: admin.getAdmin }))

beforeEach(() => {
  admin.verifySessionCookie.mockReset()
  admin.getUser.mockReset()
  admin.get.mockReset()
  admin.doc.mockReset().mockReturnValue({ get: admin.get })
  admin.getAdmin.mockReset().mockReturnValue({
    auth: {
      verifySessionCookie: admin.verifySessionCookie,
      getUser: admin.getUser,
    },
    db: { doc: admin.doc },
  })
})

function requestWithCookie(
  cookie?: string,
  init: { method?: string; origin?: string } = {},
): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', cookie)
  if (init.origin !== undefined) headers.set('origin', init.origin)
  return new Request('http://localhost/api/test', { method: init.method ?? 'GET', headers })
}

function rejection(code: string, message = 'x'): Error {
  return Object.assign(new Error(message), { code })
}

// Messages firebase-admin 14.5.0 (lib/utils/jwt.js, UrlKeyFetcher) produces when Google's
// signing keys cannot be fetched: an HTTP error response, or a transport failure.
const KEY_FETCH_FAILURES: Array<[string, string]> = [
  [
    'HTTP error response',
    'Error fetching public keys for Google certs: SECRET-BODY (upstream said no)',
  ],
  [
    'transport failure',
    'Error while making request: getaddrinfo ENOTFOUND www.googleapis.com SECRET-BODY. Error code: ENOTFOUND',
  ],
]

describe('requireUser', () => {
  it('returns uid and emailVerified for a valid, unrevoked session cookie', async () => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: true })

    await expect(requireUser(requestWithCookie('__session=good'))).resolves.toEqual({
      uid: 'u1',
      emailVerified: true,
    })
    expect(admin.verifySessionCookie).toHaveBeenCalledWith('good', true)
  })

  it('reports emailVerified=false when the claim is absent or false', async () => {
    admin.verifySessionCookie.mockResolvedValueOnce({ uid: 'u1' })
    await expect(requireUser(requestWithCookie('__session=a'))).resolves.toMatchObject({
      emailVerified: false,
    })
    admin.verifySessionCookie.mockResolvedValueOnce({ uid: 'u1', email_verified: false })
    await expect(requireUser(requestWithCookie('__session=b'))).resolves.toMatchObject({
      emailVerified: false,
    })
  })

  it.each([
    ['no Cookie header', undefined],
    ['other cookies only', 'theme=dark'],
    ['an empty __session', '__session='],
  ])('rejects %s with 401 without calling Firebase', async (_label, cookie) => {
    const err = await requireUser(requestWithCookie(cookie)).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
    expect(admin.verifySessionCookie).not.toHaveBeenCalled()
  })

  it.each([
    'auth/session-cookie-expired',
    'auth/session-cookie-revoked',
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('maps cookie-validity error %s to 401', async (code) => {
    admin.verifySessionCookie.mockRejectedValue(rejection(code))

    const err = await requireUser(requestWithCookie('__session=t')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it.each([
    ['an auth/internal-error', rejection('auth/internal-error', 'boom SECRET-BODY'), 'auth/internal-error'],
    ['a network error', rejection('ENOTFOUND', 'getaddrinfo ENOTFOUND SECRET-BODY'), 'ENOTFOUND'],
    ['an error without a code', new TypeError('fetch failed SECRET-BODY'), 'TypeError'],
  ])('maps %s to 503, logging only the code or name', async (_label, failure, logged) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.verifySessionCookie.mockRejectedValue(failure)

    const err = await requireUser(requestWithCookie('__session=secret-cookie')).catch(
      (e: unknown) => e,
    )

    expect(err).toMatchObject({ status: 503, message: 'auth unavailable' })
    expect(log).toHaveBeenCalledWith('verifySessionCookie failed', logged)
    const dump = JSON.stringify(log.mock.calls)
    expect(dump).not.toContain('SECRET-BODY')
    expect(dump).not.toContain('secret-cookie')
    log.mockRestore()
  })

  it('does not mask a server configuration error as 401', async () => {
    admin.getAdmin.mockImplementation(() => {
      throw new HttpError(500, 'server not configured')
    })

    const err = await requireUser(requestWithCookie('__session=good')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 500, message: 'server not configured' })
  })

  // firebase-admin 14 maps a failure to fetch Google's signing keys to INVALID_ARGUMENT
  // (auth/argument-error), indistinguishable by code from a malformed cookie.
  it.each(KEY_FETCH_FAILURES)(
    'maps a signing-key fetch failure (%s) to 503 although its code is auth/argument-error',
    async (_label, message) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      admin.verifySessionCookie.mockRejectedValue(rejection('auth/argument-error', message))

      const err = await requireUser(requestWithCookie('__session=secret-cookie')).catch(
        (e: unknown) => e,
      )

      expect(err).toMatchObject({ status: 503, message: 'auth unavailable' })
      expect(log).toHaveBeenCalledWith('verifySessionCookie failed', 'auth/argument-error')
      const dump = JSON.stringify(log.mock.calls)
      expect(dump).not.toContain('SECRET-BODY')
      expect(dump).not.toContain('secret-cookie')
      log.mockRestore()
    },
  )

  it('keeps a malformed cookie (auth/argument-error with a decode message) at 401', async () => {
    admin.verifySessionCookie.mockRejectedValue(
      rejection(
        'auth/argument-error',
        'Decoding Firebase session cookie failed. Make sure you passed the entire string JWT.',
      ),
    )

    const err = await requireUser(requestWithCookie('__session=junk')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  describe('same-origin check for unsafe methods', () => {
    beforeEach(() => {
      admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: true })
    })

    it('accepts POST with a matching Origin', async () => {
      await expect(
        requireUser(requestWithCookie('__session=g', { method: 'POST', origin: 'http://localhost' })),
      ).resolves.toMatchObject({ uid: 'u1' })
    })

    it.each([
      ['a foreign Origin', 'https://evil.example'],
      ['no Origin', undefined],
    ])('rejects POST with %s using 403 (after the session was verified)', async (_label, origin) => {
      const err = await requireUser(
        requestWithCookie('__session=g', { method: 'POST', origin }),
      ).catch((e: unknown) => e)

      expect(err).toMatchObject({ status: 403, message: 'forbidden' })
      expect(admin.verifySessionCookie).toHaveBeenCalledWith('g', true)
    })

    it('answers 401, not 403, when the session is invalid and the POST has no Origin', async () => {
      admin.verifySessionCookie.mockRejectedValue(rejection('auth/session-cookie-revoked'))

      const err = await requireUser(requestWithCookie('__session=g', { method: 'POST' })).catch(
        (e: unknown) => e,
      )

      expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
    })

    it('does not check Origin for GET', async () => {
      await expect(
        requireUser(requestWithCookie('__session=g', { origin: 'https://evil.example' })),
      ).resolves.toMatchObject({ uid: 'u1' })
    })

    it('answers an unauthenticated POST with 401, not 403', async () => {
      const err = await requireUser(requestWithCookie(undefined, { method: 'POST' })).catch(
        (e: unknown) => e,
      )
      expect(err).toMatchObject({ status: 401 })
    })
  })
})

describe('requireVerifiedUser', () => {
  beforeEach(() => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: false })
  })

  it('resolves when the live user record says the email is verified (even if the cookie claim is stale)', async () => {
    admin.getUser.mockResolvedValue({ uid: 'u1', emailVerified: true })

    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).resolves.toEqual({
      uid: 'u1',
      emailVerified: true,
    })
    expect(admin.getUser).toHaveBeenCalledWith('u1')
  })

  it('rejects with 403 email_not_verified when the email is not verified', async () => {
    admin.getUser.mockResolvedValue({ uid: 'u1', emailVerified: false })

    const err = await requireVerifiedUser(requestWithCookie('__session=g')).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'email_not_verified' })
  })

  it('rejects with 403 when the cookie claim says verified but the live record does not', async () => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: true })
    admin.getUser.mockResolvedValue({ uid: 'u1', emailVerified: false })

    const err = await requireVerifiedUser(requestWithCookie('__session=g')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 403, message: 'email_not_verified' })
  })

  it('answers 401 without a session and never reads the user record', async () => {
    const err = await requireVerifiedUser(requestWithCookie()).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401 })
    expect(admin.getUser).not.toHaveBeenCalled()
  })

  it('maps a deleted user to 401 and an outage to 503', async () => {
    admin.getUser.mockRejectedValueOnce(rejection('auth/user-not-found'))
    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).rejects.toMatchObject({
      status: 401,
    })

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.getUser.mockRejectedValueOnce(rejection('auth/internal-error'))
    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).rejects.toMatchObject({
      status: 503,
    })
    expect(log).toHaveBeenCalledWith('getUser failed', 'auth/internal-error')
    log.mockRestore()
  })
})

describe('isSessionCookieValid', () => {
  it('is true for a valid cookie and skips the revocation round-trip', async () => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1' })

    await expect(isSessionCookieValid('good')).resolves.toBe(true)
    expect(admin.verifySessionCookie).toHaveBeenCalledWith('good', false)
  })

  it.each(['auth/session-cookie-expired', 'auth/argument-error', 'auth/invalid-id-token'])(
    'is false for %s',
    async (code) => {
      admin.verifySessionCookie.mockRejectedValue(rejection(code))
      await expect(isSessionCookieValid('bad')).resolves.toBe(false)
    },
  )

  it('throws a 503 HttpError on an outage so callers can fail closed without logging users out', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.verifySessionCookie.mockRejectedValue(rejection('auth/internal-error'))

    const err = await isSessionCookieValid('x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 503 })
    expect(log).toHaveBeenCalledWith('verifySessionCookie failed', 'auth/internal-error')
    log.mockRestore()
  })

  it.each(KEY_FETCH_FAILURES)(
    'throws a 503 HttpError, not false, when the signing keys cannot be fetched (%s)',
    async (_label, message) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      admin.verifySessionCookie.mockRejectedValue(rejection('auth/argument-error', message))

      const err = await isSessionCookieValid('x').catch((e: unknown) => e)

      expect(err).toBeInstanceOf(HttpError)
      expect(err).toMatchObject({ status: 503 })
      log.mockRestore()
    },
  )

  it('is false for a malformed cookie (auth/argument-error with a decode message)', async () => {
    admin.verifySessionCookie.mockRejectedValue(
      rejection('auth/argument-error', 'Decoding Firebase session cookie failed.'),
    )

    await expect(isSessionCookieValid('junk')).resolves.toBe(false)
  })

  it('propagates a server configuration error as 500', async () => {
    admin.getAdmin.mockImplementation(() => {
      throw new HttpError(500, 'server not configured')
    })

    const err = await isSessionCookieValid('x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 500, message: 'server not configured' })
  })
})

function memberSnapshot(data: Record<string, unknown> | undefined) {
  return { exists: data !== undefined, data: () => data }
}

describe('requireOrgRole', () => {
  it.each([
    ['owner', ['owner']],
    ['owner', ['owner', 'accountant']],
    ['accountant', ['owner', 'accountant']],
    ['viewer', ['owner', 'accountant', 'viewer']],
  ] as const)('resolves with %s when %j is allowed', async (role, allowed) => {
    admin.get.mockResolvedValue(memberSnapshot({ uid: 'u1', role }))

    await expect(requireOrgRole('u1', 'org1', allowed)).resolves.toBe(role)
    expect(admin.doc).toHaveBeenCalledWith('organizations/org1/members/u1')
  })

  it('rejects with 403 when the user has no membership document', async () => {
    admin.get.mockResolvedValue(memberSnapshot(undefined))

    const err = await requireOrgRole('u1', 'org1', ['owner']).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it.each([
    ['accountant', ['owner']],
    ['viewer', ['owner', 'accountant']],
  ] as const)('rejects a %s when only %j is allowed', async (role, allowed) => {
    admin.get.mockResolvedValue(memberSnapshot({ uid: 'u1', role }))

    const err = await requireOrgRole('u1', 'org1', allowed).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it.each([['admin'], [''], [undefined], [null], [7]])('rejects an unknown role %s', async (role) => {
    admin.get.mockResolvedValue(memberSnapshot({ uid: 'u1', role }))

    const err = await requireOrgRole('u1', 'org1', ['owner', 'accountant', 'viewer']).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it.each([
    ['an empty orgId', 'u1', ''],
    ['an orgId that is a path', 'u1', 'org1/accounts/acc1'],
    ['".."', 'u1', '..'],
    ['"."', 'u1', '.'],
    ['a reserved __x__ id', 'u1', '__x__'],
    ['an id with a newline', 'u1', 'a\nb'],
    ['a 2000-char id', 'u1', 'x'.repeat(2000)],
    ['a non-string orgId', 'u1', 123 as never],
    ['null orgId', 'u1', null as never],
    ['an empty uid', '', 'org1'],
    ['a uid with a slash', 'a/b', 'org1'],
    ['a non-string uid', 5 as never, 'org1'],
  ])('rejects %s with 403 without reading Firestore', async (_label, uid, orgId) => {
    const err = await requireOrgRole(uid, orgId, ['owner']).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
    expect(admin.doc).not.toHaveBeenCalled()
  })

  it('lets Firestore failures propagate (they become 500, not 403)', async () => {
    const outage = new Error('UNAVAILABLE')
    admin.get.mockRejectedValue(outage)

    await expect(requireOrgRole('u1', 'org1', ['owner'])).rejects.toBe(outage)
  })
})

describe('isCredentialError / errorKind', () => {
  it('treats Admin SDK credential rejections as credential errors', () => {
    for (const code of ['auth/argument-error', 'auth/user-disabled', 'auth/session-cookie-expired']) {
      expect(isCredentialError(Object.assign(new Error('x'), { code }))).toBe(true)
    }
  })

  it('does not treat outages, unknown codes, key-fetch failures or non-errors as credential errors', () => {
    expect(isCredentialError(Object.assign(new Error('x'), { code: 'auth/internal-error' }))).toBe(false)
    expect(isCredentialError(new Error('plain'))).toBe(false)
    expect(isCredentialError(null)).toBe(false)
    expect(
      isCredentialError(
        Object.assign(new Error('Error fetching public keys for Google certs: boom'), {
          code: 'auth/argument-error',
        }),
      ),
    ).toBe(false)
  })

  it('labels a failure by code, else class name, else typeof', () => {
    expect(errorKind(Object.assign(new Error('x'), { code: 'auth/internal-error' }))).toBe('auth/internal-error')
    expect(errorKind(new TypeError('x'))).toBe('TypeError')
    expect(errorKind('boom')).toBe('string')
  })
})
