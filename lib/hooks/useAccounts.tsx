'use client'

import { useEffect, useState } from 'react'
import { getAccounts } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

interface UseAccountsResult {
  accounts: Account[]
  loading: boolean
  error: string | null
}

const EMPTY_ACCOUNTS: Account[] = []

export function useAccounts(orgId: string | null): UseAccountsResult {
  // The data is stored with the company it belongs to, so a company switch never shows the
  // previous company's accounts while the new subscription waits for its first snapshot.
  const [snapshot, setSnapshot] = useState<{ orgId: string; accounts: Account[] } | null>(null)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    const unsub = getAccounts(orgId, (data) => {
      setSnapshot({ orgId, accounts: data })
    })
    return () => {
      unsub()
    }
  }, [orgId])

  const current = orgId !== null && snapshot?.orgId === orgId
  const loading = orgId !== null && !current
  const accounts = current ? snapshot.accounts : EMPTY_ACCOUNTS

  return { accounts, loading, error }
}
