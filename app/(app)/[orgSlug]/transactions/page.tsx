'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { TransactionFiltersBar } from '@/components/transactions/TransactionFilters'
import { TransactionList } from '@/components/transactions/TransactionList'
import { useShell } from '@/lib/hooks/useShell'
import { useTransactions } from '@/lib/hooks/useTransactions'
import type { TransactionFilters } from '@/lib/firebase/transactions'

export default function TransactionsPage() {
  const { orgId, accounts, incomeCategories, expenseCategories, selectedAccountId, selectAccount } = useShell()
  const [filters, setFilters] = useState<TransactionFilters>({})

  // The sidebar selection wins over the toolbar's account filter (as the account strip did).
  const effectiveFilters: TransactionFilters = {
    ...filters,
    accountId: selectedAccountId ?? filters.accountId,
  }

  const { grouped, loading } = useTransactions(orgId, effectiveFilters)
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-lg font-semibold text-ink">Платежі</h1>
        {selectedAccount && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-brand-soft-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: selectedAccount.color }} />
            {selectedAccount.name}
            <button
              type="button"
              onClick={() => selectAccount(null)}
              aria-label="Показати всі рахунки"
              className="flex size-5 items-center justify-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X className="size-3" />
            </button>
          </span>
        )}
      </div>

      <TransactionFiltersBar
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        filters={filters}
        onChange={setFilters}
      />

      <TransactionList
        grouped={grouped}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        orgId={orgId}
        loading={loading}
      />
    </div>
  )
}
