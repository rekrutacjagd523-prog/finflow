import type { Account } from '@/types'

export interface AccountsSummary {
  /** The company currency the total is expressed in. */
  currency: string
  /** Sum of the balances of the accounts in `currency`, rounded to cents. */
  total: number
  /** How many accounts the total includes (accounts in other currencies are left out). */
  count: number
}

/**
 * Sidebar total («Разом у {currency}»): only accounts whose currency equals the company currency.
 * There are no exchange rates before S04, so other currencies are neither converted nor mentioned.
 */
export function summarizeAccounts(
  accounts: ReadonlyArray<Pick<Account, 'balance' | 'currency'>>,
  companyCurrency: string,
): AccountsSummary {
  let total = 0
  let count = 0
  for (const account of accounts) {
    if (account.currency !== companyCurrency) continue
    total += account.balance
    count += 1
  }
  const rounded = Math.round(total * 100) / 100
  // Normalise -0 (e.g. a tiny negative remainder) so the UI never renders "-0,00".
  return { currency: companyCurrency, total: rounded === 0 ? 0 : rounded, count }
}
