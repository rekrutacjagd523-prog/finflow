import type { ReactNode } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { ShellProvider } from '@/lib/hooks/useShell'

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return (
    <ShellProvider orgId={orgSlug}>
      <AppShell>{children}</AppShell>
    </ShellProvider>
  )
}
