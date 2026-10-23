'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/hooks/useAuth'
import { useShell } from '@/lib/hooks/useShell'
import { settingsPath } from '@/lib/shell/settings-sections'

export function ProfileMenu() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { orgId } = useShell()
  const initial = (user?.email ?? '?').charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Профіль"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(settingsPath(orgId, 'company'))}>
          <Settings />
          Налаштування
        </DropdownMenuItem>
        {/* The AuthProvider listener performs the hard redirect to /login. */}
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut />
          Вийти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
