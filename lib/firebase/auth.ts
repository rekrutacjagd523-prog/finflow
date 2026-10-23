'use client'

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { createOrganization } from './firestore'
import { clearSession, establishSession } from './session'

const googleProvider = new GoogleAuthProvider()

/**
 * Mints the server session for a user who just signed in. If that fails, the SDK sign-in is
 * undone so the browser never ends up "signed in" without a session cookie.
 */
async function withSession(user: User): Promise<void> {
  try {
    await establishSession(user)
  } catch (e) {
    await firebaseSignOut(auth)
    throw e
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  orgName: string,
  currency: string
): Promise<{ user: User; orgId: string }> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const user = credential.user

  await withSession(user)
  // Best effort: a failed mail must not undo the registration. The in-app banner offers "send again".
  await sendEmailVerification(user).catch(() => {})
  await updateProfile(user, { displayName: name })

  const orgId = await createOrganization(user.uid, orgName, currency)

  return { user, orgId }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await withSession(credential.user)
  return credential.user
}

export async function signInWithGoogle(): Promise<{ user: User; orgId?: string }> {
  const credential = await signInWithPopup(auth, googleProvider)
  const user = credential.user
  await withSession(user)

  // For Google sign-in, org creation is handled separately if it's a new user
  return { user }
}

export async function signOut(): Promise<void> {
  await clearSession()
  await firebaseSignOut(auth)
}
