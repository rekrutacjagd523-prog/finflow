import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
  type Query,
  type CollectionReference,
} from 'firebase/firestore'
import { db } from './firebase'
import { updateAccountBalance } from './accounts'
import type { Transaction } from '@/types'

export interface TransactionFilters {
  accountId?: string
  categoryId?: string
  dateFrom?: Date
  dateTo?: Date
  amountMin?: number
  amountMax?: number
  search?: string
}

function txsRef(orgId: string): CollectionReference {
  return collection(db, 'organizations', orgId, 'transactions')
}

function txRef(orgId: string, txId: string) {
  return doc(db, 'organizations', orgId, 'transactions', txId)
}

function firestoreToTransaction(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    orgId: data.orgId as string,
    accountId: data.accountId as string,
    type: data.type as Transaction['type'],
    amount: data.amount as number,
    currency: data.currency as string,
    categoryId: data.categoryId as string | undefined,
    counterpartyId: data.counterpartyId as string | undefined,
    date: (data.date as Timestamp).toDate(),
    description: data.description as string | undefined,
    isRecurring: (data.isRecurring as boolean) ?? false,
    projectId: data.projectId as string | undefined,
    tags: (data.tags as string[]) ?? [],
    fileUrls: (data.fileUrls as string[]) ?? [],
  }
}

export function getTransactions(
  orgId: string,
  filters: TransactionFilters,
  callback: (txs: Transaction[]) => void
): Unsubscribe {
  let q: Query = query(txsRef(orgId), orderBy('date', 'desc'))

  if (filters.accountId) {
    q = query(q, where('accountId', '==', filters.accountId))
  }
  if (filters.categoryId) {
    q = query(q, where('categoryId', '==', filters.categoryId))
  }
  if (filters.dateFrom) {
    q = query(q, where('date', '>=', Timestamp.fromDate(filters.dateFrom)))
  }
  if (filters.dateTo) {
    q = query(q, where('date', '<=', Timestamp.fromDate(filters.dateTo)))
  }

  return onSnapshot(q, (snap) => {
    let txs: Transaction[] = snap.docs.map((d) =>
      firestoreToTransaction(d.id, d.data() as Record<string, unknown>)
    )

    // Client-side filters (amount, search)
    if (filters.amountMin !== undefined) {
      txs = txs.filter((tx) => tx.amount >= filters.amountMin!)
    }
    if (filters.amountMax !== undefined) {
      txs = txs.filter((tx) => tx.amount <= filters.amountMax!)
    }
    if (filters.search) {
      const s = filters.search.toLowerCase()
      txs = txs.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(s) ||
          tx.counterpartyId?.toLowerCase().includes(s)
      )
    }

    callback(txs)
  })
}

export async function createTransaction(
  orgId: string,
  data: Omit<Transaction, 'id' | 'orgId'>
): Promise<string> {
  const batch = writeBatch(db)

  const newTxRef = doc(txsRef(orgId))
  batch.set(newTxRef, {
    ...data,
    orgId,
    date: Timestamp.fromDate(data.date),
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  // Update account balance(s)
  if (data.type === 'income') {
    await updateAccountBalance(orgId, data.accountId, data.amount)
  } else if (data.type === 'expense') {
    await updateAccountBalance(orgId, data.accountId, -data.amount)
  } else if (data.type === 'transfer' && data.counterpartyId) {
    // counterpartyId used as toAccountId for transfers
    await updateAccountBalance(orgId, data.accountId, -data.amount)
    await updateAccountBalance(orgId, data.counterpartyId, data.amount)
  }

  return newTxRef.id
}

export async function updateTransaction(
  orgId: string,
  txId: string,
  data: Partial<Omit<Transaction, 'id' | 'orgId'>>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() }
  if (data.date) {
    updateData.date = Timestamp.fromDate(data.date)
  }
  await updateDoc(txRef(orgId, txId), updateData)
}

export async function deleteTransaction(
  orgId: string,
  txId: string,
  tx: Transaction
): Promise<void> {
  await deleteDoc(txRef(orgId, txId))

  // Restore balance
  if (tx.type === 'income') {
    await updateAccountBalance(orgId, tx.accountId, -tx.amount)
  } else if (tx.type === 'expense') {
    await updateAccountBalance(orgId, tx.accountId, tx.amount)
  } else if (tx.type === 'transfer' && tx.counterpartyId) {
    await updateAccountBalance(orgId, tx.accountId, tx.amount)
    await updateAccountBalance(orgId, tx.counterpartyId, -tx.amount)
  }
}
