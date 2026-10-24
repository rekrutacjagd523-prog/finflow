'use client'

import { useState } from 'react'
import { Transaction } from '@/types'
import { buildCalendar, DayData } from '@/lib/utils/analytics'
import { ChevronLeft, ChevronRight, ChevronRight as ExpandIcon } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useShell } from '@/lib/hooks/useShell'
import { formatCurrency } from '@/lib/utils/currency'
import { TOKEN_COLORS } from '@/lib/ui/colors'

interface CalendarViewProps {
  transactions: Transaction[]
  year: number
  month: number
  onNavigate: (dir: 'prev' | 'next') => void
  /** The company currency, used for the day and month totals. */
  currency: string
  loading?: boolean
}

const UA_MONTHS_FULL = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]

const UA_WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function getDayOfWeek(year: number, month: number, day: number): string {
  return UA_WEEKDAYS[new Date(year, month, day).getDay()]
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-canvas animate-pulse" />
      ))}
    </div>
  )
}

interface DayRowProps {
  day: DayData
  dayNum: number
  year: number
  month: number
  transactions: Transaction[]
  currency: string
}

function DayRow({ day, dayNum, year, month, transactions, currency }: DayRowProps) {
  const [expanded, setExpanded] = useState(false)

  const dayTxs = transactions.filter((tx) => {
    const d = tx.date instanceof Date ? tx.date : new Date(tx.date)
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === dayNum
    )
  })

  const dow = getDayOfWeek(year, month, dayNum)
  const isWeekend = dow === 'Нд' || dow === 'Сб'
  const isToday = day.date === new Date().toISOString().slice(0, 10)

  return (
    <>
      <div
        className={[
          'flex items-center gap-3 px-4 py-3 border-b border-line transition-colors',
          day.hasTransactions ? 'cursor-pointer hover:bg-canvas' : '',
          isToday ? 'bg-brand-soft' : '',
        ].join(' ')}
        onClick={() => day.hasTransactions && setExpanded((v) => !v)}
      >
        {/* Day label */}
        <div className="flex items-center gap-1.5 w-14 shrink-0">
          <span className={`text-xs font-medium ${isWeekend ? 'text-expense' : 'text-ink-muted'}`}>
            {dow}
          </span>
          <span className="text-sm font-semibold text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {String(dayNum).padStart(2, '0')}
          </span>
        </div>

        {/* Dots separator */}
        <div className="flex-1 border-b border-dotted border-line self-center" />

        {/* Amounts */}
        <div className="flex items-center gap-4 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {day.income > 0 ? (
            <span className="text-sm font-medium text-income min-w-[90px] text-right">
              +{formatCurrency(day.income, currency)}
            </span>
          ) : (
            <span className="min-w-[90px]" />
          )}
          {day.expense > 0 ? (
            <span className="text-sm font-medium text-expense min-w-[90px] text-right">
              -{formatCurrency(day.expense, currency)}
            </span>
          ) : (
            <span className="min-w-[90px]" />
          )}
          <span
            className="text-sm min-w-[90px] text-right"
            style={{ color: day.balance >= 0 ? TOKEN_COLORS.inkMuted : TOKEN_COLORS.expense }}
          >
            {formatCurrency(day.balance, currency)}
          </span>
        </div>

        {/* Expand arrow */}
        {day.hasTransactions && (
          <ExpandIcon
            className={`w-4 h-4 text-ink-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </div>

      {/* Accordion: transactions for this day */}
      {expanded && dayTxs.length > 0 && (
        <div className="bg-canvas border-b border-line">
          {dayTxs.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-8 py-2 text-sm border-b border-line last:border-0"
            >
              <div className="flex flex-col">
                <span className="text-ink">
                  {tx.description || (tx.type === 'income' ? 'Дохід' : tx.type === 'expense' ? 'Витрата' : 'Переказ')}
                </span>
              </div>
              <span
                className="font-medium"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: tx.type === 'income' ? TOKEN_COLORS.income : tx.type === 'expense' ? TOKEN_COLORS.expense : TOKEN_COLORS.inkMuted,
                }}
              >
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                {formatCurrency(tx.amount, tx.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function CalendarView({ transactions, year, month, onNavigate, currency, loading }: CalendarViewProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const { can } = useShell()
  const days = buildCalendar(transactions, year, month)
  const totalIncome = days.reduce((s, d) => s + d.income, 0)
  const totalExpense = days.reduce((s, d) => s + d.expense, 0)

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('prev')}
          className="p-2 rounded-lg hover:bg-canvas transition-colors text-ink-muted hover:text-ink"
          aria-label="Попередній місяць"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <h3 className="text-base font-semibold text-ink">
            {UA_MONTHS_FULL[month]} {year}
          </h3>
          <div className="flex gap-3 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {totalIncome > 0 && (
              <span className="text-income">+{formatCurrency(totalIncome, currency)}</span>
            )}
            {totalExpense > 0 && (
              <span className="text-expense">-{formatCurrency(totalExpense, currency)}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => onNavigate('next')}
          className="p-2 rounded-lg hover:bg-canvas transition-colors text-ink-muted hover:text-ink"
          aria-label="Наступний місяць"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <Skeleton />
      ) : days.every(d => !d.hasTransactions) ? (
        <div className="rounded-xl border border-line flex flex-col items-center justify-center gap-2 py-16">
          <p className="text-ink-muted">Немає транзакцій за цей місяць</p>
          {can('data.write') && (
            <Link href={`/${orgSlug}/transactions`} className="text-brand-soft-foreground text-sm underline underline-offset-2">
              Додати транзакції →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line overflow-hidden bg-white">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 bg-canvas border-b border-line text-xs text-ink-muted font-semibold uppercase tracking-wide">
            <div className="w-14 shrink-0">День</div>
            <div className="flex-1" />
            <div className="flex items-center gap-4 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="min-w-[90px] text-right text-income">Дохід</span>
              <span className="min-w-[90px] text-right text-expense">Витрата</span>
              <span className="min-w-[90px] text-right">Баланс</span>
            </div>
            <div className="w-4" />
          </div>
          {days.map((day, i) => (
            <DayRow
              key={day.date}
              day={day}
              dayNum={i + 1}
              year={year}
              month={month}
              transactions={transactions}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  )
}
