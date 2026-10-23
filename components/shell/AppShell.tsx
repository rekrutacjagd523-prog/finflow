'use client'

import { useEffect, type ReactNode } from 'react'
import VerifyEmailBanner from '@/components/auth/VerifyEmailBanner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AccountsSidebar } from '@/components/shell/AccountsSidebar'
import { AppHeader } from '@/components/shell/AppHeader'
import { ModuleTabs } from '@/components/shell/ModuleTabs'
import { useShell } from '@/lib/hooks/useShell'

// The `.app-shell` root pins the light FinFlow palette (app/globals.css); nothing inside uses
// `dark:` variants. Below 1024 px the accounts column becomes a drawer (a left-anchored Dialog).
export function AppShell({ children }: { children: ReactNode }) {
  const { drawerOpen, setDrawerOpen } = useShell()

  // The drawer only exists below the `lg` breakpoint: close it when the window grows past it
  // (rotating a tablet), otherwise its backdrop and focus trap would stay over the desktop layout.
  // The state is set in the media-query callback, never synchronously in the effect.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setDrawerOpen])

  return (
    <div className="app-shell flex h-dvh flex-col bg-canvas text-ink">
      <AppHeader />
      <div className="flex min-h-0 flex-1 lg:px-3 lg:pb-3">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-t border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel">
          <aside aria-label="Рахунки" className="hidden shrink-0 lg:flex">
            <AccountsSidebar />
          </aside>
          {/* The content column scrolls as a whole: the module tabs stay pinned at its top (sticky),
              the verification banner scrolls away, and <main> holds only the page. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <ModuleTabs />
            <VerifyEmailBanner />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>

      <Dialog open={drawerOpen} onOpenChange={(open) => setDrawerOpen(open)}>
        <DialogContent
          data-testid="accounts-drawer"
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh max-h-dvh w-80 max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-r-panel p-0 sm:max-w-[calc(100%-3rem)] lg:hidden"
        >
          <DialogTitle className="sr-only">Рахунки</DialogTitle>
          <AccountsSidebar variant="drawer" onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
