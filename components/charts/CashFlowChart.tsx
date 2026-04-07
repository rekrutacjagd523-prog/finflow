'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { MonthlyData } from '@/lib/utils/analytics'

interface CashFlowChartProps {
  data: MonthlyData[]
  loading?: boolean
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n)
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null

  const income = payload.find(p => p.dataKey === 'income')?.value ?? 0
  const expense = payload.find(p => p.dataKey === 'expense')?.value ?? 0
  const net = (income as number) - (expense as number)

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold text-[#111111] mb-2">{label}</p>
      <div className="space-y-1 font-[tabular-nums]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="text-[#6b7280]">Дохід:</span>
          <span className="ml-auto font-medium text-[#22c55e]">+{formatNumber(income as number)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
          <span className="text-[#6b7280]">Витрата:</span>
          <span className="ml-auto font-medium text-[#ef4444]">−{formatNumber(expense as number)}</span>
        </div>
        <div className="border-t border-[#e5e7eb] pt-1 mt-1 flex items-center gap-2">
          <span className="text-[#6b7280]">Різниця:</span>
          <span
            className="ml-auto font-semibold"
            style={{ color: net >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {net >= 0 ? '+' : ''}{formatNumber(net)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="w-full h-[400px] rounded-xl bg-[#f9fafb] animate-pulse flex items-center justify-center">
      <span className="text-[#6b7280] text-sm">Завантаження...</span>
    </div>
  )
}

export default function CashFlowChart({ data, loading }: CashFlowChartProps) {
  if (loading) return <ChartSkeleton />

  if (!data.length) {
    return (
      <div className="w-full h-[400px] rounded-xl border border-[#e5e7eb] flex flex-col items-center justify-center gap-2">
        <p className="text-[#6b7280]">Немає даних за цей період</p>
        <a href="/transactions" className="text-[#00c896] text-sm underline underline-offset-2">
          Додати транзакції →
        </a>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280', fontVariant: 'tabular-nums' } as React.SVGProps<SVGTextElement>}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatNumber(v)}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              income: 'Дохід',
              expense: 'Витрата',
              balance: 'Баланс',
            }
            return labels[value] ?? value
          }}
        />
        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#00c896"
          strokeWidth={2}
          dot={{ r: 3, fill: '#00c896', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#00c896' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
