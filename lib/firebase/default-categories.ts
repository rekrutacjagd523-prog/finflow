import type { Category } from '@/types'

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Продажі', color: '#22c55e' },
  { name: 'Послуги', color: '#16a34a' },
  { name: 'Інвестиції', color: '#4ade80' },
  { name: 'Інше (дохід)', color: '#86efac' },
]

// Defined but not seeded yet: seedDefaultCategories has only ever created the income defaults,
// and this keeps that behaviour as it is.
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Зарплата', color: '#ef4444' },
  { name: 'Оренда', color: '#dc2626' },
  { name: 'Маркетинг', color: '#f87171' },
  { name: 'Комунальні', color: '#fca5a5' },
  { name: 'Обладнання', color: '#fb923c' },
  { name: 'Податки', color: '#f97316' },
  { name: 'Інше (витрата)', color: '#fdba74' },
]

export type DefaultCategorySeed = Pick<Category, 'name' | 'color' | 'type'> & { id: string }

/**
 * The categories a new organization starts with, each with a deterministic document id.
 * Writing them with setDoc makes seeding idempotent: two concurrent seeds (React StrictMode
 * double effects, two tabs) write the same documents instead of adding duplicates.
 */
export function buildDefaultCategories(): DefaultCategorySeed[] {
  return DEFAULT_INCOME_CATEGORIES.map((c, index) => ({
    ...c,
    id: `default-income-${index + 1}`,
    type: 'income' as const,
  }))
}
