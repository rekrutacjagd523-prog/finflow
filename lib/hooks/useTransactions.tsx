'use client'

import { useEffect, useState } from 'react'
import { getTransactions, type TransactionFilters } from '@/lib/firebase/transactions'
import { groupTransactionsByDate } from '@/lib/utils/date'
import type { Transaction } from '@/types'

interface UseTransactionsResult {
  transactions: Transaction[]
  grouped: Record<string, Transaction[]>
  loading: boolean
  error: string | null
}

export function useTransactions(
  orgId: string | null,
  filters: TransactionFilters = {}
): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stable filter key to avoid infinite re-renders
  const filterKey = JSON.stringify(filters)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const parsedFilters: TransactionFilters = JSON.parse(filterKey)
    // Restore Date objects
    if (parsedFilters.dateFrom) parsedFilters.dateFrom = new Date(parsedFilters.dateFrom)
    if (parsedFilters.dateTo) parsedFilters.dateTo = new Date(parsedFilters.dateTo)

    const unsub = getTransactions(orgId, parsedFilters, (data) => {
      setTransactions(data)
      setLoading(false)
    })
    return () => {
      unsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, filterKey])

  const grouped = groupTransactionsByDate(transactions)

  return { transactions, grouped, loading, error }
}
