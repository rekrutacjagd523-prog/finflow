'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ReceiptText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { deleteTransaction } from '@/lib/firebase/transactions'
import type { Transaction, Account, Category } from '@/types'

const TYPE_CONFIG = {
  income: {
    icon: ArrowDownLeft,
    color: '#22c55e',
    label: 'Дохід',
    sign: '+',
  },
  expense: {
    icon: ArrowUpRight,
    color: '#ef4444',
    label: 'Витрата',
    sign: '-',
  },
  transfer: {
    icon: ArrowLeftRight,
    color: '#6366f1',
    label: 'Переказ',
    sign: '↔',
  },
}

function formatGroupKey(key: string): string {
  const date = new Date(key + 'T12:00:00')
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  }).format(date)
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
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const keys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ReceiptText className="h-12 w-12 text-gray-200 mb-4" />
        <p className="text-gray-500 font-medium">Транзакцій ще немає</p>
        <p className="text-sm text-gray-400 mt-1">
          Натисніть «+ Дохід», «- Витрата» або «↔ Переказ», щоб додати першу транзакцію
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {keys.map((dateKey) => {
          const txs = grouped[dateKey]
          const dayTotal = txs.reduce((sum, tx) => {
            if (tx.type === 'income') return sum + tx.amount
            if (tx.type === 'expense') return sum - tx.amount
            return sum
          }, 0)

          return (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-medium text-gray-500 capitalize">
                  {formatGroupKey(dateKey)}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: dayTotal >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {dayTotal >= 0 ? '+' : ''}
                  {formatCurrency(dayTotal, txs[0]?.currency ?? 'UAH')}
                </span>
              </div>

              {/* Transaction rows */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {txs.map((tx, idx) => {
                  const cfg = TYPE_CONFIG[tx.type]
                  const Icon = cfg.icon
                  const account = accountMap[tx.accountId]
                  const toAccount =
                    tx.type === 'transfer' && tx.counterpartyId
                      ? accountMap[tx.counterpartyId]
                      : null
                  const category = tx.categoryId ? categoryMap[tx.categoryId] : null

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setEditTx(tx)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined,
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cfg.color + '18' }}
                      >
                        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                      </div>

                      {/* Category + account */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {category?.name ?? cfg.label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {tx.type === 'transfer' && toAccount
                            ? `${account?.name ?? '—'} → ${toAccount.name}`
                            : (account?.name ?? '—')}
                          {tx.description && ` · ${tx.description}`}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: cfg.color }}
                        >
                          {cfg.sign}
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
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
