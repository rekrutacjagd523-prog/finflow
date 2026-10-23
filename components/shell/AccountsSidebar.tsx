'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteAccount } from '@/lib/firebase/accounts'
import { useShell } from '@/lib/hooks/useShell'
import { isJournalPath } from '@/lib/shell/modules'
import { settingsPath } from '@/lib/shell/settings-sections'
import { cn } from '@/lib/utils'
import { summarizeAccounts } from '@/lib/utils/accounts'
import { formatCurrency, splitCurrency } from '@/lib/utils/currency'
import type { Account } from '@/types'

interface AccountsSidebarProps {
  /** `panel`: the desktop column (collapsible). `drawer`: inside the phone drawer (never collapsed). */
  variant?: 'panel' | 'drawer'
  /** Called after a choice that should close the drawer (account picked, form opened, link followed). */
  onNavigate?: () => void
  /** `drawer` only: shown top right, where the panel has its collapse button (the drawer's close button). */
  headerAction?: ReactNode
}

function rowClass(selected: boolean): string {
  return cn(
    'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-soft-foreground',
    selected ? 'bg-brand-soft font-medium text-ink' : 'text-ink hover:bg-canvas',
  )
}

export function AccountsSidebar({ variant = 'panel', onNavigate, headerAction }: AccountsSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    orgId,
    org,
    accounts,
    accountsLoading,
    selectedAccountId,
    selectAccount,
    openAccountForm,
    sidebarCollapsed,
    toggleSidebar,
  } = useShell()
  const collapsed = variant === 'panel' && sidebarCollapsed
  // Only accounts in the company currency; other currencies are not mentioned before S04.
  // Not before both the org and the accounts are loaded: an empty list would show a false 0,00.
  const summary = org && !accountsLoading ? summarizeAccounts(accounts, org.currency) : null

  const choose = (accountId: string | null) => {
    selectAccount(accountId)
    // The selection filters the journal only, so from any other page a choice leads there.
    if (!isJournalPath(pathname, orgId)) router.push(`/${orgId}/transactions`)
    onNavigate?.()
  }

  const handleAdd = () => {
    onNavigate?.()
    openAccountForm()
  }

  const handleEdit = (account: Account) => {
    onNavigate?.()
    openAccountForm(account)
  }

  const handleDelete = async (account: Account) => {
    if (!confirm(`Видалити рахунок «${account.name}»?`)) return
    if (selectedAccountId === account.id) selectAccount(null)
    try {
      await deleteAccount(orgId, account.id)
    } catch {
      toast.error('Не вдалося видалити рахунок')
    }
  }

  if (collapsed) {
    return (
      <div
        data-testid="accounts-sidebar"
        data-collapsed="true"
        className="flex h-full w-14 flex-col items-center gap-2 border-r border-line py-3"
      >
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label="Розгорнути сайдбар" aria-expanded={false}>
          <ChevronRight />
        </Button>
        <ul aria-label="Рахунки (згорнуто)" className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
          {accounts.map((account) => {
            const selected = selectedAccountId === account.id
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => choose(selected ? null : account.id)}
                  aria-pressed={selected}
                  aria-label={account.name}
                  title={`${account.name}: ${formatCurrency(account.balance, account.currency)}`}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-control transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-soft-foreground',
                    selected && 'bg-brand-soft',
                  )}
                >
                  <span className="size-3 rounded-full" style={{ backgroundColor: account.color }} />
                </button>
              </li>
            )
          })}
        </ul>
        <Button variant="soft" size="icon-sm" onClick={handleAdd} aria-label="Додати рахунок">
          <Plus />
        </Button>
        <Link
          href={settingsPath(orgId, 'banks')}
          aria-label="Підключити банк"
          className="flex size-7 items-center justify-center rounded-control text-brand-soft-foreground hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-soft-foreground"
        >
          <Building2 className="size-4" />
        </Link>
      </div>
    )
  }

  const total = summary ? splitCurrency(summary.total, summary.currency) : null

  return (
    <div
      data-testid="accounts-sidebar"
      data-collapsed="false"
      className={cn('flex h-full flex-col', variant === 'panel' ? 'w-72 border-r border-line' : 'w-full')}
    >
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4">
        <div data-testid="accounts-summary" className="min-w-0">
          {summary && total ? (
            <>
              <p className="text-xs text-ink-muted">Разом у {summary.currency}</p>
              <p
                data-testid="accounts-total"
                className={cn(
                  'mt-1 truncate text-2xl font-bold tracking-tight tabular-nums',
                  summary.total < 0 ? 'text-expense' : 'text-ink',
                )}
              >
                {/* The full amount as one text node for assistive tech (and text queries); the
                    visual copy shows the decimals and the currency smaller and muted. */}
                <span className="sr-only">{formatCurrency(summary.total, summary.currency)}</span>
                <span aria-hidden>
                  {total.whole}
                  <span className="text-base font-semibold text-ink-muted">
                    {total.fraction}
                    {total.rest}
                  </span>
                </span>
              </p>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-line" />
              <div className="h-7 w-36 animate-pulse rounded bg-line" />
            </div>
          )}
        </div>
        {variant === 'panel' ? (
          <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label="Згорнути сайдбар" aria-expanded>
            <ChevronLeft />
          </Button>
        ) : (
          headerAction
        )}
      </div>

      <div className="flex-1 overflow-y-auto border-t border-line px-2 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2 pr-1 pb-1 pl-3">
          <h2 className="text-sm font-semibold text-ink">Мої рахунки</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleAdd}
            aria-label="Додати рахунок"
            className="text-brand-soft-foreground hover:bg-brand-soft hover:text-brand-soft-foreground"
          >
            <Plus />
          </Button>
        </div>

        <button type="button" onClick={() => choose(null)} aria-pressed={selectedAccountId === null} className={rowClass(selectedAccountId === null)}>
          <span className="size-2.5 shrink-0 rounded-full bg-brand" />
          <span className="min-w-0 flex-1 truncate">Усі рахунки</span>
          {!accountsLoading && <span className="text-xs text-ink-muted tabular-nums">{accounts.length}</span>}
        </button>

        {accountsLoading ? (
          <div className="mt-1 space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-control bg-canvas" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">Рахунків ще немає</p>
        ) : (
          <ul aria-label="Список рахунків" className="mt-1 space-y-0.5">
            {accounts.map((account) => {
              const selected = selectedAccountId === account.id
              return (
                <li key={account.id} className="group/row flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => choose(selected ? null : account.id)}
                    aria-pressed={selected}
                    className={cn(rowClass(selected), 'min-w-0 flex-1')}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color }} />
                    <span className="min-w-0 flex-1 truncate">{account.name}</span>
                    <span className={cn('shrink-0 text-xs tabular-nums', account.balance < 0 ? 'text-expense' : 'text-ink-muted')}>
                      {formatCurrency(account.balance, account.currency)}
                    </span>
                  </button>
                  <DropdownMenu>
                    {/* Shown on hover or keyboard focus of the row (and while its menu is open);
                        always shown on touch screens, which have no hover. */}
                    <DropdownMenuTrigger
                      aria-label={`Дії з рахунком ${account.name}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-control text-ink-muted opacity-0 transition-[opacity,color,background-color] group-hover/row:opacity-100 group-focus-within/row:opacity-100 hover:bg-canvas hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-soft-foreground data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleEdit(account)}>
                        <Pencil />
                        Редагувати
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => void handleDelete(account)}>
                        <Trash2 />
                        Видалити
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        )}

        {/* Right under the list (as in Finmap), not pinned to the bottom of the column. */}
        <Link
          href={settingsPath(orgId, 'banks')}
          onClick={onNavigate}
          className="mx-1 mt-3 flex items-center gap-3 rounded-field border border-dashed border-line px-3 py-2.5 transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-soft-foreground"
        >
          <Building2 className="size-4 shrink-0 text-brand-soft-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Підключити банк</span>
            <span className="block text-xs text-ink-muted">Open Banking, бета</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
