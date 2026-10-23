'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useShell } from '@/lib/hooks/useShell'
import { exportToCSV } from '@/lib/utils/export'
import BalanceSheet from '@/components/charts/BalanceSheet'
import { Download, ArrowLeft } from 'lucide-react'

const PERIODS = ['Поточний місяць', 'Квартал', 'Рік']

export default function BalancePage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  // Org and accounts come from the shell (the URL's org, one accounts subscription).
  const { orgId, org, accounts, accountsLoading: loading } = useShell()
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0])

  const handleExport = () => {
    exportToCSV(
      accounts.map((acc) => ({
        Рахунок: acc.name,
        Тип: acc.type,
        Баланс: acc.balance,
        Валюта: acc.currency,
      })),
      `balance-sheet`
    )
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/analytics`}
            className="p-2 rounded-lg hover:bg-white transition-colors text-[#6b7280] hover:text-[#111111]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#111111]">Баланс</h1>
            <p className="text-sm text-[#6b7280]">
              Активи та капітал{org?.name ? ` · ${org.name}` : ''}
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white text-sm text-[#111111] hover:bg-[#f9fafb] transition-colors"
          >
            <Download className="w-4 h-4" />
            Експорт CSV
          </button>
        </div>

        {/* Period dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#6b7280]">Станом на:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#e5e7eb] bg-white text-sm text-[#111111] focus:outline-none focus:border-[#00c896]"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Balance sheet */}
        <BalanceSheet accounts={accounts} orgId={orgId ?? 'default'} loading={loading} />
      </div>
    </main>
  )
}
