import type { Transaction } from '@/types'

// Journal dates are formatted in lib/utils/journal.ts (UTC, like the grouping below).
export function groupTransactionsByDate(txs: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {}
  const sorted = [...txs].sort((a, b) => b.date.getTime() - a.date.getTime())
  for (const tx of sorted) {
    const key = tx.date.toISOString().split('T')[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(tx)
  }
  return groups
}

export function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}
