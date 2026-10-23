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
} from 'recharts'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { CashFlowBucket } from '@/lib/utils/analytics'
import { TOKEN_COLORS } from '@/lib/ui/colors'

interface CashFlowChartProps {
  /** Months or days of the selected period (`buildCashFlow`); the x axis shows `label`. */
  data: CashFlowBucket[]
  loading?: boolean
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n)
}

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const income = Number(payload.find((p) => p.dataKey === 'income')?.value ?? 0)
  const expense = Number(payload.find((p) => p.dataKey === 'expense')?.value ?? 0)
  const net = income - expense

  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop text-sm">
      <p className="font-semibold text-ink mb-2">{label}</p>
      <div className="space-y-1 tabular-nums">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-income" />
          <span className="text-ink-muted">Дохід:</span>
          <span className="ml-auto font-medium text-income">+{formatNumber(income)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-expense" />
          <span className="text-ink-muted">Витрата:</span>
          <span className="ml-auto font-medium text-expense">−{formatNumber(expense)}</span>
        </div>
        <div className="border-t border-line pt-1 mt-1 flex items-center gap-2">
          <span className="text-ink-muted">Різниця:</span>
          <span className={net >= 0 ? 'ml-auto font-semibold text-income' : 'ml-auto font-semibold text-expense'}>
            {net >= 0 ? '+' : ''}{formatNumber(net)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="w-full h-[400px] rounded-xl bg-canvas animate-pulse flex items-center justify-center">
      <span className="text-ink-muted text-sm">Завантаження...</span>
    </div>
  )
}

export default function CashFlowChart({ data, loading }: CashFlowChartProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  if (loading) return <ChartSkeleton />

  if (!data.length) {
    return (
      <div className="w-full h-[400px] rounded-xl border border-line flex flex-col items-center justify-center gap-2">
        <p className="text-ink-muted">Немає даних за цей період</p>
        <Link href={`/${orgSlug}/transactions`} className="text-brand-soft-foreground text-sm underline underline-offset-2">
          Додати транзакції →
        </Link>
      </div>
    )
  }

  // Recharts takes colours as props: the token values from lib/ui/colors.ts.
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={TOKEN_COLORS.line} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: TOKEN_COLORS.inkMuted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: TOKEN_COLORS.inkMuted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatNumber(v)}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: TOKEN_COLORS.inkMuted, paddingTop: 8 }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              income: 'Дохід',
              expense: 'Витрата',
              balance: 'Баланс',
            }
            return labels[value] ?? value
          }}
        />
        <Bar dataKey="income" fill={TOKEN_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expense" fill={TOKEN_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={TOKEN_COLORS.ink}
          strokeWidth={2}
          dot={{ r: 3, fill: TOKEN_COLORS.ink, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: TOKEN_COLORS.ink }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
