import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { HttpError } from '@/lib/server/http-error'

// RFC 7235: the auth scheme is case-insensitive; the token is one opaque word.
const BEARER = /^Bearer (\S+)$/i

// Firestore document id allow-list for ids that arrive from the request.
// Dots are excluded ('.' and '..' are invalid ids); ids matching __.*__ are
// reserved by Firestore, so they are refused as well.
const ORG_ID = /^[A-Za-z0-9_-]{1,128}$/
const RESERVED_ID = /^__.*__$/

// verifyIdToken errors that mean "this token is not acceptable" (a client
// problem). Everything else is an outage/bug on our side and must not look
// like a bad token.
const TOKEN_ERROR_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/user-disabled',
  'auth/user-not-found',
])

/**
 * Pure membership check against an organizations/{orgId} document's data.
 * Mirrors the Firestore rule `request.auth.uid in resource.data.members`.
 */
export function isOrgMember(orgData: unknown, uid: string): boolean {
  if (!uid || typeof orgData !== 'object' || orgData === null) return false
  const members: unknown = (orgData as { members?: unknown }).members
  if (typeof members !== 'object' || members === null || Array.isArray(members)) return false
  return Object.hasOwn(members, uid)
}

/**
 * Reads `Authorization: Bearer <Firebase ID token>` and verifies it with
 * revocation checking. Throws HttpError(401) for a missing/malformed header or
 * any token the Admin SDK rejects as invalid, and HttpError(503) when
 * verification itself fails (outage). Temporary until S01 session cookies.
 */
export async function requireUserFromBearer(req: Request): Promise<{ uid: string }> {
  const match = BEARER.exec(req.headers.get('authorization') ?? '')
  if (!match) throw new HttpError(401, 'unauthorized')

  // Outside the try: a missing service account must surface as 500, not 401.
  const { auth } = getAdmin()
  try {
    const decoded = await auth.verifyIdToken(match[1], true)
    return { uid: decoded.uid }
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code
    if (typeof code === 'string' && TOKEN_ERROR_CODES.has(code)) {
      throw new HttpError(401, 'unauthorized')
    }
    // Log the error code or class name only: never the token or the message body.
    const kind = typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
    console.error('verifyIdToken failed', kind)
    throw new HttpError(503, 'auth unavailable')
  }
}

/**
 * Throws HttpError(403) unless organizations/{orgId} exists and lists uid in
 * its `members` map. Reads with the Admin SDK (bypasses security rules).
 * Temporary until S02 moves membership to its own document.
 */
export async function requireOrgMember(uid: string, orgId: string): Promise<void> {
  // orgId comes from the request: allow-list a single plain doc id, otherwise
  // "org1/accounts/x" would read a different document. Same error as a
  // non-member so ids cannot be probed.
  if (typeof orgId !== 'string' || !ORG_ID.test(orgId) || RESERVED_ID.test(orgId)) {
    throw new HttpError(403, 'forbidden')
  }

  const snap = await getAdmin().db.doc(`organizations/${orgId}`).get()
  if (!snap.exists || !isOrgMember(snap.data(), uid)) {
    throw new HttpError(403, 'forbidden')
  }
}
