'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTransactions } from '@/lib/hooks/useTransactions'
import CalendarView from '@/components/charts/CalendarView'
import { ArrowLeft } from 'lucide-react'

export default function CalendarPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const orgId = orgSlug
  const { transactions, loading } = useTransactions(orgId)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const handleNavigate = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    } else {
      if (month === 11) { setMonth(0); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    }
  }

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/analytics`}
            aria-label="Усі звіти"
            className="rounded-control p-2 text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Календар</h1>
            <p className="text-sm text-ink-muted">Щоденний рух грошей</p>
          </div>
        </div>

        {/* Calendar */}
        <CalendarView
          transactions={transactions}
          year={year}
          month={month}
          onNavigate={handleNavigate}
          loading={loading}
        />
      </div>
    </div>
  )
}
