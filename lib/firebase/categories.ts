import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Category } from '@/types'

function categoriesRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'categories')
}

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Продажі', color: '#22c55e' },
  { name: 'Послуги', color: '#16a34a' },
  { name: 'Інвестиції', color: '#4ade80' },
  { name: 'Інше (дохід)', color: '#86efac' },
]

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Зарплата', color: '#ef4444' },
  { name: 'Оренда', color: '#dc2626' },
  { name: 'Маркетинг', color: '#f87171' },
  { name: 'Комунальні', color: '#fca5a5' },
  { name: 'Обладнання', color: '#fb923c' },
  { name: 'Податки', color: '#f97316' },
  { name: 'Інше (витрата)', color: '#fdba74' },
]

export async function seedDefaultCategories(orgId: string): Promise<void> {
  const snap = await getDocs(categoriesRef(orgId))
  if (!snap.empty) return

  const all = [
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c, type: 'income' as const })),
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'expense' as const })),
  ]

  await Promise.all(
    all.map((cat) =>
      addDoc(categoriesRef(orgId), {
        ...cat,
        orgId,
        createdAt: serverTimestamp(),
      })
    )
  )
}

export function getCategories(
  orgId: string,
  callback: (categories: Category[]) => void
): Unsubscribe {
  return onSnapshot(categoriesRef(orgId), (snap) => {
    const categories: Category[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Category, 'id'>),
    }))
    callback(categories)
  })
}

export async function createCategory(
  orgId: string,
  data: Omit<Category, 'id' | 'orgId'>
): Promise<string> {
  const ref = await addDoc(categoriesRef(orgId), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
