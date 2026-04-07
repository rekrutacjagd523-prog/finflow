'use client'

import { useState } from 'react'
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
import { createAccount, updateAccount } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

const PRESET_COLORS = [
  '#00c896',
  '#6366f1',
  '#ef4444',
  '#f97316',
  '#3b82f6',
  '#a855f7',
]

const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'bank', label: 'Банківський' },
  { value: 'cash', label: 'Готівка' },
  { value: 'card', label: 'Карта' },
  { value: 'crypto', label: 'Крипто' },
]

const CURRENCIES = ['UAH', 'EUR', 'USD', 'PLN']

interface AccountFormProps {
  orgId: string
  account?: Account
  open: boolean
  onClose: () => void
}

export function AccountForm({ orgId, account, open, onClose }: AccountFormProps) {
  const isEdit = !!account

  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<Account['type']>(account?.type ?? 'bank')
  const [balance, setBalance] = useState(account?.balance?.toString() ?? '0')
  const [currency, setCurrency] = useState(account?.currency ?? 'UAH')
  const [color, setColor] = useState(account?.color ?? PRESET_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({})

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = "Назва обов'язкова"
    const bal = parseFloat(balance)
    if (isNaN(bal) || bal < 0) errs.balance = 'Баланс повинен бути ≥ 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const data = {
        name: name.trim(),
        type,
        balance: parseFloat(balance),
        currency,
        color,
      }
      if (isEdit) {
        await updateAccount(orgId, account.id, data)
      } else {
        await createAccount(orgId, data)
      }
      onClose()
    } catch {
      // error handled silently; in production add toast
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати рахунок' : 'Новий рахунок'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="acc-name">Назва</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: Монобанк"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label>Тип</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Account['type'])}
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="acc-balance">Баланс</Label>
              <Input
                id="acc-balance"
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="font-tabular"
              />
              {errors.balance && <p className="text-xs text-red-500">{errors.balance}</p>}
            </div>
            <div className="space-y-1">
              <Label>Валюта</Label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Колір</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#111' : 'transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={loading} style={{ backgroundColor: '#00c896' }}>
              {loading ? 'Збереження...' : isEdit ? 'Зберегти' : 'Створити'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
