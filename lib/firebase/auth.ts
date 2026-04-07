'use client'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { createOrganization } from './firestore'

const googleProvider = new GoogleAuthProvider()

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  orgName: string,
  currency: string
): Promise<{ user: User; orgId: string }> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const user = credential.user

  await updateProfile(user, { displayName: name })

  const orgId = await createOrganization(user.uid, orgName, currency)

  return { user, orgId }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signInWithGoogle(): Promise<{ user: User; orgId?: string }> {
  const credential = await signInWithPopup(auth, googleProvider)
  const user = credential.user

  // For Google sign-in, org creation is handled separately if it's a new user
  return { user }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}
