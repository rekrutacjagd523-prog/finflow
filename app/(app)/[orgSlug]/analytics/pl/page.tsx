'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { useShell } from '@/lib/hooks/useShell'
import { buildPL } from '@/lib/utils/analytics'
import { exportToCSV } from '@/lib/utils/export'
import { cn } from '@/lib/utils'
import PLTable from '@/components/charts/PLTable'
import PLSummaryCharts from '@/components/charts/PLSummaryCharts'
import { Download, ArrowLeft } from 'lucide-react'

const PERIODS = [
  { label: '3М', value: 3 },
  { label: '6М', value: 6 },
  { label: '12М', value: 12 },
]

function getMonthKeys(months: number): string[] {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export default function PLPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const orgId = orgSlug
  const { transactions, loading: txLoading } = useTransactions(orgId)
  // Categories come from ShellProvider (one subscription, one default-category seed per org).
  const { incomeCategories, expenseCategories, categoriesLoading: catLoading } = useShell()
  const categories = [...incomeCategories, ...expenseCategories]
  const [period, setPeriod] = useState(6)

  const loading = txLoading || catLoading

  const rows = useMemo(
    () => buildPL(transactions, categories, period),
    [transactions, categories, period]
  )

  const monthKeys = useMemo(() => getMonthKeys(period), [period])

  const handleExport = () => {
    exportToCSV(
      rows.map((row) => ({
        Категорія: row.categoryName,
        Тип: row.type === 'income' ? 'Дохід' : 'Витрата',
        ...Object.fromEntries(monthKeys.map((k) => [k, row.months[k] ?? 0])),
        Всього: row.total,
      })),
      `pl-${period}m`
    )
  }

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-6xl space-y-6">
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
            <h1 className="font-display text-xl font-semibold text-ink">P&L — Прибутки та збитки</h1>
            <p className="text-sm text-ink-muted">По категоріях за обраний період</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
          >
            <Download className="h-4 w-4" />
            Експорт CSV
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-control px-4 py-1.5 text-sm font-medium transition-colors',
                period === p.value
                  ? 'bg-brand text-white'
                  : 'border border-line bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary + pie charts */}
        {!loading && rows.length > 0 && <PLSummaryCharts rows={rows} />}

        {/* Table */}
        <PLTable rows={rows} monthKeys={monthKeys} loading={loading} />
      </div>
    </div>
  )
}
