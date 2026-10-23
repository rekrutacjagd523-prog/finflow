'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { SETTINGS_SECTIONS, activeSettingsSection, settingsPath } from '@/lib/shell/settings-sections'
import { cn } from '@/lib/utils'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const pathname = usePathname()
  const active = activeSettingsSection(pathname, orgSlug)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 lg:px-6 lg:py-6">
      <h1 className="font-display text-xl font-semibold text-ink">Налаштування</h1>
      <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
        <nav
          aria-label="Розділи налаштувань"
          className="flex gap-1 overflow-x-auto md:w-52 md:shrink-0 md:flex-col"
        >
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = section.slug === active
            return (
              <Link
                key={section.slug}
                href={settingsPath(orgSlug, section.slug)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-control px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                  isActive ? 'bg-brand-soft text-brand-soft-foreground' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                )}
              >
                {section.label}
              </Link>
            )
          })}
        </nav>
        <div className="min-w-0 flex-1 md:max-w-[680px]">{children}</div>
      </div>
    </div>
  )
}
