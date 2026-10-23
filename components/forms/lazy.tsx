'use client'

import dynamic from 'next/dynamic'

// The operation and account forms load on first open instead of shipping with every app route
// (the shell and the journal render them only while they are open). Client only: they are
// dialogs that never render on the server.
export const LazyTransactionForm = dynamic(
  () => import('@/components/forms/TransactionForm').then((m) => m.TransactionForm),
  { ssr: false },
)

export const LazyAccountForm = dynamic(
  () => import('@/components/forms/AccountForm').then((m) => m.AccountForm),
  { ssr: false },
)
