'use client'

import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Account, Category } from '@/types'
import type { TransactionFilters } from '@/lib/firebase/transactions'

const SELECT_CLASS =
  'h-9 min-w-[150px] rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand-soft-foreground'
const FIELD_CLASS = 'h-9 rounded-control border-line bg-surface'

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
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            placeholder="Пошук по опису..."
            aria-label="Пошук по опису"
            className={cn(FIELD_CLASS, 'pl-9')}
          />
        </div>

        {/* Account filter */}
        <select
          value={filters.accountId ?? '_all'}
          onChange={(e) => onChange({ ...filters, accountId: e.target.value === '_all' ? undefined : e.target.value })}
          aria-label="Рахунок"
          className={SELECT_CLASS}
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
          aria-label="Категорія"
          className={SELECT_CLASS}
        >
          <option value="_all">Всі категорії</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* More filters toggle */}
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => setShowExtra((v) => !v)}
          aria-label="Додаткові фільтри"
          aria-pressed={showExtra}
          className={cn(
            'border-line bg-surface text-ink-muted hover:bg-canvas',
            showExtra && 'border-brand bg-brand-soft text-brand-soft-foreground',
          )}
        >
          <SlidersHorizontal />
        </Button>

        {/* Clear */}
        {hasActive && (
          <Button variant="ghost" size="lg" onClick={clear} className="gap-1 text-ink-muted">
            <X className="size-3.5" />
            Очистити
          </Button>
        )}
      </div>

      {showExtra && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-line bg-canvas p-3">
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm text-ink-muted">Дата від</label>
            <Input
              type="date"
              className={cn(FIELD_CLASS, 'w-[150px]')}
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
            <label className="whitespace-nowrap text-sm text-ink-muted">до</label>
            <Input
              type="date"
              className={cn(FIELD_CLASS, 'w-[150px]')}
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
            <label className="whitespace-nowrap text-sm text-ink-muted">Сума від</label>
            <Input
              type="number"
              className={cn(FIELD_CLASS, 'w-[110px] tabular-nums')}
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
            <label className="whitespace-nowrap text-sm text-ink-muted">до</label>
            <Input
              type="number"
              className={cn(FIELD_CLASS, 'w-[110px] tabular-nums')}
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
