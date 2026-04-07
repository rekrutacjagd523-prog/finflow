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

export function useCategories(orgId: string | null): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)

    // Seed defaults on first load
    seedDefaultCategories(orgId).catch(() => {
      // silently ignore if already seeded
    })

    const unsub = getCategories(orgId, (data) => {
      setCategories(data)
      setLoading(false)
    })
    return () => {
      unsub()
    }
  }, [orgId])

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return { incomeCategories, expenseCategories, loading, error }
}
