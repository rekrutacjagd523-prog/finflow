import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { readSessionCookie } from '@/lib/server/session-cookie'

// RFC 7235: the auth scheme is case-insensitive; the token is one opaque word.
const BEARER = /^Bearer (\S+)$/i

// Firestore document id allow-list for ids that arrive from the request.
// Dots are excluded ('.' and '..' are invalid ids); ids matching __.*__ are
// reserved by Firestore, so they are refused as well.
const ORG_ID = /^[A-Za-z0-9_-]{1,128}$/
const RESERVED_ID = /^__.*__$/

// Admin SDK errors that mean "this token / cookie is not acceptable" (a client
// problem). Everything else is an outage/bug on our side and must not look
// like a bad credential.
const TOKEN_ERROR_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
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
 * Maps a failed Admin Auth call to an HttpError: 401 for credential problems, 503 for
 * everything else. `operation` only labels the log line; the error code or class name is
 * logged, never the message body (it can quote the token or cookie).
 */
export function toAuthHttpError(e: unknown, operation: string): HttpError {
  const code = (e as { code?: unknown } | null)?.code
  if (typeof code === 'string' && TOKEN_ERROR_CODES.has(code)) {
    return new HttpError(401, 'unauthorized')
  }
  const kind = typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
  console.error(`${operation} failed`, kind)
  return new HttpError(503, 'auth unavailable')
}

export type SessionUser = { uid: string; emailVerified: boolean }

/**
 * Authenticates a request by its `__session` cookie, verified with revocation checking.
 * 401 for a missing/invalid/expired/revoked cookie, 503 when verification itself fails.
 * For POST/PUT/PATCH/DELETE the `Origin` must also match the host (403 otherwise); the
 * session is checked first so unauthenticated callers always get 401.
 * `emailVerified` is the claim frozen into the cookie at sign-in: use requireVerifiedUser
 * for decisions that depend on verification.
 */
export async function requireUser(req: Request): Promise<SessionUser> {
  const cookie = readSessionCookie(req.headers)
  if (!cookie) throw new HttpError(401, 'unauthorized')

  // Outside the try: a missing service account must surface as 500, not 401.
  const { auth } = getAdmin()
  let uid: string
  let claimVerified: boolean
  try {
    const decoded = await auth.verifySessionCookie(cookie, true)
    uid = decoded.uid
    claimVerified = decoded.email_verified === true
  } catch (e) {
    throw toAuthHttpError(e, 'verifySessionCookie')
  }

  assertSameOrigin(req)
  return { uid, emailVerified: claimVerified }
}

/**
 * requireUser plus a live check that the user's email is verified (403 `email_not_verified`
 * otherwise). Reads the user record because the cookie's claim would stay stale after the
 * user verifies their address.
 */
export async function requireVerifiedUser(req: Request): Promise<SessionUser> {
  const user = await requireUser(req)

  let verified: boolean
  try {
    verified = (await getAdmin().auth.getUser(user.uid)).emailVerified
  } catch (e) {
    throw toAuthHttpError(e, 'getUser')
  }
  if (!verified) throw new HttpError(403, 'email_not_verified')
  return { uid: user.uid, emailVerified: true }
}

/**
 * Signature + expiry check of a session cookie WITHOUT the revocation round-trip. Used by
 * proxy.ts on every page navigation; API routes use requireUser for the full check.
 * Returns false for an unacceptable cookie; throws HttpError(503) when verification failed
 * for reasons on our side (the proxy then answers 503 instead of logging everyone out).
 */
export async function isSessionCookieValid(cookie: string): Promise<boolean> {
  const { auth } = getAdmin()
  try {
    await auth.verifySessionCookie(cookie, false)
    return true
  } catch (e) {
    const err = toAuthHttpError(e, 'verifySessionCookie')
    if (err.status === 401) return false
    throw err
  }
}

/**
 * Reads `Authorization: Bearer <Firebase ID token>` and verifies it with
 * revocation checking. Throws HttpError(401) for a missing/malformed header or
 * any token the Admin SDK rejects as invalid, and HttpError(503) when
 * verification itself fails (outage). Removed in S01 Task 7 (routes use requireUser).
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
    throw toAuthHttpError(e, 'verifyIdToken')
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
