import { errorKind, isCredentialError } from '@/lib/server/auth'
import { getAdmin } from '@/lib/server/firebase-admin'
import { errorResponse } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { buildClearedSessionCookie, readSessionCookie } from '@/lib/server/session-cookie'

export const runtime = 'nodejs'

// POST /api/auth/logout
// Revokes the user's refresh tokens (so a copied cookie stops working on every device) and
// clears the cookie. Always answers 204 for a same-origin caller, even with no or a broken session.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
  } catch (e) {
    return errorResponse(e)
  }

  const cookie = readSessionCookie(req.headers)
  if (cookie) {
    try {
      const { auth } = getAdmin()
      // No revocation check: an already revoked cookie still identifies its user.
      const { uid } = await auth.verifySessionCookie(cookie, false)
      await auth.revokeRefreshTokens(uid)
    } catch (e) {
      // Best effort: the cookie is cleared below regardless. A rejected (expired, garbage)
      // cookie is a normal condition and not logged; anything else is, by code only.
      if (!isCredentialError(e)) console.error('logout revoke failed', errorKind(e))
    }
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': buildClearedSessionCookie(), 'Cache-Control': 'no-store' },
  })
}
