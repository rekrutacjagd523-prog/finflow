'use client'

import { useState, useMemo } from 'react'
import { useOrg } from '@/lib/hooks/useOrg'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { buildCashFlow, MonthlyData } from '@/lib/utils/analytics'
import { exportToCSV } from '@/lib/utils/export'
import CashFlowChart from '@/components/charts/CashFlowChart'
import { Download, ArrowLeft } from 'lucide-react'
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
  const { orgId } = useOrg()
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
            <h1 className="text-xl font-bold text-[#111111]">Cash Flow</h1>
            <p className="text-sm text-[#6b7280]">Рух коштів по місяцях</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white text-sm text-[#111111] hover:bg-[#f9fafb] transition-colors"
          >
            <Download className="w-4 h-4" />
            Експорт CSV
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={[
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                period === p.value
                  ? 'bg-[#00c896] text-white'
                  : 'bg-white border border-[#e5e7eb] text-[#6b7280] hover:text-[#111111]',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
          <CashFlowChart data={data} loading={loading} />
        </div>

        {/* Detail table */}
        <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb]">
            <h2 className="text-sm font-semibold text-[#111111]">Деталізація по місяцях</h2>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-[#f9fafb] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-[#6b7280] text-sm">
              Немає даних за цей період.{' '}
              <Link href="/transactions" className="text-[#00c896] underline">
                Додати транзакції →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="bg-[#f9fafb] text-[#6b7280] text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-semibold">Місяць</th>
                  <th className="px-6 py-3 text-right font-semibold">Дохід</th>
                  <th className="px-6 py-3 text-right font-semibold">Витрата</th>
                  <th className="px-6 py-3 text-right font-semibold">Різниця</th>
                  <th className="px-6 py-3 text-right font-semibold">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.monthKey} className="border-t border-[#e5e7eb] hover:bg-[#f9fafb]">
                    <td className="px-6 py-3 text-[#111111] font-medium">{row.month}</td>
                    <td className="px-6 py-3 text-right text-[#22c55e]">
                      {row.income > 0 ? `+${formatNum(row.income)}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-right text-[#ef4444]">
                      {row.expense > 0 ? `−${formatNum(row.expense)}` : '—'}
                    </td>
                    <td
                      className="px-6 py-3 text-right font-medium"
                      style={{ color: row.net >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {row.net >= 0 ? '+' : ''}{formatNum(row.net)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[#111111]">
                      {formatNum(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
