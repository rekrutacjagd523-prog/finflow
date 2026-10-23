import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import {
  errorKind,
  isCredentialError,
  isOrgMember,
  isSessionCookieValid,
  requireOrgMember,
  requireUser,
  requireUserFromBearer,
  requireVerifiedUser,
} from '@/lib/server/auth'

// lib/server/auth.ts talks to Firebase only through getAdmin(); replace it with
// a fake { auth: { verifyIdToken, verifySessionCookie, getUser }, db: { doc(path).get() } }.
const admin = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  verifySessionCookie: vi.fn(),
  getUser: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/lib/server/firebase-admin', () => ({ getAdmin: admin.getAdmin }))

beforeEach(() => {
  admin.verifyIdToken.mockReset()
  admin.verifySessionCookie.mockReset()
  admin.getUser.mockReset()
  admin.get.mockReset()
  admin.doc.mockReset().mockReturnValue({ get: admin.get })
  admin.getAdmin.mockReset().mockReturnValue({
    auth: {
      verifyIdToken: admin.verifyIdToken,
      verifySessionCookie: admin.verifySessionCookie,
      getUser: admin.getUser,
    },
    db: { doc: admin.doc },
  })
})

describe('isOrgMember', () => {
  const org = { name: 'Acme', ownerId: 'u1', members: { u1: { role: 'owner' } } }

  it('is true when members has the uid as an own key', () => {
    expect(isOrgMember(org, 'u1')).toBe(true)
  })

  it('is false when the uid is not a member', () => {
    expect(isOrgMember(org, 'u2')).toBe(false)
  })

  it('is false for an empty uid', () => {
    expect(isOrgMember({ members: { '': {} } }, '')).toBe(false)
  })

  it.each([undefined, null, 'org', 42, true])('is false when orgData is %s', (orgData) => {
    expect(isOrgMember(orgData, 'u1')).toBe(false)
  })

  it.each([undefined, null, 'u1', ['u1']])('is false when members is %s', (members) => {
    expect(isOrgMember({ members }, 'u1')).toBe(false)
  })

  it('is false for __proto__ (own-key check, no prototype access)', () => {
    expect(isOrgMember({ members: {} }, '__proto__')).toBe(false)
    expect(isOrgMember(JSON.parse('{"members":{}}'), '__proto__')).toBe(false)
  })

  it('is true for a member whose value is null (pins Firestore `uid in members` key semantics)', () => {
    expect(isOrgMember({ members: { u1: null } }, 'u1')).toBe(true)
  })

  it('ignores inherited keys', () => {
    const members = Object.create({ u1: { role: 'owner' } }) as object
    expect(isOrgMember({ members }, 'u1')).toBe(false)
    expect(isOrgMember({ members: {} }, 'toString')).toBe(false)
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

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers()
  if (authorization !== undefined) headers.set('authorization', authorization)
  return new Request('http://localhost/api/test', { headers })
}

describe('requireUserFromBearer', () => {
  it('returns the uid of a valid, unrevoked ID token', async () => {
    admin.verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@example.com' })

    await expect(requireUserFromBearer(requestWithAuth('Bearer good-token'))).resolves.toEqual({
      uid: 'u1',
    })
    expect(admin.verifyIdToken).toHaveBeenCalledWith('good-token', true)
  })

  it('accepts the scheme case-insensitively', async () => {
    admin.verifyIdToken.mockResolvedValue({ uid: 'u1' })

    await expect(requireUserFromBearer(requestWithAuth('bearer good-token'))).resolves.toEqual({
      uid: 'u1',
    })
  })

  it.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['Bearer without a token', 'Bearer'],
    ['a token containing spaces', 'Bearer abc def'],
  ])('rejects %s with 401 without calling Firebase', async (_label, header) => {
    const err = await requireUserFromBearer(requestWithAuth(header)).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
    expect(admin.verifyIdToken).not.toHaveBeenCalled()
  })

  it('rejects with 401 when verifyIdToken throws (invalid, expired or revoked token)', async () => {
    admin.verifyIdToken.mockRejectedValue(
      Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' }),
    )

    const err = await requireUserFromBearer(requestWithAuth('Bearer revoked-token')).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it.each([
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('maps token-validity error %s to 401', async (code) => {
    admin.verifyIdToken.mockRejectedValue(Object.assign(new Error('x'), { code }))

    const err = await requireUserFromBearer(requestWithAuth('Bearer t')).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it.each([
    ['an auth/internal-error', Object.assign(new Error('boom SECRET-BODY'), { code: 'auth/internal-error' }), 'auth/internal-error'],
    ['a network error', Object.assign(new Error('getaddrinfo ENOTFOUND SECRET-BODY'), { code: 'ENOTFOUND' }), 'ENOTFOUND'],
    ['an error without a code', new TypeError('fetch failed SECRET-BODY'), 'TypeError'],
  ])('maps %s to 503, logging only the code or name', async (_label, failure, logged) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.verifyIdToken.mockRejectedValue(failure)

    const err = await requireUserFromBearer(requestWithAuth('Bearer secret-token')).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 503, message: 'auth unavailable' })
    expect(log).toHaveBeenCalledWith('verifyIdToken failed', logged)
    const dump = JSON.stringify(log.mock.calls)
    expect(dump).not.toContain('SECRET-BODY')
    expect(dump).not.toContain('secret-token')
    log.mockRestore()
  })

  it('does not mask a server configuration error as 401', async () => {
    admin.getAdmin.mockImplementation(() => {
      throw new HttpError(500, 'server not configured')
    })

    const err = await requireUserFromBearer(requestWithAuth('Bearer good-token')).catch(
      (e: unknown) => e,
    )

    expect(err).toMatchObject({ status: 500, message: 'server not configured' })
  })
})

function orgSnapshot(data: Record<string, unknown> | undefined) {
  return { exists: data !== undefined, data: () => data }
}

describe('requireOrgMember', () => {
  it('resolves when the user is in organizations/{orgId}.members', async () => {
    admin.get.mockResolvedValue(orgSnapshot({ ownerId: 'u1', members: { u1: { role: 'owner' } } }))

    await expect(requireOrgMember('u1', 'org1')).resolves.toBeUndefined()
    expect(admin.doc).toHaveBeenCalledWith('organizations/org1')
  })

  it('rejects with 403 when the organization does not exist', async () => {
    admin.get.mockResolvedValue(orgSnapshot(undefined))

    const err = await requireOrgMember('u1', 'missing-org').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it('rejects with 403 when the user is not a member', async () => {
    admin.get.mockResolvedValue(orgSnapshot({ ownerId: 'u2', members: { u2: { role: 'owner' } } }))

    const err = await requireOrgMember('u1', 'org1').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it.each([
    ['an empty orgId', ''],
    ['an orgId that is a path', 'org1/accounts/acc1'],
    ['".."', '..'],
    ['"."', '.'],
    ['a/b', 'a/b'],
    ['a reserved __x__ id', '__x__'],
    ['an id with a newline', 'a\nb'],
    ['a 2000-char id', 'x'.repeat(2000)],
    ['a non-string', 123 as never],
    ['null', null as never],
  ])('rejects %s with 403 without reading Firestore', async (_label, orgId) => {
    const err = await requireOrgMember('u1', orgId).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
    expect(admin.doc).not.toHaveBeenCalled()
  })

  it('lets Firestore failures propagate (they become 500, not 403)', async () => {
    const outage = new Error('UNAVAILABLE')
    admin.get.mockRejectedValue(outage)

    await expect(requireOrgMember('u1', 'org1')).rejects.toBe(outage)
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
