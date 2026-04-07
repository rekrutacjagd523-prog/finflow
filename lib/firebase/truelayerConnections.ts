import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export interface TlAccount {
  accountId: string
  displayName: string
  currency: string
  accountType: string
  iban?: string
  balance?: number
}

export interface TlConnection {
  id: string
  orgId: string
  providerName: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
  accounts: TlAccount[]
  lastSyncAt: Date | null
  createdAt: Date
}

function connectionsRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'tlConnections')
}

export function getTlConnections(
  orgId: string,
  callback: (conns: TlConnection[]) => void
): Unsubscribe {
  return onSnapshot(connectionsRef(orgId), (snap) => {
    const conns: TlConnection[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        orgId,
        providerName: data.providerName ?? 'Bank',
        accessToken: data.accessToken ?? '',
        refreshToken: data.refreshToken ?? '',
        tokenExpiresAt: data.tokenExpiresAt?.toDate?.() ?? new Date(),
        accounts: data.accounts ?? [],
        lastSyncAt: data.lastSyncAt?.toDate?.() ?? null,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      }
    })
    callback(conns)
  })
}

export async function createTlConnection(
  orgId: string,
  data: Omit<TlConnection, 'id' | 'orgId' | 'createdAt' | 'lastSyncAt'>
): Promise<string> {
  const ref = await addDoc(connectionsRef(orgId), {
    ...data,
    tokenExpiresAt: Timestamp.fromDate(data.tokenExpiresAt),
    orgId,
    lastSyncAt: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTlConnection(
  orgId: string,
  connectionId: string,
  data: Partial<TlConnection>
): Promise<void> {
  const update: Record<string, unknown> = { ...data }
  if (data.tokenExpiresAt instanceof Date) {
    update.tokenExpiresAt = Timestamp.fromDate(data.tokenExpiresAt)
  }
  if (data.lastSyncAt instanceof Date) {
    update.lastSyncAt = Timestamp.fromDate(data.lastSyncAt)
  }
  await updateDoc(doc(connectionsRef(orgId), connectionId), update)
}

export async function deleteTlConnection(orgId: string, connectionId: string): Promise<void> {
  await deleteDoc(doc(connectionsRef(orgId), connectionId))
}

// ─── API helpers (via Next.js proxy) ─────────────────────────────────────────

export interface TlApiAccount {
  account_id: string
  display_name: string
  currency: string
  account_type: string
  account_number?: { iban?: string }
  provider?: { provider_id?: string; display_name?: string }
}

export interface TlApiTransaction {
  transaction_id: string
  timestamp: string
  description: string
  amount: number
  currency: string
  transaction_type: 'DEBIT' | 'CREDIT'
  transaction_category?: string
  merchant_name?: string
  normalised_provider_transaction_id?: string
}

export async function fetchTlAccounts(
  accessToken: string
): Promise<{ results: TlApiAccount[] }> {
  const res = await fetch(
    `/api/truelayer/data?action=accounts&token=${encodeURIComponent(accessToken)}`
  )
  if (!res.ok) throw new Error('Помилка отримання рахунків')
  return res.json()
}

export async function fetchTlBalance(
  accessToken: string,
  accountId: string
): Promise<{ results: Array<{ current: number; available: number; currency: string }> }> {
  const res = await fetch(
    `/api/truelayer/data?action=balance&token=${encodeURIComponent(accessToken)}&accountId=${accountId}`
  )
  if (!res.ok) throw new Error('Помилка отримання балансу')
  return res.json()
}

export async function fetchTlTransactions(
  accessToken: string,
  accountId: string,
  from?: string
): Promise<{ results: TlApiTransaction[] }> {
  const qs = from ? `&from=${encodeURIComponent(from)}` : ''
  const res = await fetch(
    `/api/truelayer/data?action=transactions&token=${encodeURIComponent(accessToken)}&accountId=${accountId}${qs}`
  )
  if (!res.ok) throw new Error('Помилка отримання транзакцій')
  return res.json()
}

export async function refreshTlToken(
  rToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch('/api/truelayer/data?action=refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rToken }),
  })
  if (!res.ok) throw new Error('Помилка оновлення токену')
  return res.json()
}
