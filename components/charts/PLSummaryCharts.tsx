'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PLRow } from '@/lib/utils/analytics'

interface Props {
  rows: PLRow[]
}

const COLORS_INCOME = ['#22c55e', '#16a34a', '#4ade80', '#86efac', '#bbf7d0', '#00c896']
const COLORS_EXPENSE = ['#ef4444', '#dc2626', '#f87171', '#fca5a5', '#f97316', '#fb923c']

function formatNum(n: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 shadow text-sm">
      <p className="font-medium text-[#111111]">{item.name}</p>
      <p className="text-[#6b7280]">{formatNum(item.value)}</p>
      <p className="text-[#9ca3af] text-xs">{item.payload.percent}%</p>
    </div>
  )
}

function SummaryPie({
  title,
  total,
  rows,
  colors,
  color,
}: {
  title: string
  total: number
  rows: PLRow[]
  colors: string[]
  color: string
}) {
  const data = rows
    .filter((r) => r.total > 0)
    .map((r, i) => ({
      name: r.categoryName,
      value: r.total,
      percent: total > 0 ? Math.round((r.total / total) * 100) : 0,
      fill: colors[i % colors.length],
    }))

  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 flex flex-col items-center justify-center h-[260px]">
        <p className="text-[#6b7280] text-sm">{title}</p>
        <p className="text-2xl font-bold text-[#111111] mt-2">—</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
      <p className="text-sm text-[#6b7280] mb-1">{title}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>
        {formatNum(total)}
      </p>
      <div className="flex items-center gap-4 mt-4">
        <div className="w-[140px] h-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={66}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
              <span className="text-xs text-[#6b7280] truncate flex-1">{item.name}</span>
              <span className="text-xs font-medium text-[#111111] tabular-nums shrink-0">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PLSummaryCharts({ rows }: Props) {
  const incomeRows = rows.filter((r) => r.type === 'income')
  const expenseRows = rows.filter((r) => r.type === 'expense')
  const totalIncome = incomeRows.reduce((s, r) => s + r.total, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0)
  const profit = totalIncome - totalExpense

  return (
    <div className="space-y-4">
      {/* Profit banner */}
      <div
        className="rounded-2xl border px-6 py-4 flex items-center justify-between"
        style={{
          backgroundColor: profit >= 0 ? '#f0fdf4' : '#fef2f2',
          borderColor: profit >= 0 ? '#bbf7d0' : '#fecaca',
        }}
      >
        <div>
          <p className="text-sm text-[#6b7280]">Прибуток / Збиток за період</p>
          <p
            className="text-3xl font-bold tabular-nums mt-1"
            style={{ color: profit >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {profit >= 0 ? '+' : ''}{formatNum(profit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#9ca3af]">Рентабельність</p>
          <p className="text-xl font-semibold mt-1" style={{ color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
            {totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryPie
          title="Доходи за категоріями"
          total={totalIncome}
          rows={incomeRows}
          colors={COLORS_INCOME}
          color="#22c55e"
        />
        <SummaryPie
          title="Витрати за категоріями"
          total={totalExpense}
          rows={expenseRows}
          colors={COLORS_EXPENSE}
          color="#ef4444"
        />
      </div>
    </div>
  )
}
