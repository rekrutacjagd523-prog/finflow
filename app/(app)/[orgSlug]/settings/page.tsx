'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useOrg } from '@/lib/hooks/useOrg'
import { useCategories } from '@/lib/hooks/useCategories'
import { createCategory } from '@/lib/firebase/categories'
import { db } from '@/lib/firebase/firebase'
import EnableBankingConnect from '@/components/settings/EnableBankingConnect'
import type { Category } from '@/types'

const CURRENCIES = [
  { value: 'UAH', label: 'UAH — Ukrainian Hryvnia' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'PLN', label: 'PLN — Polish Zloty' },
]

const CATEGORY_COLORS = [
  '#22c55e', '#16a34a', '#4ade80', '#86efac',
  '#ef4444', '#dc2626', '#f87171', '#fca5a5',
  '#3b82f6', '#6366f1', '#a855f7', '#f59e0b',
  '#f97316', '#06b6d4', '#00c896', '#6b7280',
]

export default function SettingsPage() {
  const params = useParams()
  const orgId = params.orgSlug as string
  const { org } = useOrg()
  const { incomeCategories, expenseCategories } = useCategories(orgId)

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('UAH')
  const [saving, setSaving] = useState(false)

  // New category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('income')
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0])
  const [addingCat, setAddingCat] = useState(false)

  useEffect(() => {
    if (org) {
      setName(org.name)
      setCurrency(org.currency)
    }
  }, [org])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !name) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'organizations', orgId), { name, currency })
      toast.success('Збережено')
    } catch {
      toast.error('Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      await createCategory(orgId, { name: newCatName.trim(), type: newCatType, color: newCatColor })
      setNewCatName('')
      toast.success('Категорію додано')
    } catch {
      toast.error('Помилка')
    } finally {
      setAddingCat(false)
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'categories', cat.id))
      toast.success('Видалено')
    } catch {
      toast.error('Помилка')
    }
  }

  const isChanged = org && (name !== org.name || currency !== org.currency)

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-[#111111] text-2xl font-semibold">Налаштування</h1>
        <p className="text-[#6b7280] text-sm mt-1">Організація та категорії</p>
      </div>

      {/* Org settings */}
      <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#111111] text-base font-semibold">Організація</CardTitle>
          <CardDescription className="text-[#6b7280] text-sm">Назва та валюта</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-[#111111] text-sm font-medium">Назва</Label>
              <Input
                id="orgName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-[6px] border-[#e5e7eb]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-[#111111] text-sm font-medium">Валюта</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-8 rounded-lg border border-[#e5e7eb] bg-transparent px-2.5 text-sm outline-none focus:border-[#00c896]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              disabled={!isChanged || saving}
              className="bg-[#00c896] hover:bg-[#00b584] text-white rounded-[8px] font-medium disabled:opacity-50"
            >
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#111111] text-base font-semibold">Категорії</CardTitle>
          <CardDescription className="text-[#6b7280] text-sm">Доходи та витрати</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category lists */}
          {[
            { label: 'Доходи', cats: incomeCategories },
            { label: 'Витрати', cats: expenseCategories },
          ].map(({ label, cats }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">{label}</p>
              {cats.length === 0 ? (
                <p className="text-sm text-[#9ca3af] italic">Немає категорій</p>
              ) : (
                <div className="space-y-1">
                  {cats.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2 group">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-[#111111] flex-1">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9ca3af] hover:text-[#ef4444]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Add category form */}
          <div className="border-t border-[#f3f4f6] pt-4">
            <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-3">Додати категорію</p>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Назва категорії"
                  className="rounded-[6px] border-[#e5e7eb] text-sm flex-1"
                />
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as 'income' | 'expense')}
                  className="h-8 rounded-lg border border-[#e5e7eb] bg-transparent px-2 text-sm outline-none focus:border-[#00c896]"
                >
                  <option value="income">Дохід</option>
                  <option value="expense">Витрата</option>
                </select>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCatColor(c)}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: newCatColor === c ? '#111' : 'transparent',
                      transform: newCatColor === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
              <Button
                type="submit"
                disabled={!newCatName.trim() || addingCat}
                className="bg-[#00c896] hover:bg-[#00b584] text-white rounded-[8px] text-sm font-medium disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Додати
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Enable Banking (European banks) */}
      <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#111111] text-base font-semibold">Підключення банку</CardTitle>
          <CardDescription className="text-[#6b7280] text-sm">
            Santander, PKO, mBank, ING та інші через Enable Banking Open Banking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnableBankingConnect orgId={orgId} />
        </CardContent>
      </Card>

      {/* Subscription */}
      {org && (
        <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#111111] text-base font-semibold">Підписка</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#111111] text-sm font-medium capitalize">{org.plan} plan</p>
                {org.plan === 'trial' && (
                  <p className="text-[#6b7280] text-xs mt-0.5">
                    Trial до {org.trialEndsAt.toLocaleDateString()}
                  </p>
                )}
              </div>
              {org.plan !== 'pro' && (
                <Button
                  variant="outline"
                  className="rounded-[8px] border-[#00c896] text-[#00c896] hover:bg-[#00c896]/5 text-sm"
                >
                  Upgrade to Pro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
