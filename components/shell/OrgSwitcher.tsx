'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getUserOrganizations } from '@/lib/firebase/firestore'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOrg } from '@/lib/hooks/useOrg'
import { useShell } from '@/lib/hooks/useShell'
import type { Organization } from '@/types'

type OrgList =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; orgs: Organization[] }

// Company switcher. The list is fetched each time the menu opens (from the event handler, not an
// effect). Creating a company is S16.
export function OrgSwitcher() {
  const router = useRouter()
  const { user } = useAuth()
  const { switchOrg } = useOrg()
  const { orgId, org } = useShell()
  const [list, setList] = useState<OrgList>({ status: 'idle' })

  const load = async () => {
    if (!user) return
    setList({ status: 'loading' })
    try {
      setList({ status: 'ready', orgs: await getUserOrganizations(user.uid) })
    } catch {
      setList({ status: 'error' })
    }
  }

  const choose = (id: string) => {
    if (id === orgId) return
    // Navigate first: ShellProvider loads the URL's org as well, so the two never fight.
    router.push(`/${id}/transactions`)
    void switchOrg(id)
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load()
      }}
    >
      <DropdownMenuTrigger
        data-testid="org-switcher"
        className="flex min-w-0 max-w-64 items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand font-display text-sm font-semibold text-white">
          {org ? org.name.charAt(0).toUpperCase() : 'F'}
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-ink-muted">Компанія</span>
          {org ? (
            <span data-testid="org-switcher-name" className="block truncate text-sm font-semibold text-ink">
              {org.name}
            </span>
          ) : (
            <span className="mt-1 block h-3.5 w-24 animate-pulse rounded bg-line" />
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ваші компанії</DropdownMenuLabel>
          {(list.status === 'idle' || list.status === 'loading') && (
            <DropdownMenuItem disabled>Завантаження…</DropdownMenuItem>
          )}
          {list.status === 'error' && <DropdownMenuItem disabled>Не вдалося завантажити компанії</DropdownMenuItem>}
          {list.status === 'ready' &&
            list.orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => choose(o.id)}>
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <span className="text-xs text-ink-muted">{o.currency}</span>
                {o.id === orgId && <Check className="text-brand" aria-label="Поточна компанія" />}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
