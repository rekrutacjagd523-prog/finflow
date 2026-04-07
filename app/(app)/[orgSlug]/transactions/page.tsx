'use client'

import { useState } from 'react'
import { Plus, Minus, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountCard } from '@/components/accounts/AccountCard'
import { AccountForm } from '@/components/forms/AccountForm'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransactionFiltersBar } from '@/components/transactions/TransactionFilters'
import { TransactionList } from '@/components/transactions/TransactionList'
import { useAccounts } from '@/lib/hooks/useAccounts'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { useCategories } from '@/lib/hooks/useCategories'
import type { TransactionFilters } from '@/lib/firebase/transactions'
import type { Transaction } from '@/types'

interface PageProps {
  params: { orgSlug: string }
}

// For dev/demo — replace with real orgId resolution from orgSlug
const DEMO_ORG_ID = 'demo-org'

export default function TransactionsPage({ params }: PageProps) {
  const orgId = DEMO_ORG_ID // TODO: resolve from orgSlug via Firestore

  const { accounts, loading: accLoading } = useAccounts(orgId)
  const { incomeCategories, expenseCategories } = useCategories(orgId)

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const effectiveFilters: TransactionFilters = {
    ...filters,
    accountId: selectedAccountId ?? filters.accountId,
  }

  const { grouped, loading: txLoading } = useTransactions(orgId, effectiveFilters)

  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [txFormOpen, setTxFormOpen] = useState(false)
  const [txType, setTxType] = useState<Transaction['type']>('income')

  const openTxForm = (type: Transaction['type']) => {
    setTxType(type)
    setTxFormOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">Транзакції</h1>

          {/* Quick action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => openTxForm('income')}
              className="gap-1.5 font-medium"
              style={{ backgroundColor: '#22c55e' }}
            >
              <Plus className="h-4 w-4" />
              Дохід
            </Button>
            <Button
              onClick={() => openTxForm('expense')}
              className="gap-1.5 font-medium"
              style={{ backgroundColor: '#ef4444' }}
            >
              <Minus className="h-4 w-4" />
              Витрата
            </Button>
            <Button
              onClick={() => openTxForm('transfer')}
              className="gap-1.5 font-medium"
              style={{ backgroundColor: '#6366f1' }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Переказ
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Accounts horizontal scroll */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Рахунки</h2>
            <button
              onClick={() => setAccountFormOpen(true)}
              className="text-xs text-[#00c896] hover:underline font-medium"
            >
              + Додати рахунок
            </button>
          </div>

          {accLoading ? (
            <div className="flex gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 w-48 rounded-xl bg-gray-100 animate-pulse shrink-0" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-xl">
              <button
                onClick={() => setAccountFormOpen(true)}
                className="text-sm text-gray-400 hover:text-[#00c896] transition-colors"
              >
                + Додати перший рахунок
              </button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* "All" card */}
              <div
                onClick={() => setSelectedAccountId(null)}
                className="relative rounded-xl border cursor-pointer transition-all hover:shadow-md p-4 shrink-0"
                style={{
                  minWidth: 140,
                  borderRadius: 12,
                  borderColor: selectedAccountId === null ? '#00c896' : '#e5e7eb',
                  boxShadow: selectedAccountId === null ? '0 0 0 2px #00c89633' : undefined,
                }}
              >
                <div
                  className="h-1 rounded-t-xl absolute top-0 left-0 right-0"
                  style={{ backgroundColor: '#00c896', borderRadius: '12px 12px 0 0' }}
                />
                <p className="text-sm font-semibold text-gray-900 mt-1">Всі рахунки</p>
                <p className="text-xs text-gray-400">{accounts.length} рахунки</p>
              </div>

              {accounts.map((account) => (
                <div key={account.id} className="shrink-0">
                  <AccountCard
                    account={account}
                    orgId={orgId}
                    selected={selectedAccountId === account.id}
                    onClick={() =>
                      setSelectedAccountId(
                        selectedAccountId === account.id ? null : account.id
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <TransactionFiltersBar
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          filters={filters}
          onChange={setFilters}
        />

        {/* Transaction list */}
        <TransactionList
          grouped={grouped}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          orgId={orgId}
          loading={txLoading}
        />
      </div>

      {/* Modals */}
      <AccountForm
        orgId={orgId}
        open={accountFormOpen}
        onClose={() => setAccountFormOpen(false)}
      />
      <TransactionForm
        orgId={orgId}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        defaultType={txType}
        open={txFormOpen}
        onClose={() => setTxFormOpen(false)}
      />
    </div>
  )
}
