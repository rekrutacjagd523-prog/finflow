'use client'

import type { ReactNode } from 'react'
import VerifyEmailBanner from '@/components/auth/VerifyEmailBanner'
import { AccountsSidebar } from '@/components/shell/AccountsSidebar'
import { AppHeader } from '@/components/shell/AppHeader'
import { ModuleTabs } from '@/components/shell/ModuleTabs'

// The `.app-shell` root pins the light FinFlow palette (app/globals.css); nothing inside uses
// `dark:` variants.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex h-dvh flex-col bg-canvas text-ink">
      <AppHeader />
      <div className="flex min-h-0 flex-1 lg:px-3 lg:pb-3">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-t border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel">
          <aside aria-label="Рахунки" className="hidden shrink-0 lg:flex">
            <AccountsSidebar />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <ModuleTabs />
            <VerifyEmailBanner />
            <div className="flex-1">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
