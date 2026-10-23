'use client'

import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateShort } from '@/lib/utils/date'
import type { Transaction, Account, Category } from '@/types'

// Sign and colour of an amount; a transfer moves money between own accounts, so it stays neutral.
const AMOUNT_STYLE: Record<Transaction['type'], { sign: string; className: string }> = {
  income: { sign: '+', className: 'text-income' },
  expense: { sign: '−', className: 'text-expense' },
  transfer: { sign: '', className: 'text-ink-muted' },
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
              <TableHead className="w-28 pl-4">Дата</TableHead>
              <TableHead className="w-40 text-right">Сума</TableHead>
              <TableHead>Рахунок</TableHead>
              <TableHead>Категорія</TableHead>
              <TableHead className="pr-4">Коментар</TableHead>
            </TableRow>
          </TableHeader>
          {keys.map((dateKey) => {
            const txs = grouped[dateKey]
            const dayTotal = txs.reduce((sum, tx) => {
              if (tx.type === 'income') return sum + tx.amount
              if (tx.type === 'expense') return sum - tx.amount
              return sum
            }, 0)
            const dayStyle = dayTotal >= 0 ? AMOUNT_STYLE.income : AMOUNT_STYLE.expense

            return (
              <TableBody key={dateKey} className="[&_tr:last-child]:border-b">
                <TableRow className="bg-canvas hover:bg-canvas">
                  <TableCell colSpan={5} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-ink-muted">{formatGroupKey(dateKey)}</span>
                      <span className={cn('text-xs font-semibold tabular-nums', dayStyle.className)}>
                        {dayStyle.sign}
                        {formatCurrency(Math.abs(dayTotal), txs[0]?.currency ?? 'UAH')}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {txs.map((tx) => {
                  const amount = AMOUNT_STYLE[tx.type]
                  const account = accountMap[tx.accountId]
                  const toAccount =
                    tx.type === 'transfer' && tx.counterpartyId ? accountMap[tx.counterpartyId] : null
                  const category = tx.categoryId ? categoryMap[tx.categoryId] : null

                  return (
                    <TableRow
                      key={tx.id}
                      tabIndex={0}
                      onClick={() => setEditTx(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditTx(tx)
                      }}
                      className="cursor-pointer hover:bg-canvas focus-visible:bg-brand-soft focus-visible:outline-none"
                    >
                      <TableCell className="pl-4 text-ink-muted tabular-nums">{formatDateShort(tx.date)}</TableCell>
                      <TableCell className={cn('text-right font-semibold tabular-nums', amount.className)}>
                        {amount.sign}
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="text-ink">
                        <span className="block max-w-56 truncate">
                          {toAccount ? `${account?.name ?? '—'} → ${toAccount.name}` : (account?.name ?? '—')}
                        </span>
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="pr-4 text-ink-muted">
                        <span className="block max-w-72 truncate">{tx.description || '—'}</span>
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
