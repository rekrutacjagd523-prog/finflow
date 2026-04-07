'use client'

import { useEffect, useState } from 'react'
import { getAccounts } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

interface UseAccountsResult {
  accounts: Account[]
  loading: boolean
  error: string | null
}

export function useAccounts(orgId: string | null): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = getAccounts(orgId, (data) => {
      setAccounts(data)
      setLoading(false)
    })
    return () => {
      unsub()
    }
  }, [orgId])

  return { accounts, loading, error }
}
