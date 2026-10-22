import { vi } from 'vitest'

/**
 * In-memory stand-in for getAdmin() from '@/lib/server/firebase-admin'.
 * Route tests mock that module with `{ getAdmin: () => fakeAdmin }`, so the REAL
 * requireUserFromBearer / requireOrgMember from '@/lib/server/auth' run against this data.
 * Only `organizations/{orgId}` documents are modelled; both db.doc(path) and
 * db.collection(name).doc(id) access styles are supported.
 */
export const fakeOrgs = new Map<string, Record<string, unknown>>()

/** Firebase ID token -> uid accepted by the fake verifyIdToken. */
export const fakeTokens = new Map<string, string>()

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

export const fakeAdmin = {
  db: {
    doc: (path: string) => docRef(path),
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
  },
  auth: {
    verifyIdToken: vi.fn(async (token: string) => {
      const uid = fakeTokens.get(token)
      // Like the real Admin SDK: a rejected token carries an `auth/...` code, which
      // requireUserFromBearer maps to 401 (errors without such a code become 503).
      if (!uid) throw Object.assign(new Error('invalid id token'), { code: 'auth/invalid-id-token' })
      return { uid }
    }),
  },
}

/** Resets the fixture: alice owns org-acme; mallory is signed in but not a member of anything. */
export function resetFakeAdmin(): void {
  fakeOrgs.clear()
  fakeTokens.clear()
  fakeTokens.set('token-alice', 'user-alice')
  fakeTokens.set('token-mallory', 'user-mallory')
  fakeOrgs.set('org-acme', {
    name: 'Acme',
    currency: 'PLN',
    ownerId: 'user-alice',
    plan: 'trial',
    members: { 'user-alice': { role: 'owner' } },
  })
  fakeAdmin.auth.verifyIdToken.mockClear()
}

/** A JSON Response, as returned by the mocked global fetch for Enable Banking calls. */
export function upstreamJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
