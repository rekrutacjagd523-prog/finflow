'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOrg } from '@/lib/hooks/useOrg'
import { useRouter } from 'next/navigation'

const navItems = (orgSlug: string) => [
  {
    href: `/${orgSlug}/transactions`,
    label: 'Transactions',
    icon: ArrowLeftRight,
  },
  {
    href: `/${orgSlug}/analytics/cashflow`,
    label: 'Analytics',
    icon: BarChart2,
  },
  {
    href: `/${orgSlug}/settings`,
    label: 'Settings',
    icon: Settings,
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()
  const { org } = useOrg()
  const orgSlug = params.orgSlug as string

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-[#111111] flex flex-col border-r border-white/5">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <Link href={`/${orgSlug}/transactions`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-[6px] bg-[#00c896] flex items-center justify-center">
              <span className="text-white font-semibold text-xs">F</span>
            </div>
            <span className="text-white font-semibold text-sm">FinFlow</span>
          </Link>
          {org && (
            <p className="text-white/40 text-xs mt-2 truncate">{org.name}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems(orgSlug).map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="px-3 py-2 mb-1">
            <p className="text-white/70 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm text-white/50 hover:text-white hover:bg-white/5 w-full transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[#f9fafb] overflow-auto">
        {children}
      </main>
    </div>
  )
}
