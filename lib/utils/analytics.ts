import { Transaction, Account, Category } from '@/types'

export interface MonthlyData {
  month: string       // "Січ 26", "Лют 26"
  monthKey: string    // "2026-01"
  income: number
  expense: number
  balance: number     // running balance
  net: number         // income - expense
}

export interface PLRow {
  categoryId: string
  categoryName: string
  type: 'income' | 'expense'
  months: Record<string, number>  // { "2026-01": 5000, "2026-02": 3200 }
  total: number
}

export interface DayData {
  date: string        // "2026-04-06"
  income: number
  expense: number
  balance: number     // running end-of-day balance
  hasTransactions: boolean
}

export interface BalanceData {
  totalAssets: number
  totalBalance: number
  accounts: Account[]
}

const UA_MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function formatMonthLabel(year: number, month: number): string {
  return `${UA_MONTHS[month]} ${String(year).slice(2)}`
}

export function buildCashFlow(transactions: Transaction[], months: number = 12): MonthlyData[] {
  const now = new Date()
  const result: MonthlyData[] = []

  // Build month list going back `months` from current
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      month: formatMonthLabel(d.getFullYear(), d.getMonth()),
      monthKey: formatMonthKey(d.getFullYear(), d.getMonth()),
      income: 0,
      expense: 0,
      balance: 0,
      net: 0,
    })
  }

  // Aggregate transactions into months
  for (const tx of transactions) {
    const date = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const key = formatMonthKey(date.getFullYear(), date.getMonth())
    const entry = result.find(r => r.monthKey === key)
    if (!entry) continue
    if (tx.type === 'income') entry.income += tx.amount
    else if (tx.type === 'expense') entry.expense += tx.amount
  }

  // Calculate net and running balance
  let runningBalance = 0
  for (const entry of result) {
    entry.net = entry.income - entry.expense
    runningBalance += entry.net
    entry.balance = runningBalance
  }

  return result
}

export function buildPL(
  transactions: Transaction[],
  categories: Category[],
  months: number = 6
): PLRow[] {
  const now = new Date()
  const monthKeys: string[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(formatMonthKey(d.getFullYear(), d.getMonth()))
  }

  const rowMap = new Map<string, PLRow>()

  // Initialize rows for all categories
  for (const cat of categories) {
    const months: Record<string, number> = {}
    for (const key of monthKeys) months[key] = 0
    rowMap.set(cat.id, {
      categoryId: cat.id,
      categoryName: cat.name,
      type: cat.type,
      months,
      total: 0,
    })
  }

  // Uncategorized buckets
  const uncatIncome: PLRow = {
    categoryId: '__uncategorized_income',
    categoryName: 'Без категорії',
    type: 'income',
    months: Object.fromEntries(monthKeys.map(k => [k, 0])),
    total: 0,
  }
  const uncatExpense: PLRow = {
    categoryId: '__uncategorized_expense',
    categoryName: 'Без категорії',
    type: 'expense',
    months: Object.fromEntries(monthKeys.map(k => [k, 0])),
    total: 0,
  }

  // Aggregate
  for (const tx of transactions) {
    if (tx.type === 'transfer') continue
    const date = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const key = formatMonthKey(date.getFullYear(), date.getMonth())
    if (!monthKeys.includes(key)) continue

    if (tx.categoryId && rowMap.has(tx.categoryId)) {
      const row = rowMap.get(tx.categoryId)!
      row.months[key] = (row.months[key] || 0) + tx.amount
      row.total += tx.amount
    } else {
      const bucket = tx.type === 'income' ? uncatIncome : uncatExpense
      bucket.months[key] = (bucket.months[key] || 0) + tx.amount
      bucket.total += tx.amount
    }
  }

  const rows = Array.from(rowMap.values()).filter(r => r.total > 0)

  // Add uncategorized if has data
  if (uncatIncome.total > 0) rows.push(uncatIncome)
  if (uncatExpense.total > 0) rows.push(uncatExpense)

  return rows
}

export function buildCalendar(
  transactions: Transaction[],
  year: number,
  month: number
): DayData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const result: DayData[] = []

  // Get running balance up to start of month
  let startingBalance = 0
  for (const tx of transactions) {
    const date = tx.date instanceof Date ? tx.date : new Date(tx.date)
    if (date.getFullYear() < year || (date.getFullYear() === year && date.getMonth() < month)) {
      if (tx.type === 'income') startingBalance += tx.amount
      else if (tx.type === 'expense') startingBalance -= tx.amount
    }
  }

  let runningBalance = startingBalance

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    let income = 0
    let expense = 0

    for (const tx of transactions) {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date)
      const txDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      if (txDateStr === dateStr) {
        if (tx.type === 'income') income += tx.amount
        else if (tx.type === 'expense') expense += tx.amount
      }
    }

    runningBalance += income - expense

    result.push({
      date: dateStr,
      income,
      expense,
      balance: runningBalance,
      hasTransactions: income > 0 || expense > 0,
    })
  }

  return result
}

export function buildBalance(accounts: Account[]): BalanceData {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  return {
    totalAssets: totalBalance,
    totalBalance,
    accounts,
  }
}
