'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useOrg } from '@/lib/hooks/useOrg'

export function LandingNavLogin() {
  const { user, loading } = useAuth()
  const { orgId } = useOrg()

  if (loading) return <span className="hidden sm:block text-sm text-[#d1d5db] cursor-wait">Увійти</span>
  if (user && orgId) return (
    <Link href={`/${orgId}/transactions`} className="hidden sm:block text-sm text-[#6b7280] hover:text-[#111111] transition-colors">
      Перейти в акаунт
    </Link>
  )
  return (
    <Link href="/login" className="hidden sm:block text-sm text-[#6b7280] hover:text-[#111111] transition-colors">
      Увійти
    </Link>
  )
}

export function LandingHeroLogin() {
  const { user, loading } = useAuth()
  const { orgId } = useOrg()

  if (loading) return (
    <span className="inline-flex items-center justify-center gap-2 border border-[#e5e7eb] bg-white text-[#9ca3af] rounded-xl font-medium h-12 px-8 text-base cursor-wait">
      Увійти в акаунт
    </span>
  )
  if (user && orgId) return (
    <Link href={`/${orgId}/transactions`} className="inline-flex items-center justify-center gap-2 border border-[#e5e7eb] hover:border-[#d1d5db] bg-white text-[#111111] rounded-xl font-medium h-12 px-8 text-base transition-colors">
      Перейти в акаунт
    </Link>
  )
  return (
    <Link href="/login" className="inline-flex items-center justify-center gap-2 border border-[#e5e7eb] hover:border-[#d1d5db] bg-white text-[#111111] rounded-xl font-medium h-12 px-8 text-base transition-colors">
      Увійти в акаунт
    </Link>
  )
}
