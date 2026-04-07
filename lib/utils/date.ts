import type { Transaction } from '@/types'

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

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
