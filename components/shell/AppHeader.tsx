'use client'

import Link from 'next/link'
import { ArrowLeftRight, Menu, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { ProfileMenu } from '@/components/shell/ProfileMenu'
import { useShell } from '@/lib/hooks/useShell'

// Header CTAs open the global forms on every page; below 640 px they show icons only (the label
// stays as screen-reader text, so the accessible names never change).
export function AppHeader() {
  const { orgId, openTransactionForm, setDrawerOpen } = useShell()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-3 lg:gap-4 lg:px-5">
      <Button
        variant="ghost"
        size="icon-lg"
        className="lg:hidden"
        aria-label="Відкрити рахунки"
        onClick={() => setDrawerOpen(true)}
      >
        <Menu />
      </Button>
      <Link
        href={`/${orgId}/transactions`}
        className="hidden shrink-0 rounded-control font-display text-base font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-brand lg:block"
      >
        Fin<span className="text-brand">Flow</span>
      </Link>
      {/* A flex container, so the switcher button is a shrinkable flex item and its name truncates. */}
      <div className="flex min-w-0 flex-1 lg:flex-none">
        <OrgSwitcher />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button size="lg" onClick={() => openTransactionForm('income')} className="bg-income text-white hover:bg-income/90">
          <Plus />
          <span className="sr-only sm:not-sr-only">Дохід</span>
        </Button>
        <Button size="lg" onClick={() => openTransactionForm('expense')} className="bg-expense text-white hover:bg-expense/90">
          <Minus />
          <span className="sr-only sm:not-sr-only">Витрата</span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => openTransactionForm('transfer')}
          className="border-line bg-surface text-ink hover:bg-canvas"
        >
          <ArrowLeftRight />
          <span className="sr-only sm:not-sr-only">Переказ</span>
        </Button>
        <ProfileMenu />
      </div>
    </header>
  )
}
