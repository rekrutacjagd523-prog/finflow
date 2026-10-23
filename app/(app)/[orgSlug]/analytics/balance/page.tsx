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
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/analytics`}
            aria-label="Усі звіти"
            className="rounded-control p-2 text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold text-ink">Баланс</h1>
            <p className="text-sm text-ink-muted">
              Активи та капітал{org?.name ? ` · ${org.name}` : ''}
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
          >
            <Download className="h-4 w-4" />
            Експорт CSV
          </button>
        </div>

        {/* Period dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">Станом на:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Balance sheet */}
        <BalanceSheet accounts={accounts} orgId={orgId ?? 'default'} loading={loading} />
      </div>
    </div>
  )
}
