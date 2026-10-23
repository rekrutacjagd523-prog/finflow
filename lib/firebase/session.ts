'use client'

import type { User } from 'firebase/auth'

/**
 * Exchanges the signed-in user's ID token for the HttpOnly `__session` cookie.
 * Call it right after every successful Firebase sign-in/sign-up: the server only accepts a
 * sign-in that is at most 5 minutes old. getIdToken(true) guarantees a fresh token.
 */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true)
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error(`session setup failed (${res.status})`)
}

/** Revokes the server session and clears the cookie. Never throws. */
export async function clearSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // Offline: the cookie expires on its own and every API call re-checks it.
  }
}
