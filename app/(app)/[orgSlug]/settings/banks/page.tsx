'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import EnableBankingConnect from '@/components/settings/EnableBankingConnect'

// The Enable Banking callback returns here (`?eb_auth=` / `?eb_error=`); EnableBankingConnect
// consumes those values (unchanged in S01A).
export default function BanksSettingsPage() {
  const params = useParams()
  const orgId = params.orgSlug as string

  return (
    <Card className="ring-line">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-ink">Підключення банку</CardTitle>
        <CardDescription className="text-ink-muted">
          Santander, PKO, mBank, ING та інші через Enable Banking Open Banking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EnableBankingConnect orgId={orgId} />
      </CardContent>
    </Card>
  )
}
