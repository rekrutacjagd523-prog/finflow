'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { buildCashFlow, MonthlyData } from '@/lib/utils/analytics'
import { exportToCSV } from '@/lib/utils/export'
import { cn } from '@/lib/utils'
import CashFlowChart from '@/components/charts/CashFlowChart'
import { Download } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const PERIODS = [
  { label: '3М', value: 3 },
  { label: '6М', value: 6 },
  { label: '12М', value: 12 },
]

function formatNum(n: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n)
}

export default function CashFlowPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const orgId = orgSlug
  const { transactions, loading } = useTransactions(orgId)
  const [period, setPeriod] = useState(12)

  const data: MonthlyData[] = useMemo(
    () => buildCashFlow(transactions, period),
    [transactions, period]
  )

  const handleExport = () => {
    exportToCSV(
      data.map((row) => ({
        Місяць: row.month,
        Дохід: row.income,
        Витрата: row.expense,
        Різниця: row.net,
        Баланс: row.balance,
      })),
      `cashflow-${period}m`
    )
  }

  return (
    // The shared container and the reports' sub-navigation come from analytics/layout.tsx.
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-ink">Cash Flow</h1>
            <p className="text-sm text-ink-muted">Рух коштів по місяцях</p>
          </div>
          {/* Icon-only below sm so the title keeps its width; the accessible name stays the same. */}
          <button
            onClick={handleExport}
            aria-label="Експорт CSV"
            className="flex shrink-0 items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-canvas sm:px-4"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Експорт CSV</span>
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={cn(
                'rounded-control border px-4 py-1.5 text-sm transition-colors',
                period === p.value
                  ? 'border-brand bg-brand-soft font-semibold text-brand-soft-foreground'
                  : 'border-line bg-surface font-medium text-ink-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {!loading && data.length > 0 && (() => {
          const totalIncome = data.reduce((s, d) => s + d.income, 0)
          const totalExpense = data.reduce((s, d) => s + d.expense, 0)
          const net = totalIncome - totalExpense
          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Доходи', value: totalIncome, tone: 'text-income' },
                { label: 'Витрати', value: totalExpense, tone: 'text-expense' },
                { label: 'Різниця', value: net, tone: net >= 0 ? 'text-income' : 'text-expense' },
              ].map((card) => (
                <div key={card.label} className="rounded-panel border border-line bg-surface px-5 py-4">
                  <p className="mb-1 text-xs text-ink-muted">{card.label}</p>
                  <p className={cn('text-xl font-bold tabular-nums', card.tone)}>
                    {card.value >= 0 && card.label === 'Різниця' ? '+' : ''}{formatNum(card.value)}
                  </p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Chart */}
        <div className="rounded-panel border border-line bg-surface p-4 lg:p-6">
          <CashFlowChart data={data} loading={loading} />
        </div>

        {/* Detail table */}
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-sm font-semibold text-ink">Деталізація по місяцях</h2>
          </div>
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-control bg-canvas" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-muted">
              Немає даних за цей період.{' '}
              <Link href={`/${orgSlug}/transactions`} className="text-brand-soft-foreground underline">
                Додати транзакції →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="bg-canvas text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3 text-left font-semibold">Місяць</th>
                    <th className="px-6 py-3 text-right font-semibold">Дохід</th>
                    <th className="px-6 py-3 text-right font-semibold">Витрата</th>
                    <th className="px-6 py-3 text-right font-semibold">Різниця</th>
                    <th className="px-6 py-3 text-right font-semibold">Баланс</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.monthKey} className="border-t border-line hover:bg-canvas">
                      <td className="px-6 py-3 font-medium text-ink">{row.month}</td>
                      <td className="px-6 py-3 text-right text-income">
                        {row.income > 0 ? `+${formatNum(row.income)}` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-expense">
                        {row.expense > 0 ? `−${formatNum(row.expense)}` : '—'}
                      </td>
                      <td className={cn('px-6 py-3 text-right font-medium', row.net >= 0 ? 'text-income' : 'text-expense')}>
                        {row.net >= 0 ? '+' : ''}{formatNum(row.net)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-ink">
                        {formatNum(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  )
}
