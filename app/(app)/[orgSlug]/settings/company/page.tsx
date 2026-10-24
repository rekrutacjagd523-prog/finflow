'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrg } from '@/lib/hooks/useOrg'
import { useShell } from '@/lib/hooks/useShell'
import { db } from '@/lib/firebase/firebase'

const CURRENCIES = [
  { value: 'UAH', label: 'UAH — Ukrainian Hryvnia' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'PLN', label: 'PLN — Polish Zloty' },
]

export default function CompanySettingsPage() {
  const params = useParams()
  const orgId = params.orgSlug as string
  // The shell's org is always the URL's org; switchOrg only refreshes it after a save.
  const { org, can } = useShell()
  const canEdit = can('company.edit')
  const { switchOrg } = useOrg()

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('UAH')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (org) {
      setName(org.name)
      setCurrency(org.currency)
    }
  }, [org])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || !orgId || !name) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'organizations', orgId), { name, currency })
    } catch {
      toast.error('Помилка збереження')
      setSaving(false)
      return
    }
    toast.success('Збережено')
    // Reload the org so the header and the sidebar total show the new name and currency.
    // The save already succeeded, so a failed refresh must not be reported as a failed save.
    try {
      await switchOrg(orgId)
    } catch {
      // The shell keeps showing the previous values until the next load.
    }
    setSaving(false)
  }

  const isChanged = org && (name !== org.name || currency !== org.currency)

  return (
    <Card className="ring-line">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-ink">Компанія</CardTitle>
        <CardDescription className="text-ink-muted">Назва та валюта</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orgName" className="text-ink">Назва</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-control border-line bg-surface"
              required
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency" className="text-ink">Валюта</Label>
            <NativeSelect
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              wrapperClassName="flex w-full"
              className="border-line"
              disabled={!canEdit}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </NativeSelect>
          </div>
          {canEdit ? (
            <Button type="submit" size="lg" disabled={!isChanged || saving}>
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          ) : (
            <p className="text-xs text-ink-muted">Змінювати дані компанії може лише власник.</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
