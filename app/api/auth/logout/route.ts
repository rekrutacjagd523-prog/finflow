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
      // With the revocation check: only a live session may revoke. A stale tab or device holding
      // an already revoked (or expired) cookie calls this too (after a 401, or when its SDK user
      // vanished); revoking on its behalf would end the user's NEWER sessions, so it is only cleared.
      const { uid } = await auth.verifySessionCookie(cookie, true)
      await auth.revokeRefreshTokens(uid)
    } catch (e) {
      // Best effort: the cookie is cleared below regardless. A rejected (revoked, expired,
      // garbage) cookie is a normal condition and not logged; anything else is, by code only.
      // During an outage of the session check nothing is revoked; acceptable, because the
      // cookie is still cleared here and every API route re-checks the session.
      if (!isCredentialError(e)) console.error('logout revoke failed', errorKind(e))
    }
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': buildClearedSessionCookie(), 'Cache-Control': 'no-store' },
  })
}
