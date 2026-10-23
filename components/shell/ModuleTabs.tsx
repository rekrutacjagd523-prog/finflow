'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShell } from '@/lib/hooks/useShell'
import { MODULE_TABS, activeModule } from '@/lib/shell/modules'
import { cn } from '@/lib/utils'

// Navigation links styled as underlined tabs: Tab moves between them, Enter follows a link.
export function ModuleTabs() {
  const { orgId } = useShell()
  const pathname = usePathname()
  const active = activeModule(pathname, orgId)

  return (
    <nav aria-label="Модулі" className="flex shrink-0 gap-6 overflow-x-auto border-b border-line px-4 lg:px-6">
      {MODULE_TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href(orgId)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              isActive ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
