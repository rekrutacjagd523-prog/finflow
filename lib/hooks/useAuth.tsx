'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
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
import { clearSession } from '@/lib/firebase/session'
import { isAppPath, loginUrlAfterSessionLoss } from '@/lib/auth/paths'

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
  const hadUser = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (firebaseUser) {
        hadUser.current = true
        return
      }

      // The Firebase SDK has no user. The server session (HttpOnly cookie, invisible to scripts)
      // must not outlive it: drop it when the user was signed in a moment ago (sign-out in another
      // tab, revoked or deleted account) or when we are on an app page that the proxy let through
      // on a cookie whose SDK user is gone. On an app page, also leave for /login (keeping the
      // return path unless the user just signed out).
      const onAppPage = isAppPath(window.location.pathname)
      const justSignedOut = hadUser.current
      if (justSignedOut || onAppPage) {
        hadUser.current = false
        void clearSession().finally(() => {
          if (onAppPage) {
            window.location.replace(
              loginUrlAfterSessionLoss({
                justSignedOut,
                pathname: window.location.pathname,
                search: window.location.search,
              }),
            )
          }
        })
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
