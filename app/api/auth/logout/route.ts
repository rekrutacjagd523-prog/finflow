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
      // Best effort: the cookie is cleared below regardless. Log the code only.
      const code = (e as { code?: unknown } | null)?.code
      const kind = typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
      console.error('logout revoke failed', kind)
    }
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': buildClearedSessionCookie(), 'Cache-Control': 'no-store' },
  })
}
