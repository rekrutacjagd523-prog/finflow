'use client'

import { auth } from '@/lib/firebase/firebase'

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
 * Adds `Authorization: Bearer <Firebase ID token>` of the signed-in user.
 * getIdToken() returns the cached token and refreshes it only when it is about to expire.
 */
export async function ebFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isAllowedPath(path)) {
    throw new Error('ebFetch: only /api/enablebanking/* paths are allowed')
  }
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('not signed in')
  const token = await user.getIdToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(path, { ...init, headers })
}
