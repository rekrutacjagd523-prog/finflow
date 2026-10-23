'use client'

import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDayShortUtc, summarizeDay } from '@/lib/utils/journal'
import type { Transaction, Account, Category } from '@/types'

// Sign and colour of an amount; a transfer moves money between own accounts, so it stays neutral.
const AMOUNT_STYLE: Record<Transaction['type'], { sign: string; className: string }> = {
  income: { sign: '+', className: 'text-income' },
  expense: { sign: '−', className: 'text-expense' },
  transfer: { sign: '', className: 'text-ink-muted' },
}

// Date, Amount, Account, Category, Comment, plus the phone-only trailing Amount cell.
// The day header spans all of them; the browser clamps it to the columns that are visible.
const COLUMN_COUNT = 6

// The amount cell exists twice (a column from `sm`, a trailing cell below it) and both read from here.
function amountLabel(tx: Transaction): string {
  const { sign } = AMOUNT_STYLE[tx.type]
  return `${sign}${formatCurrency(tx.amount, tx.currency)}`
}

function formatGroupKey(key: string): string {
  const date = new Date(key + 'T12:00:00')
  const label = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  }).format(date)
  // Capitalise only the first letter: the CSS `capitalize` class would also uppercase the month and «р.».
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface TransactionListProps {
  grouped: Record<string, Transaction[]>
  accounts: Account[]
  incomeCategories: Category[]
  expenseCategories: Category[]
  orgId: string
  loading: boolean
}

export function TransactionList({
  grouped,
  accounts,
  incomeCategories,
  expenseCategories,
  orgId,
  loading,
}: TransactionListProps) {
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const allCategories = [...incomeCategories, ...expenseCategories]
  const categoryMap = Object.fromEntries(allCategories.map((c) => [c.id, c]))

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-control bg-canvas" />
        ))}
      </div>
    )
  }

  const keys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-line bg-surface py-16 text-center">
        <ReceiptText className="mb-4 size-12 text-ink-subtle" />
        <p className="font-medium text-ink">Операцій ще немає</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Натисніть «Дохід», «Витрата» або «Переказ» у шапці, щоб додати першу операцію
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="hidden w-28 pl-4 sm:table-cell">Дата</TableHead>
              <TableHead className="hidden w-40 text-right sm:table-cell">Сума</TableHead>
              <TableHead className="pl-4 sm:pl-3">Рахунок</TableHead>
              <TableHead className="hidden md:table-cell">Категорія</TableHead>
              <TableHead className="hidden pr-4 md:table-cell">Коментар</TableHead>
              <TableHead className="pr-4 text-right sm:hidden">Сума</TableHead>
            </TableRow>
          </TableHeader>
          {keys.map((dateKey) => {
            const txs = grouped[dateKey]
            // null for a day with several currencies: no sum is better than a wrong one.
            const day = summarizeDay(txs)
            // A day that nets to exactly 0 (e.g. only transfers) stays neutral, without a sign.
            const dayStyle = !day || day.total === 0 ? AMOUNT_STYLE.transfer : day.total > 0 ? AMOUNT_STYLE.income : AMOUNT_STYLE.expense

            return (
              <TableBody key={dateKey} className="[&_tr:last-child]:border-b">
                <TableRow className="bg-canvas hover:bg-canvas">
                  <TableHead scope="rowgroup" colSpan={COLUMN_COUNT} className="h-auto px-4 py-2 font-semibold">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-ink-muted">{formatGroupKey(dateKey)}</span>
                      {day && (
                        <span className={cn('text-xs font-semibold tabular-nums', dayStyle.className)}>
                          {dayStyle.sign}
                          {formatCurrency(Math.abs(day.total), day.currency)}
                        </span>
                      )}
                    </div>
                  </TableHead>
                </TableRow>
                {txs.map((tx) => {
                  const amount = AMOUNT_STYLE[tx.type]
                  const account = accountMap[tx.accountId]
                  const toAccount =
                    tx.type === 'transfer' && tx.counterpartyId ? accountMap[tx.counterpartyId] : null
                  const category = tx.categoryId ? categoryMap[tx.categoryId] : null
                  const categoryName = category?.name ?? (tx.type === 'transfer' ? 'Переказ' : 'Без категорії')

                  return (
                    <TableRow
                      key={tx.id}
                      tabIndex={0}
                      onClick={() => setEditTx(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditTx(tx)
                      }}
                      className="cursor-pointer hover:bg-canvas focus-visible:bg-brand-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-soft-foreground"
                    >
                      <TableCell className="hidden pl-4 text-ink-muted tabular-nums sm:table-cell">
                        {formatDayShortUtc(tx.date)}
                      </TableCell>
                      <TableCell className={cn('hidden text-right font-semibold tabular-nums sm:table-cell', amount.className)}>
                        {amountLabel(tx)}
                      </TableCell>
                      <TableCell className="pl-4 text-ink sm:pl-3">
                        <span className="block max-w-44 truncate sm:max-w-56">
                          {toAccount ? `${account?.name ?? '—'} → ${toAccount.name}` : (account?.name ?? '—')}
                        </span>
                        {/* The Category column is hidden below md; keep the name as a second line there. */}
                        <span className="block max-w-44 truncate text-xs text-ink-subtle md:hidden">{categoryName}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {category ? (
                          <Badge variant="chip">
                            <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                            {category.name}
                          </Badge>
                        ) : tx.type === 'transfer' ? (
                          <Badge variant="chip">Переказ</Badge>
                        ) : (
                          <span className="text-ink-subtle">Без категорії</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-ink-muted md:table-cell">
                        <span className="block max-w-72 truncate">{tx.description || '—'}</span>
                      </TableCell>
                      <TableCell className={cn('pr-4 text-right font-semibold tabular-nums sm:hidden', amount.className)}>
                        {amountLabel(tx)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            )
          })}
        </Table>
      </div>

      {editTx && (
        <TransactionForm
          orgId={orgId}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transaction={editTx}
          open={!!editTx}
          onClose={() => setEditTx(null)}
        />
      )}
    </>
  )
}
