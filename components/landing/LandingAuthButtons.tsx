'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOrg } from '@/lib/hooks/useOrg'

const secondaryClass =
  'inline-flex items-center justify-center gap-2 border border-black/[0.12] dark:border-white/[0.12] hover:border-black/[0.22] dark:hover:border-white/[0.22] bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-[#0d0d0d]/75 dark:text-white/75 hover:text-[#0d0d0d] dark:hover:text-white rounded-xl font-semibold h-12 px-8 text-[0.9375rem] transition-all duration-200'

export function LandingNavLogin() {
  const { user, loading } = useAuth()
  const { orgId } = useOrg()

  if (loading) return <span className="hidden sm:block text-sm text-black/20 dark:text-white/20 cursor-wait">Увійти</span>
  if (user && orgId) return (
    <Link href={`/${orgId}/transactions`} className="hidden sm:block text-sm text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white transition-colors duration-200">
      Перейти в акаунт
    </Link>
  )
  return (
    <Link href="/login" className="hidden sm:block text-sm text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white transition-colors duration-200">
      Увійти
    </Link>
  )
}

export function LandingHeroLogin() {
  const { user, loading } = useAuth()
  const { orgId } = useOrg()

  if (loading) return (
    <span className={`${secondaryClass} opacity-40 cursor-wait`}>
      Увійти в акаунт
    </span>
  )
  if (user && orgId) return (
    <Link href={`/${orgId}/transactions`} className={secondaryClass}>
      Перейти в акаунт
    </Link>
  )
  return (
    <Link href="/login" className={secondaryClass}>
      Увійти в акаунт
    </Link>
  )
}
