'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { buildCashFlow } from '@/lib/utils/analytics'
import { exportToCSV } from '@/lib/utils/export'
import { DEFAULT_REPORT_PERIOD, periodSlug, resolvePeriod, type PeriodSelection } from '@/lib/utils/period'
import { cn } from '@/lib/utils'
import CashFlowChart from '@/components/charts/CashFlowChart'
import { ReportToolbar } from '@/components/analytics/ReportToolbar'
import Link from 'next/link'
import { useParams } from 'next/navigation'

function formatNum(n: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n)
}

export default function CashFlowPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const orgId = orgSlug
  const { transactions, loading } = useTransactions(orgId)
  const [period, setPeriod] = useState<PeriodSelection>(DEFAULT_REPORT_PERIOD)
  // The browser clock, read once per visit (presets resolve against it).
  const [now] = useState(() => new Date())

  const { granularity, buckets: data } = useMemo(
    () => buildCashFlow(transactions, resolvePeriod(period, now)),
    [transactions, period, now]
  )
  const unitLabel = granularity === 'month' ? 'Місяць' : 'День'

  const handleExport = () => {
    exportToCSV(
      data.map((row) => ({
        [unitLabel]: row.label,
        Дохід: row.income,
        Витрата: row.expense,
        Різниця: row.net,
        Баланс: row.balance,
      })),
      `cashflow-${periodSlug(period)}`
    )
  }

  return (
    // The shared container and the reports' sub-navigation come from analytics/layout.tsx.
    <div className="space-y-6">
        {/* Header and the report toolbar (period first, then the actions), as in Finmap */}
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Cash Flow</h1>
            <p className="text-sm text-ink-muted">Рух коштів за обраний період</p>
          </div>
          <ReportToolbar period={period} onPeriodChange={setPeriod} onExport={handleExport} />
        </div>

        {/* Summary cards */}
        {!loading && data.length > 0 && (() => {
          const totalIncome = data.reduce((s, d) => s + d.income, 0)
          const totalExpense = data.reduce((s, d) => s + d.expense, 0)
          const net = totalIncome - totalExpense
          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { id: 'income', label: 'Доходи', value: totalIncome, tone: 'text-income' },
                { id: 'expense', label: 'Витрати', value: totalExpense, tone: 'text-expense' },
                { id: 'net', label: 'Різниця', value: net, tone: net >= 0 ? 'text-income' : 'text-expense' },
              ].map((card) => (
                <div key={card.label} className="rounded-panel border border-line bg-surface px-5 py-4">
                  <p className="mb-1 text-xs text-ink-muted">{card.label}</p>
                  <p data-testid={`cashflow-total-${card.id}`} className={cn('text-xl font-bold tabular-nums', card.tone)}>
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
            <h2 className="text-sm font-semibold text-ink">
              {granularity === 'month' ? 'Деталізація по місяцях' : 'Деталізація по днях'}
            </h2>
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
                    <th className="px-6 py-3 text-left font-semibold">{unitLabel}</th>
                    <th className="px-6 py-3 text-right font-semibold">Дохід</th>
                    <th className="px-6 py-3 text-right font-semibold">Витрата</th>
                    <th className="px-6 py-3 text-right font-semibold">Різниця</th>
                    <th className="px-6 py-3 text-right font-semibold">Баланс</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.key} className="border-t border-line hover:bg-canvas">
                      <td className="px-6 py-3 font-medium text-ink">{row.label}</td>
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
