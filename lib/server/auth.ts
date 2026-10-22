import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { HttpError } from '@/lib/server/http-error'

// RFC 7235: the auth scheme is case-insensitive; the token is one opaque word.
const BEARER = /^Bearer (\S+)$/i

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
 * any token the Admin SDK rejects. Temporary until S01 session cookies.
 */
export async function requireUserFromBearer(req: Request): Promise<{ uid: string }> {
  const match = BEARER.exec(req.headers.get('authorization') ?? '')
  if (!match) throw new HttpError(401, 'unauthorized')

  // Outside the try: a missing service account must surface as 500, not 401.
  const { auth } = getAdmin()
  try {
    const decoded = await auth.verifyIdToken(match[1], true)
    return { uid: decoded.uid }
  } catch {
    throw new HttpError(401, 'unauthorized')
  }
}

/**
 * Throws HttpError(403) unless organizations/{orgId} exists and lists uid in
 * its `members` map. Reads with the Admin SDK (bypasses security rules).
 * Temporary until S02 moves membership to its own document.
 */
export async function requireOrgMember(uid: string, orgId: string): Promise<void> {
  // orgId comes from the request: refuse anything that is not a single doc id,
  // otherwise "org1/accounts/x" would read a different document.
  if (!orgId || orgId.includes('/')) throw new HttpError(403, 'forbidden')

  const snap = await getAdmin().db.doc(`organizations/${orgId}`).get()
  if (!snap.exists || !isOrgMember(snap.data(), uid)) {
    throw new HttpError(403, 'forbidden')
  }
}
