'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrg } from '@/lib/hooks/useOrg'
import { useTransactions } from '@/lib/hooks/useTransactions'
import CalendarView from '@/components/charts/CalendarView'
import { ArrowLeft } from 'lucide-react'

export default function CalendarPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const { orgId } = useOrg()
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
    <main className="min-h-screen bg-[#f9fafb] p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/analytics`}
            className="p-2 rounded-lg hover:bg-white transition-colors text-[#6b7280] hover:text-[#111111]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#111111]">Календар</h1>
            <p className="text-sm text-[#6b7280]">Щоденний рух грошей</p>
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
    </main>
  )
}
