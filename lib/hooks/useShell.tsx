'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AccountForm } from '@/components/forms/AccountForm'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { useAccounts } from '@/lib/hooks/useAccounts'
import { useCategories } from '@/lib/hooks/useCategories'
import { useOrg } from '@/lib/hooks/useOrg'
import { browserLocalStorage, createCollapsedStore } from '@/lib/shell/sidebar-store'
import type { Account, Category, Organization, Transaction } from '@/types'

export type TransactionType = Transaction['type']

export interface ShellContextValue {
  /** The org id from the URL (`/[orgSlug]/...`). */
  orgId: string
  /** The loaded organization, only once it is the URL's org (null while loading or switching). */
  org: Organization | null
  accounts: Account[]
  accountsLoading: boolean
  incomeCategories: Category[]
  expenseCategories: Category[]
  categoriesLoading: boolean
  /** The account chosen in the sidebar; the journal shows only its operations. */
  selectedAccountId: string | null
  selectAccount: (accountId: string | null) => void
  openTransactionForm: (type: TransactionType) => void
  /** Without an argument: a new account. With one: edit it. */
  openAccountForm: (account?: Account) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** The phone accounts drawer (below 1024 px). */
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

// Module level: the flag is per browser tab and survives client-side navigation between orgs.
const sidebarStore = createCollapsedStore(browserLocalStorage)

export function ShellProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  const { org: loadedOrg, switchOrg } = useOrg()
  // The only accounts/categories subscription of the shell: pages read these from the context
  // (a second useCategories on a fresh org would seed the default categories twice).
  const { accounts, loading: accountsLoading } = useAccounts(orgId)
  const { incomeCategories, expenseCategories, loading: categoriesLoading } = useCategories(orgId)

  // A selection belongs to one org: it is ignored as soon as the URL points at another one.
  const [selection, setSelection] = useState<{ orgId: string; accountId: string | null }>({
    orgId,
    accountId: null,
  })
  const selectedAccountId = selection.orgId === orgId ? selection.accountId : null

  // The forms mount on open and unmount on close, so every opening starts from fresh form state.
  const [transactionFormType, setTransactionFormType] = useState<TransactionType | null>(null)
  const [accountForm, setAccountForm] = useState<{ account: Account | null } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sidebarCollapsed = useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.getSnapshot,
    sidebarStore.getServerSnapshot,
  )

  // OrgProvider restores the last org from localStorage, which can differ from the URL (a link
  // to another company, a second tab). Load the URL's org once per org id; the ref prevents a
  // loop when the user is not a member (switchOrg then keeps the old org).
  const requestedOrgId = useRef<string | null>(null)
  useEffect(() => {
    if (!loadedOrg || loadedOrg.id === orgId || requestedOrgId.current === orgId) return
    requestedOrgId.current = orgId
    void switchOrg(orgId)
  }, [loadedOrg, orgId, switchOrg])

  const value: ShellContextValue = {
    orgId,
    org: loadedOrg && loadedOrg.id === orgId ? loadedOrg : null,
    accounts,
    accountsLoading,
    incomeCategories,
    expenseCategories,
    categoriesLoading,
    selectedAccountId,
    selectAccount: (accountId) => setSelection({ orgId, accountId }),
    openTransactionForm: (type) => setTransactionFormType(type),
    openAccountForm: (account) => setAccountForm({ account: account ?? null }),
    sidebarCollapsed,
    toggleSidebar: () => sidebarStore.set(!sidebarCollapsed),
    drawerOpen,
    setDrawerOpen,
  }

  return (
    <ShellContext.Provider value={value}>
      {children}
      {transactionFormType && (
        <TransactionForm
          key={transactionFormType}
          orgId={orgId}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          defaultType={transactionFormType}
          open
          onClose={() => setTransactionFormType(null)}
        />
      )}
      {accountForm && (
        <AccountForm
          key={accountForm.account?.id ?? 'new'}
          orgId={orgId}
          account={accountForm.account ?? undefined}
          open
          onClose={() => setAccountForm(null)}
        />
      )}
    </ShellContext.Provider>
  )
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used within ShellProvider')
  return ctx
}
