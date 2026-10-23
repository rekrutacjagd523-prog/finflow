import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAppPath, safeRedirectPath } from '@/lib/auth/paths'
import { isSessionCookieValid } from '@/lib/server/auth'
import { SESSION_COOKIE_NAME, isSecureCookieEnv } from '@/lib/server/session-cookie'

function withClearedSession(res: NextResponse): NextResponse {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookieEnv(),
  })
  return res
}

// Page-navigation gate (Next 16 `proxy`, Node runtime). It gates ONLY app pages. It verifies the
// signature and expiry of the `__session` cookie but NOT revocation (that would be a network
// round-trip per navigation); every API route re-checks with revocation. Firestore data is
// protected by security rules, not by this file.
// Auth pages (/login, /register) and every other path pass through untouched: a visitor with a
// valid cookie but no Firebase SDK user (offline sign-out, revoked elsewhere, wiped storage) must
// still be able to reach the login page, and signing in again simply overwrites the cookie.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (!isAppPath(pathname)) return NextResponse.next()

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (cookie) {
    try {
      if (await isSessionCookieValid(cookie)) return NextResponse.next()
    } catch {
      // Our auth backend failed: do not log everybody out, and do not let anyone in either.
      return new NextResponse('Authentication service unavailable', { status: 503 })
    }
  }

  const loginUrl = new URL('/login', request.url)
  const back = safeRedirectPath(pathname + search)
  if (back) loginUrl.searchParams.set('redirect', back)
  const res = NextResponse.redirect(loginUrl)
  return cookie ? withClearedSession(res) : res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
