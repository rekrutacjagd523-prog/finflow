'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOrg } from '@/lib/hooks/useOrg'

const secondaryClass =
  'inline-flex items-center justify-center gap-2 border border-white/[0.12] hover:border-white/[0.22] bg-white/[0.04] hover:bg-white/[0.07] text-white/75 hover:text-white rounded-xl font-semibold h-12 px-8 text-[0.9375rem] transition-all duration-200'

export function LandingNavLogin() {
  const { user, loading } = useAuth()
  const { orgId } = useOrg()

  if (loading) return <span className="hidden sm:block text-sm text-white/20 cursor-wait">Увійти</span>
  if (user && orgId) return (
    <Link href={`/${orgId}/transactions`} className="hidden sm:block text-sm text-white/45 hover:text-white transition-colors duration-200">
      Перейти в акаунт
    </Link>
  )
  return (
    <Link href="/login" className="hidden sm:block text-sm text-white/45 hover:text-white transition-colors duration-200">
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
