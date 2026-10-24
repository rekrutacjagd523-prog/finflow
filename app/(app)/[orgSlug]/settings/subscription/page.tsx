'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RequireAction } from '@/components/shell/RequireAction'
import { useShell } from '@/lib/hooks/useShell'

export default function SubscriptionSettingsPage() {
  // The shell's org is always the URL's org (null while it loads).
  const { org } = useShell()

  return (
    <RequireAction action="subscription.view">
      <Card className="ring-line">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">Підписка</CardTitle>
        </CardHeader>
        <CardContent>
          {!org ? (
            <div className="h-10 animate-pulse rounded-control bg-canvas" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium capitalize text-ink">{org.plan} plan</p>
                {org.plan === 'trial' && (
                  <p className="mt-0.5 text-xs text-ink-muted">Trial до {org.trialEndsAt.toLocaleDateString()}</p>
                )}
              </div>
              {org.plan !== 'pro' && (
                <Button variant="outline" className="border-brand text-brand-soft-foreground hover:bg-brand-soft">
                  Upgrade to Pro
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </RequireAction>
  )
}
