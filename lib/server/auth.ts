import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { readSessionCookie } from '@/lib/server/session-cookie'
import { isRole, type Role } from '@/lib/shell/permissions'

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

// firebase-admin 14 reports a failure to fetch Google's signing keys (lib/utils/jwt.js,
// UrlKeyFetcher.refresh -> token-verifier mapJwtErrorToAuthError) as INVALID_ARGUMENT, i.e.
// `auth/argument-error`, which is indistinguishable by code from a malformed cookie. Only
// the message tells them apart. Both prefixes are fixed SDK texts; messages that quote
// caller-controlled data (decode, alg, aud, iss, sub) start with "Firebase ...", never these.
const KEY_FETCH_FAILURE_PREFIXES = [
  'Error fetching public keys for Google certs: ', // HTTP error response from the certs URL
  'Error while making request: ', // transport failure (DNS, timeout, reset)
]

/** True when `e` is the SDK's "could not fetch Google's signing keys" failure: our outage. */
function isKeyFetchFailure(e: unknown): boolean {
  const message = (e as { message?: unknown } | null)?.message
  return (
    typeof message === 'string' && KEY_FETCH_FAILURE_PREFIXES.some((p) => message.startsWith(p))
  )
}

/**
 * True when `e` is the Admin SDK rejecting a credential (bad, expired or revoked token or
 * cookie, disabled or unknown user): a normal client condition, not a fault on our side.
 * A failed signing-key fetch is excluded even though it carries a credential-looking code.
 */
export function isCredentialError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && TOKEN_ERROR_CODES.has(code) && !isKeyFetchFailure(e)
}

/** Short, secret-free label for logging a failure: the error code, else the class name. */
export function errorKind(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
}

/**
 * Maps a failed Admin Auth call to an HttpError: 401 for credential problems, 503 for
 * everything else (including a failed signing-key fetch, see isKeyFetchFailure). `operation`
 * only labels the log line; the error code or class name is logged, never the message body
 * (it can quote the token or cookie).
 */
export function toAuthHttpError(e: unknown, operation: string): HttpError {
  if (isCredentialError(e)) return new HttpError(401, 'unauthorized')
  console.error(`${operation} failed`, errorKind(e))
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
 * Returns false for an unacceptable cookie. Throws HttpError(503) when verification failed
 * for reasons on our side (outage, signing keys unreachable; the proxy then answers 503
 * instead of logging everyone out) and HttpError(500) when the server is not configured
 * (getAdmin failure).
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
 * Returns the caller's role in organizations/{orgId} when it is one of `allowed`; otherwise
 * throws HttpError(403, 'forbidden') (same answer for "no such company", "not a member" and
 * "role not allowed", so ids cannot be probed). Reads organizations/{orgId}/members/{uid}
 * with the Admin SDK (bypasses security rules); a Firestore failure propagates (500).
 */
export async function requireOrgRole(uid: string, orgId: string, allowed: readonly Role[]): Promise<Role> {
  // orgId comes from the request: allow-list a single plain doc id, otherwise "org1/accounts/x"
  // would read a different document. The uid comes from a verified session but is checked too:
  // it becomes a path segment.
  if (typeof orgId !== 'string' || !ORG_ID.test(orgId) || RESERVED_ID.test(orgId)) {
    throw new HttpError(403, 'forbidden')
  }
  if (typeof uid !== 'string' || uid.length === 0 || uid.includes('/')) {
    throw new HttpError(403, 'forbidden')
  }

  const snap = await getAdmin().db.doc(`organizations/${orgId}/members/${uid}`).get()
  const role: unknown = snap.exists ? (snap.data() as { role?: unknown } | undefined)?.role : undefined
  if (!isRole(role) || !allowed.includes(role)) throw new HttpError(403, 'forbidden')
  return role
}
