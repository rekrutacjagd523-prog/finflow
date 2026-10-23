'use client'

import { clearSession } from '@/lib/firebase/session'

const ALLOWED_PREFIX = '/api/enablebanking/'

/**
 * The path part (before ? or #) must live under ALLOWED_PREFIX and contain no empty, "." or ".."
 * segments (also when percent-encoded) and no backslashes, so it cannot be steered to another route.
 */
function isAllowedPath(path: string): boolean {
  if (!path.startsWith(ALLOWED_PREFIX)) return false
  const pathname = path.split(/[?#]/, 1)[0]
  if (pathname.includes('\\')) return false
  const segments = pathname.slice(ALLOWED_PREFIX.length).split('/')
  return segments.every((segment, i) => {
    // An empty segment is only fine as the very last one (bare prefix or a trailing slash).
    if (segment === '') return i === segments.length - 1
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return false
    }
    return decoded !== '.' && decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\')
  })
}

/**
 * fetch() for FinFlow's own /api/enablebanking/* routes from the browser.
 * Authentication is the HttpOnly `__session` cookie, sent automatically on same-origin requests,
 * so no token is handled here. A 401 means the session is gone: drop the rejected cookie (the proxy
 * cannot see a revocation and would bounce /login back to the app), send the user to /login and
 * bring them back afterwards.
 */
export async function ebFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isAllowedPath(path)) {
    throw new Error('ebFetch: only /api/enablebanking/* paths are allowed')
  }
  const res = await fetch(path, { ...init, credentials: 'same-origin' })
  if (res.status === 401 && typeof window !== 'undefined') {
    await clearSession()
    const back = encodeURIComponent(window.location.pathname + window.location.search)
    // Not a React context (plain helper), so the router is unavailable: a full navigation is intended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?redirect=${back}`)
  }
  return res
}
