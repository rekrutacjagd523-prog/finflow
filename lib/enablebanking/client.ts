'use client'

import { auth } from '@/lib/firebase/firebase'

const ALLOWED_PREFIX = '/api/enablebanking/'

/**
 * fetch() for FinFlow's own /api/enablebanking/* routes from the browser.
 * Adds `Authorization: Bearer <Firebase ID token>` of the signed-in user.
 * getIdToken() returns the cached token and refreshes it only when it is about to expire.
 */
export async function ebFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!path.startsWith(ALLOWED_PREFIX)) {
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
