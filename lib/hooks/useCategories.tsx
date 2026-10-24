'use client'

import { useEffect, useState } from 'react'
import { getCategories, seedDefaultCategories } from '@/lib/firebase/categories'
import type { Category } from '@/types'

interface UseCategoriesResult {
  incomeCategories: Category[]
  expenseCategories: Category[]
  loading: boolean
  error: string | null
}

const EMPTY_CATEGORIES: Category[] = []

export function useCategories(orgId: string | null): UseCategoriesResult {
  // The data is stored with the company it belongs to, so a company switch never shows the
  // previous company's categories while the new subscription waits for its first snapshot.
  const [snapshot, setSnapshot] = useState<{ orgId: string; categories: Category[] } | null>(null)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return

    // Seed defaults on first load
    seedDefaultCategories(orgId).catch(() => {
      // silently ignore if already seeded
    })

    const unsub = getCategories(orgId, (data) => {
      setSnapshot({ orgId, categories: data })
    })
    return () => {
      unsub()
    }
  }, [orgId])

  const current = orgId !== null && snapshot?.orgId === orgId
  const loading = orgId !== null && !current
  const categories = current ? snapshot.categories : EMPTY_CATEGORIES

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return { incomeCategories, expenseCategories, loading, error }
}
