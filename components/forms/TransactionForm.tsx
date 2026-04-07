'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
// Note: account/category selects use native <select> for reliable display
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createTransaction, updateTransaction } from '@/lib/firebase/transactions'
import type { Transaction, Account, Category } from '@/types'

const CURRENCIES = ['UAH', 'EUR', 'USD', 'PLN']

function toInputDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface TransactionFormProps {
  orgId: string
  accounts: Account[]
  incomeCategories: Category[]
  expenseCategories: Category[]
  transaction?: Transaction
  defaultType?: Transaction['type']
  open: boolean
  onClose: () => void
}

export function TransactionForm({
  orgId,
  accounts,
  incomeCategories,
  expenseCategories,
  transaction,
  defaultType = 'income',
  open,
  onClose,
}: TransactionFormProps) {
  const isEdit = !!transaction

  const [type, setType] = useState<Transaction['type']>(transaction?.type ?? defaultType)
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(transaction?.counterpartyId ?? '')
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState(transaction?.currency ?? 'UAH')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [date, setDate] = useState(toInputDate(transaction?.date ?? new Date()))
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring ?? false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const categories = type === 'income' ? incomeCategories : expenseCategories
  const amountRef = useRef<HTMLInputElement>(null)

  // Reset form when opened with new defaultType
  useEffect(() => {
    if (open && !isEdit) {
      setType(defaultType)
      setCategoryId('')
    }
  }, [open, defaultType, isEdit])

  // Reset category when type changes
  useEffect(() => {
    setCategoryId('')
  }, [type])

  // Focus amount on open
  useEffect(() => {
    if (open) {
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!accountId) errs.accountId = 'Оберіть рахунок'
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      errs.amount = 'Введіть суму > 0'
    if (type === 'transfer' && !toAccountId) errs.toAccountId = 'Оберіть рахунок призначення'
    if (type === 'transfer' && toAccountId === accountId)
      errs.toAccountId = 'Рахунки мають бути різними'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const buildData = (): Omit<Transaction, 'id' | 'orgId'> => {
    const data: Omit<Transaction, 'id' | 'orgId'> = {
      type,
      accountId,
      amount: parseFloat(amount),
      currency,
      date: new Date(date),
      isRecurring,
      tags: [],
      fileUrls: [],
    }
    if (categoryId) data.categoryId = categoryId
    if (type === 'transfer' && toAccountId) data.counterpartyId = toAccountId
    if (description.trim()) data.description = description.trim()
    return data
  }

  const handleSubmit = async (addAnother = false) => {
    if (!validate()) return
    setLoading(true)
    try {
      if (isEdit) {
        await updateTransaction(orgId, transaction.id, buildData())
      } else {
        await createTransaction(orgId, buildData())
      }
      if (addAnother) {
        setAmount('')
        setDescription('')
        amountRef.current?.focus()
      } else {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(false)
    }
  }

  const TYPE_COLORS: Record<Transaction['type'], string> = {
    income: '#22c55e',
    expense: '#ef4444',
    transfer: '#6366f1',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати транзакцію' : 'Нова транзакція'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type tabs */}
          <Tabs value={type} onValueChange={(v) => setType(v as Transaction['type'])}>
            <TabsList className="w-full">
              <TabsTrigger value="income" className="flex-1 data-[state=active]:text-green-600">
                Дохід
              </TabsTrigger>
              <TabsTrigger value="expense" className="flex-1 data-[state=active]:text-red-500">
                Витрата
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1 data-[state=active]:text-indigo-500">
                Переказ
              </TabsTrigger>
            </TabsList>

            {(['income', 'expense', 'transfer'] as const).map((t) => (
              <TabsContent key={t} value={t} className="space-y-4 mt-4">
                {/* Account */}
                <div className="space-y-1">
                  <Label>Рахунок{t === 'transfer' ? ' (звідки)' : ''}</Label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
                  >
                    <option value="">Оберіть рахунок</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  {errors.accountId && <p className="text-xs text-red-500">{errors.accountId}</p>}
                </div>

                {/* To account (transfer only) */}
                {t === 'transfer' && (
                  <div className="space-y-1">
                    <Label>Рахунок (куди)</Label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
                    >
                      <option value="">Оберіть рахунок</option>
                      {accounts.filter((a) => a.id !== accountId).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    {errors.toAccountId && (
                      <p className="text-xs text-red-500">{errors.toAccountId}</p>
                    )}
                  </div>
                )}

                {/* Amount + currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="tx-amount">Сума</Label>
                    <Input
                      id="tx-amount"
                      ref={amountRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="tabular-nums text-lg font-semibold"
                      style={{ color: TYPE_COLORS[t] }}
                    />
                    {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Валюта</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'UAH')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Category (not for transfer) */}
                {t !== 'transfer' && (
                  <div className="space-y-1">
                    <Label>Категорія</Label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
                    >
                      <option value="">Без категорії</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date */}
                <div className="space-y-1">
                  <Label htmlFor="tx-date">Дата</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label htmlFor="tx-desc">Опис</Label>
                  <Input
                    id="tx-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Необов'язково"
                  />
                </div>

                {/* Advanced section */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {showAdvanced ? 'Сховати' : 'Розгорнути'} додаткові поля
                </button>

                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="accent-[#00c896]"
                      />
                      <span className="text-sm">Повторювана транзакція</span>
                      {isRecurring && (
                        <Badge variant="secondary" className="text-xs">
                          recurring
                        </Badge>
                      )}
                    </label>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="sm:mr-auto">
            Скасувати
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => handleSubmit(true)}
            >
              Додати та створити подібний
            </Button>
          )}
          <Button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(false)}
            style={{ backgroundColor: '#00c896' }}
          >
            {loading ? 'Збереження...' : isEdit ? 'Зберегти' : 'Додати'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
