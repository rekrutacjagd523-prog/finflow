import { vi } from 'vitest'

/**
 * In-memory stand-in for getAdmin() from '@/lib/server/firebase-admin'.
 * Route tests mock that module with `{ getAdmin: () => fakeAdmin }`, so the REAL
 * requireUser / requireVerifiedUser / requireOrgMember from '@/lib/server/auth' run against this data.
 * Only `organizations/{orgId}` documents are modelled; both db.doc(path) and
 * db.collection(name).doc(id) access styles are supported.
 */
export const fakeOrgs = new Map<string, Record<string, unknown>>()

/** Accepted credential -> uid. Used for BOTH session-cookie values and ID tokens. */
export const fakeTokens = new Map<string, string>()

/** uids whose email is NOT verified (everyone else is verified). */
export const fakeUnverified = new Set<string>()

/** ID token -> seconds since its sign-in (default 0 = just signed in). */
export const fakeIdTokenAgeSec = new Map<string, number>()

export const TEST_EB_STATE_SECRET = 'route-test-secret-0123456789abcdef'
export const TEST_APP_URL = 'https://finflow.test'

function snapshotFor(path: string) {
  const segments = path.split('/')
  const data =
    segments.length === 2 && segments[0] === 'organizations' ? fakeOrgs.get(segments[1]) : undefined
  return {
    id: segments[segments.length - 1],
    exists: data !== undefined,
    data: () => data,
    get: (field: string) => (data === undefined ? undefined : data[field]),
  }
}

function docRef(path: string) {
  return {
    id: path.split('/').pop(),
    path,
    get: async () => snapshotFor(path),
  }
}

function invalid(what: string): Error {
  // Like the real Admin SDK: a rejected credential carries an `auth/...` code, which
  // toAuthHttpError maps to 401 (errors without such a code become 503).
  return Object.assign(new Error(`invalid ${what}`), { code: 'auth/argument-error' })
}

export const fakeAdmin = {
  db: {
    doc: (path: string) => docRef(path),
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
  },
  auth: {
    verifyIdToken: vi.fn(async (token: string) => {
      const uid = fakeTokens.get(token)
      if (!uid) throw invalid('id token')
      return {
        uid,
        auth_time: Math.floor(Date.now() / 1000) - (fakeIdTokenAgeSec.get(token) ?? 0),
      }
    }),
    verifySessionCookie: vi.fn(async (cookie: string) => {
      const uid = fakeTokens.get(cookie)
      if (!uid) throw invalid('session cookie')
      return { uid, email_verified: !fakeUnverified.has(uid) }
    }),
    getUser: vi.fn(async (uid: string) => {
      if (![...fakeTokens.values()].includes(uid)) {
        throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' })
      }
      return { uid, emailVerified: !fakeUnverified.has(uid) }
    }),
    createSessionCookie: vi.fn<(idToken: string, options: { expiresIn: number }) => Promise<string>>(
      async () => 'minted-session-cookie',
    ),
    revokeRefreshTokens: vi.fn<(uid: string) => Promise<void>>(async () => {}),
  },
}

/**
 * Resets the fixture:
 *  - alice owns org-acme and has a verified email;
 *  - mallory is signed in with a verified email but is not a member of anything;
 *  - bob is signed in but his email is NOT verified.
 * Each user has a credential named token-<name> (works as an ID token and as a session cookie).
 */
export function resetFakeAdmin(): void {
  fakeOrgs.clear()
  fakeTokens.clear()
  fakeUnverified.clear()
  fakeIdTokenAgeSec.clear()
  fakeTokens.set('token-alice', 'user-alice')
  fakeTokens.set('token-mallory', 'user-mallory')
  fakeTokens.set('token-bob', 'user-bob')
  fakeUnverified.add('user-bob')
  fakeOrgs.set('org-acme', {
    name: 'Acme',
    currency: 'PLN',
    ownerId: 'user-alice',
    plan: 'trial',
    members: { 'user-alice': { role: 'owner' } },
  })
  for (const fn of Object.values(fakeAdmin.auth)) fn.mockReset()
}

/** A JSON Response, as returned by the mocked global fetch for Enable Banking calls. */
export function upstreamJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
