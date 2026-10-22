import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import { isOrgMember, requireOrgMember, requireUserFromBearer } from '@/lib/server/auth'

// lib/server/auth.ts talks to Firebase only through getAdmin(); replace it with
// a fake { auth: { verifyIdToken }, db: { doc(path).get() } }.
const admin = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/lib/server/firebase-admin', () => ({ getAdmin: admin.getAdmin }))

beforeEach(() => {
  admin.verifyIdToken.mockReset()
  admin.get.mockReset()
  admin.doc.mockReset().mockReturnValue({ get: admin.get })
  admin.getAdmin.mockReset().mockReturnValue({
    auth: { verifyIdToken: admin.verifyIdToken },
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
