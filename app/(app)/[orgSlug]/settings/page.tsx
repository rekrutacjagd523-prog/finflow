'use client'

import { useState, useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrg } from '@/lib/hooks/useOrg'
import { db } from '@/lib/firebase/firebase'

const CURRENCIES = [
  { value: 'UAH', label: 'UAH — Ukrainian Hryvnia' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'PLN', label: 'PLN — Polish Zloty' },
]

export default function SettingsPage() {
  const { org, orgId } = useOrg()
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
    if (!orgId || !name) return

    setSaving(true)
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        name,
        currency,
      })
      toast.success('Settings saved')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const isChanged = org && (name !== org.name || currency !== org.currency)

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-[#111111] text-2xl font-semibold">Settings</h1>
        <p className="text-[#6b7280] text-sm mt-1">Manage your organization settings</p>
      </div>

      <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#111111] text-base font-semibold">
            Organization
          </CardTitle>
          <CardDescription className="text-[#6b7280] text-sm">
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-[#111111] text-sm font-medium">
                Organization name
              </Label>
              <Input
                id="orgName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-[6px] border-[#e5e7eb] text-[#111111] focus-visible:ring-[#00c896]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-[#111111] text-sm font-medium">
                Primary currency
              </Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger
                  id="currency"
                  className="rounded-[6px] border-[#e5e7eb] text-[#111111] focus:ring-[#00c896]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={!isChanged || saving}
                className="bg-[#00c896] hover:bg-[#00b584] text-white rounded-[8px] font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {org && (
        <Card className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-none mt-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#111111] text-base font-semibold">
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#111111] text-sm font-medium capitalize">{org.plan} plan</p>
                {org.plan === 'trial' && (
                  <p className="text-[#6b7280] text-xs mt-0.5">
                    Trial ends {org.trialEndsAt.toLocaleDateString()}
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
