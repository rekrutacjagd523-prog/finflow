import type { ReactNode } from 'react'
import { AnalyticsNav } from '@/components/shell/AnalyticsNav'
import { PAGE_CONTAINER } from '@/lib/ui/layout'
import { cn } from '@/lib/utils'

// The shell provides <main> and the scroll container; this adds the shared content container and
// the reports' pill sub-navigation on top of every analytics page.
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(PAGE_CONTAINER, 'space-y-6 pt-2 lg:pt-2')}>
      <AnalyticsNav />
      {children}
    </div>
  )
}
