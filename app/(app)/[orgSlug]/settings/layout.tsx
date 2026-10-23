import type { ReactNode } from 'react'
import { SettingsMenu } from '@/components/shell/SettingsMenu'

// Only the content: the settings menu is the shell's left column from 1024 px (AppShell) and a
// pill row on top of the content below it.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <SettingsMenu variant="pills" />
      <h1 className="font-display text-xl font-semibold text-ink">Налаштування</h1>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
