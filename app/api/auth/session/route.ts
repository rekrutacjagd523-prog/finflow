import type { DecodedIdToken } from 'firebase-admin/auth'
import { toAuthHttpError } from '@/lib/server/auth'
import { getAdmin } from '@/lib/server/firebase-admin'
import { errorResponse, HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { SESSION_MAX_AGE_SECONDS, buildSessionCookie } from '@/lib/server/session-cookie'

export const runtime = 'nodejs'

// A session may only be minted right after a real sign-in (Firebase's own recommendation):
// a stolen, older ID token cannot be exchanged for a 7-day cookie.
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60
const MAX_ID_TOKEN_LENGTH = 4096
// A legitimate body is `{"idToken":"<=4096 chars>"}`; anything declared larger is refused unread.
const MAX_BODY_BYTES = 8192

// POST /api/auth/session  { idToken }
// Not to be confused with /api/enablebanking/session (starts a bank connection).
// Exchanges a freshly issued Firebase ID token for the HttpOnly `__session` cookie.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)

    const declaredLength = req.headers.get('content-length')
    if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
      throw new HttpError(413, 'payload too large')
    }
    if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      throw new HttpError(415, 'unsupported media type')
    }

    const body: unknown = await req.json().catch(() => null)
    const idToken = (body as { idToken?: unknown } | null)?.idToken
    if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > MAX_ID_TOKEN_LENGTH) {
      throw new HttpError(400, 'Missing params')
    }

    const { auth } = getAdmin()

    let decoded: DecodedIdToken
    try {
      decoded = await auth.verifyIdToken(idToken, true)
    } catch (e) {
      throw toAuthHttpError(e, 'verifyIdToken')
    }
    // Anonymous Firebase users never get a session cookie. A missing `firebase` claim is tolerated.
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpError(403, 'forbidden')
    }
    // Written so that a missing or non-numeric auth_time (NaN) fails closed.
    const ageSeconds = Math.floor(Date.now() / 1000) - decoded.auth_time
    if (!(ageSeconds <= MAX_SIGN_IN_AGE_SECONDS)) {
      throw new HttpError(401, 'reauth_required')
    }

    let cookie: string
    try {
      cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 })
    } catch (e) {
      throw toAuthHttpError(e, 'createSessionCookie')
    }

    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': buildSessionCookie(cookie), 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
