'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import EnableBankingConnect from '@/components/settings/EnableBankingConnect'

// The Enable Banking callback returns here (`?eb_auth=` / `?eb_error=`). EnableBankingConnect
// (unchanged in S01A) consumes only `eb_auth`; a user who cancels at the bank lands here with
// `eb_error=1` and sees no message yet (known gap, tracked as a follow-up).
export default function BanksSettingsPage() {
  const params = useParams()
  const orgId = params.orgSlug as string

  return (
    <Card className="ring-line">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-ink">Підключення банку</CardTitle>
        <CardDescription className="text-ink-muted">
          Santander, PKO, mBank, ING та інші банки через Enable Banking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EnableBankingConnect orgId={orgId} />
      </CardContent>
    </Card>
  )
}
