'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/firebase'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
} from '@/lib/firebase/auth'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User>
  signUp: (
    email: string,
    password: string,
    name: string,
    orgName: string,
    currency: string
  ) => Promise<{ user: User; orgId: string }>
  signOut: () => Promise<void>
  signInGoogle: () => Promise<{ user: User; orgId?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      if (firebaseUser) {
        document.cookie = '__session=1; path=/; max-age=86400; SameSite=Lax'
      } else {
        // Clear cookie whenever user is not authenticated (sign-out or expired session)
        document.cookie = '__session=; path=/; max-age=0'
      }
    })
    return unsubscribe
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signOut: firebaseSignOut,
    signInGoogle: firebaseSignInWithGoogle,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
