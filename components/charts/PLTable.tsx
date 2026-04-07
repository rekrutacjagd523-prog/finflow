'use client'

import { PLRow } from '@/lib/utils/analytics'

interface PLTableProps {
  rows: PLRow[]
  monthKeys: string[]
  loading?: boolean
}

const UA_MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${UA_MONTHS[parseInt(month) - 1]} ${year.slice(2)}`
}

function formatNum(n: number): string {
  if (n === 0) return '—'
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n)
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f9fafb]">
            {Array.from({ length: cols + 2 }).map((_, i) => (
              <th key={i} className="h-10 px-4">
                <div className="h-3 bg-[#e5e7eb] rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-t border-[#e5e7eb]">
              {Array.from({ length: cols + 2 }).map((_, j) => (
                <td key={j} className="h-9 px-4">
                  <div className="h-3 bg-[#f9fafb] rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PLTable({ rows, monthKeys, loading }: PLTableProps) {
  if (loading) return <TableSkeleton cols={monthKeys.length} />

  const incomeRows = rows.filter(r => r.type === 'income')
  const expenseRows = rows.filter(r => r.type === 'expense')

  const totalIncome = (key?: string) =>
    incomeRows.reduce((s, r) => s + (key ? (r.months[key] ?? 0) : r.total), 0)
  const totalExpense = (key?: string) =>
    expenseRows.reduce((s, r) => s + (key ? (r.months[key] ?? 0) : r.total), 0)
  const profit = (key?: string) => totalIncome(key) - totalExpense(key)

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[#e5e7eb] flex flex-col items-center justify-center gap-2 py-16">
        <p className="text-[#6b7280]">Немає даних за цей період</p>
        <a href="/transactions" className="text-[#00c896] text-sm underline underline-offset-2">
          Додати транзакції →
        </a>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
      <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="bg-[#f9fafb] text-[#6b7280] text-xs uppercase tracking-wide">
            <th className="sticky left-0 z-10 bg-[#f9fafb] px-4 py-3 text-left font-semibold min-w-[180px]">
              Категорія
            </th>
            {monthKeys.map((key) => (
              <th key={key} className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                {formatMonthLabel(key)}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold">Всього</th>
          </tr>
        </thead>
        <tbody>
          {/* INCOME section */}
          <tr className="bg-[#f0fdf4]">
            <td
              colSpan={monthKeys.length + 2}
              className="sticky left-0 px-4 py-2 text-xs font-bold text-[#22c55e] uppercase tracking-wide"
            >
              Доходи
            </td>
          </tr>
          {incomeRows.map((row) => (
            <tr
              key={row.categoryId}
              className="border-t border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors"
            >
              <td className="sticky left-0 z-10 bg-white hover:bg-[#f9fafb] px-4 py-2.5 text-[#111111]">
                {row.categoryName}
              </td>
              {monthKeys.map((key) => (
                <td
                  key={key}
                  className="px-4 py-2.5 text-right text-[#22c55e]"
                >
                  {formatNum(row.months[key] ?? 0)}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-semibold text-[#22c55e]">
                {formatNum(row.total)}
              </td>
            </tr>
          ))}
          {/* Income total row */}
          <tr className="border-t-2 border-[#e5e7eb] bg-[#f0fdf4]">
            <td className="sticky left-0 z-10 bg-[#f0fdf4] px-4 py-2.5 font-semibold text-[#111111]">
              Всього доходи
            </td>
            {monthKeys.map((key) => (
              <td key={key} className="px-4 py-2.5 text-right font-semibold text-[#22c55e]">
                {formatNum(totalIncome(key))}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right font-bold text-[#22c55e]">
              {formatNum(totalIncome())}
            </td>
          </tr>

          {/* EXPENSE section */}
          <tr className="bg-[#fef2f2]">
            <td
              colSpan={monthKeys.length + 2}
              className="sticky left-0 px-4 py-2 text-xs font-bold text-[#ef4444] uppercase tracking-wide"
            >
              Витрати
            </td>
          </tr>
          {expenseRows.map((row) => (
            <tr
              key={row.categoryId}
              className="border-t border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors"
            >
              <td className="sticky left-0 z-10 bg-white hover:bg-[#f9fafb] px-4 py-2.5 text-[#111111]">
                {row.categoryName}
              </td>
              {monthKeys.map((key) => (
                <td
                  key={key}
                  className="px-4 py-2.5 text-right text-[#ef4444]"
                >
                  {formatNum(row.months[key] ?? 0)}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-semibold text-[#ef4444]">
                {formatNum(row.total)}
              </td>
            </tr>
          ))}
          {/* Expense total row */}
          <tr className="border-t-2 border-[#e5e7eb] bg-[#fef2f2]">
            <td className="sticky left-0 z-10 bg-[#fef2f2] px-4 py-2.5 font-semibold text-[#111111]">
              Всього витрати
            </td>
            {monthKeys.map((key) => (
              <td key={key} className="px-4 py-2.5 text-right font-semibold text-[#ef4444]">
                {formatNum(totalExpense(key))}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right font-bold text-[#ef4444]">
              {formatNum(totalExpense())}
            </td>
          </tr>

          {/* PROFIT / LOSS row */}
          <tr className="border-t-2 border-[#111111]">
            <td className="sticky left-0 z-10 bg-white px-4 py-3 font-bold text-[#111111]">
              Прибуток / Збиток
            </td>
            {monthKeys.map((key) => {
              const val = profit(key)
              return (
                <td
                  key={key}
                  className="px-4 py-3 text-right font-bold"
                  style={{ color: val >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {val >= 0 ? '+' : ''}{formatNum(val)}
                </td>
              )
            })}
            <td
              className="px-4 py-3 text-right font-bold text-base"
              style={{ color: profit() >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {profit() >= 0 ? '+' : ''}{formatNum(profit())}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
