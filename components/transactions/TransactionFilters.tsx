'use client'

import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Account, Category } from '@/types'
import type { TransactionFilters } from '@/lib/firebase/transactions'

interface TransactionFiltersProps {
  accounts: Account[]
  incomeCategories: Category[]
  expenseCategories: Category[]
  filters: TransactionFilters
  onChange: (filters: TransactionFilters) => void
}

export function TransactionFiltersBar({
  accounts,
  incomeCategories,
  expenseCategories,
  filters,
  onChange,
}: TransactionFiltersProps) {
  const [showExtra, setShowExtra] = useState(false)
  const allCategories = [...incomeCategories, ...expenseCategories]

  const hasActive =
    filters.search ||
    filters.accountId ||
    filters.categoryId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.amountMin !== undefined ||
    filters.amountMax !== undefined

  const clear = () =>
    onChange({
      search: undefined,
      accountId: undefined,
      categoryId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
    })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            placeholder="Пошук по опису..."
            className="pl-9"
          />
        </div>

        {/* Account filter */}
        <select
          value={filters.accountId ?? '_all'}
          onChange={(e) => onChange({ ...filters, accountId: e.target.value === '_all' ? undefined : e.target.value })}
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-[#00c896] min-w-[140px]"
        >
          <option value="_all">Всі рахунки</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={filters.categoryId ?? '_all'}
          onChange={(e) => onChange({ ...filters, categoryId: e.target.value === '_all' ? undefined : e.target.value })}
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-[#00c896] min-w-[140px]"
        >
          <option value="_all">Всі категорії</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* More filters toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowExtra((v) => !v)}
          className={showExtra ? 'border-[#00c896] text-[#00c896]' : ''}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>

        {/* Clear */}
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="gap-1 text-gray-500">
            <X className="h-3.5 w-3.5" />
            Очистити
          </Button>
        )}
      </div>

      {showExtra && (
        <div className="flex gap-2 flex-wrap items-center p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Дата від</label>
            <Input
              type="date"
              className="w-[150px]"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                onChange({
                  ...filters,
                  dateFrom: e.target.value ? new Date(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">до</label>
            <Input
              type="date"
              className="w-[150px]"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                onChange({
                  ...filters,
                  dateTo: e.target.value ? new Date(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Сума від</label>
            <Input
              type="number"
              className="w-[110px] tabular-nums"
              placeholder="0"
              value={filters.amountMin ?? ''}
              onChange={(e) =>
                onChange({
                  ...filters,
                  amountMin: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">до</label>
            <Input
              type="number"
              className="w-[110px] tabular-nums"
              placeholder="∞"
              value={filters.amountMax ?? ''}
              onChange={(e) =>
                onChange({
                  ...filters,
                  amountMax: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
