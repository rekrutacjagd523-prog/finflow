'use client'

import type { ReactNode } from 'react'
import { InsufficientRights } from '@/components/shell/InsufficientRights'
import { useShell } from '@/lib/hooks/useShell'
import type { Action } from '@/lib/shell/permissions'

// The shell mounts pages only once access is granted, so `can` is final here. Children are not
// mounted for a role that may not use them (EnableBankingConnect must not call the API for an accountant).
export function RequireAction({ action, children }: { action: Action; children: ReactNode }) {
  const { can } = useShell()
  return can(action) ? <>{children}</> : <InsufficientRights />
}
