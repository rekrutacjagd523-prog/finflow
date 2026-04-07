'use client'

import { useState, useEffect, useCallback } from 'react'
import { Account } from '@/types'

interface BalanceSheetProps {
  accounts: Account[]
  orgId?: string
  loading?: boolean
}

interface EditableFields {
  // Assets I — Fixed
  realestate: number
  equipment: number
  // Assets II — Current
  inventory: number
  receivables: number
  // Liabilities I — Equity
  charter_capital: number
  additional_capital: number
  // Liabilities II — Debt
  loans: number
}

const DEFAULT_FIELDS: EditableFields = {
  realestate: 0,
  equipment: 0,
  inventory: 0,
  receivables: 0,
  charter_capital: 0,
  additional_capital: 0,
  loans: 0,
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

function EditableRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[#374151] flex-1">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min={0}
          step="0.01"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-32 text-right text-sm px-2 py-1 rounded-md border border-[#e5e7eb] focus:outline-none focus:ring-1 focus:ring-[#00c896] focus:border-[#00c896] text-[#111111] bg-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="text-xs text-[#6b7280]">€</span>
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[#374151] flex-1">{label}</span>
      <span
        className="text-sm font-medium shrink-0"
        style={{ fontVariantNumeric: 'tabular-nums', color: color ?? (value >= 0 ? '#111111' : '#ef4444') }}
      >
        {formatNum(value)} €
      </span>
    </div>
  )
}

function SectionHeader({ roman, title, total }: { roman: string; title: string; total: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-[#e5e7eb] mt-2">
      <span className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">
        {roman}. {title}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ fontVariantNumeric: 'tabular-nums', color: total >= 0 ? '#111111' : '#ef4444' }}
      >
        {formatNum(total)} €
      </span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-[#e5e7eb] p-5 space-y-4">
          <div className="h-4 w-28 bg-[#e5e7eb] rounded animate-pulse" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex justify-between items-center gap-4">
              <div className="h-3 flex-1 bg-[#f9fafb] rounded animate-pulse" />
              <div className="h-3 w-24 bg-[#f9fafb] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function BalanceSheet({ accounts, orgId = 'default', loading }: BalanceSheetProps) {
  const storageKey = `balance-sheet-${orgId}`

  const [fields, setFields] = useState<EditableFields>(DEFAULT_FIELDS)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        setFields({ ...DEFAULT_FIELDS, ...JSON.parse(stored) })
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey])

  // Save to localStorage on change
  const updateField = useCallback(
    (key: keyof EditableFields, value: number) => {
      setFields((prev) => {
        const next = { ...prev, [key]: value }
        try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* noop */ }
        return next
      })
    },
    [storageKey]
  )

  if (loading) return <Skeleton />

  // --- Assets calculations ---
  const cryptoAccounts = accounts.filter((a) => a.type === 'crypto')
  const cryptoTotal = cryptoAccounts.reduce((s, a) => s + a.balance, 0)

  // Section I — Fixed assets
  const fixedTotal = fields.realestate + fields.equipment + cryptoTotal

  // Section II — Current assets
  const currentTotal = fields.inventory + fields.receivables

  // Section III — Money (auto from accounts)
  const moneyTotal = accounts.reduce((s, a) => s + a.balance, 0)

  const totalAssets = fixedTotal + currentTotal + moneyTotal

  // --- Liabilities calculations ---
  // Section I — Equity
  const retainedEarnings = moneyTotal // auto = sum of all money accounts
  const equityTotal = fields.charter_capital + fields.additional_capital + retainedEarnings

  // Section II — Debt
  const debtTotal = fields.loans

  const totalLiabilities = equityTotal + debtTotal

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* ======= ASSETS ======= */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-1">
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e7eb]">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Активи</h3>
          <span className="text-sm font-bold text-[#00c896]">{formatNum(totalAssets)} €</span>
        </div>

        {/* I. Fixed */}
        <SectionHeader roman="I" title="Основні засоби" total={fixedTotal} />
        <EditableRow label="Нерухомість" value={fields.realestate} onChange={(v) => updateField('realestate', v)} />
        <EditableRow label="Обладнання" value={fields.equipment} onChange={(v) => updateField('equipment', v)} />
        <ReadOnlyRow label="Інвестиції (крипто)" value={cryptoTotal} />
        {cryptoAccounts.map((acc) => (
          <div key={acc.id} className="flex items-center justify-between gap-3 pl-4 py-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
              <span className="text-xs text-[#6b7280] truncate">{acc.name}</span>
            </div>
            <span className="text-xs text-[#6b7280] shrink-0">{formatNum(acc.balance)} €</span>
          </div>
        ))}

        {/* II. Current */}
        <SectionHeader roman="II" title="Поточні активи" total={currentTotal} />
        <EditableRow label="Запаси" value={fields.inventory} onChange={(v) => updateField('inventory', v)} />
        <EditableRow label="Дебіторська заборгованість" value={fields.receivables} onChange={(v) => updateField('receivables', v)} />

        {/* III. Money */}
        <SectionHeader roman="III" title="Гроші" total={moneyTotal} />
        {accounts.length === 0 ? (
          <p className="text-sm text-[#6b7280] italic py-1">Немає рахунків</p>
        ) : (
          accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: acc.color }} />
                <span className="text-sm text-[#374151] truncate">{acc.name}</span>
              </div>
              <span
                className="text-sm font-medium shrink-0"
                style={{ color: acc.balance >= 0 ? '#111111' : '#ef4444' }}
              >
                {formatNum(acc.balance)} €
              </span>
            </div>
          ))
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-[#111111]">
          <span className="text-base font-bold text-[#111111]">Всього активи</span>
          <span className="text-base font-bold text-[#00c896]">{formatNum(totalAssets)} €</span>
        </div>
      </div>

      {/* ======= LIABILITIES ======= */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-1">
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e7eb]">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Зобов'язання</h3>
          <span className="text-sm font-bold text-[#6366f1]">{formatNum(totalLiabilities)} €</span>
        </div>

        {/* I. Equity */}
        <SectionHeader roman="I" title="Власний капітал" total={equityTotal} />
        <EditableRow label="Статутний капітал" value={fields.charter_capital} onChange={(v) => updateField('charter_capital', v)} />
        <EditableRow label="Додатковий капітал" value={fields.additional_capital} onChange={(v) => updateField('additional_capital', v)} />
        <ReadOnlyRow label="Нерозподілений прибуток" value={retainedEarnings} color={retainedEarnings >= 0 ? '#22c55e' : '#ef4444'} />

        {/* II. Debt */}
        <SectionHeader roman="II" title="Позиковий капітал" total={debtTotal} />
        <EditableRow label="Кредити" value={fields.loans} onChange={(v) => updateField('loans', v)} />

        {/* Total */}
        <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-[#111111]">
          <span className="text-base font-bold text-[#111111]">Всього зобов'язання</span>
          <span className="text-base font-bold text-[#6366f1]">{formatNum(totalLiabilities)} €</span>
        </div>

        {/* Balance check */}
        <div className={[
          'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium mt-2',
          Math.abs(totalAssets - totalLiabilities) < 0.01
            ? 'bg-[#f0fdf4] text-[#22c55e]'
            : 'bg-[#fef2f2] text-[#ef4444]',
        ].join(' ')}>
          <span>Баланс</span>
          <span>
            {Math.abs(totalAssets - totalLiabilities) < 0.01
              ? "Активи = Зобов\u2019язання"
              : `Різниця: ${formatNum(Math.abs(totalAssets - totalLiabilities))} €`}
          </span>
        </div>
      </div>
    </div>
  )
}
