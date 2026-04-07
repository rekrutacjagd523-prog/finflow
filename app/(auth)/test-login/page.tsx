'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, setPersistence, inMemoryPersistence } from 'firebase/auth'
import { auth } from '@/lib/firebase/firebase'

function TestLoginContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState('Initializing...')

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      router.replace('/login')
      return
    }

    const email = params.get('email')
    const password = params.get('password')
    if (!email || !password) {
      setStatus('Missing credentials')
      return
    }

    ;(async () => {
      try {
        setStatus('Authenticating...')

        // Run server-side auth (for orgId) and client-side auth in parallel
        const [serverResult] = await Promise.all([
          // Server-side: get orgId via Firebase REST API
          fetch(`/api/test/auth?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`)
            .then((r) => r.json()),
          // Client-side: sign in Firebase SDK (for useAuth/useOrg hooks)
          setPersistence(auth, inMemoryPersistence)
            .then(() => signInWithEmailAndPassword(auth, email, password))
            .catch(() => null), // ignore client auth failure — server side is the source of truth
        ])

        if (serverResult.error) {
          setStatus(`Error: ${serverResult.error}`)
          return
        }

        const { orgId } = serverResult

        // Set session cookie so middleware lets us through
        document.cookie = '__session=1; path=/; max-age=86400; SameSite=Lax'

        setStatus(`Redirecting to /${orgId}/transactions`)
        // Small delay so cookie + auth state are registered
        await new Promise((r) => setTimeout(r, 300))
        router.replace(`/${orgId}/transactions`)
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
      <p className="text-white text-sm font-mono" data-testid="status">{status}</p>
    </div>
  )
}

export default function TestLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]"><p className="text-white text-sm font-mono">Loading...</p></div>}>
      <TestLoginContent />
    </Suspense>
  )
}
