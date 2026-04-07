'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrg } from '@/lib/hooks/useOrg'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { useCategories } from '@/lib/hooks/useCategories'
import { buildPL } from '@/lib/utils/analytics'
import { exportToCSV } from '@/lib/utils/export'
import PLTable from '@/components/charts/PLTable'
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
  const { orgId } = useOrg()
  const { transactions, loading: txLoading } = useTransactions(orgId)
  const { categories, loading: catLoading } = useCategories(orgId)
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
    <main className="min-h-screen bg-[#f9fafb] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/analytics`}
            className="p-2 rounded-lg hover:bg-white transition-colors text-[#6b7280] hover:text-[#111111]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#111111]">P&L — Прибутки та збитки</h1>
            <p className="text-sm text-[#6b7280]">По категоріях за обраний період</p>
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

        {/* Table */}
        <PLTable rows={rows} monthKeys={monthKeys} loading={loading} />
      </div>
    </main>
  )
}
