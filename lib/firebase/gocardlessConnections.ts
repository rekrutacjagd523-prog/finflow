import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export interface GcInstitution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

export interface GcAccount {
  id: string          // GoCardless account UUID
  iban: string
  currency: string
  name: string
  product?: string
  balance?: number
}

export interface GcConnection {
  id: string
  orgId: string
  requisitionId: string
  institutionId: string
  institutionName: string
  institutionLogo: string
  accounts: GcAccount[]
  status: 'pending' | 'linked' | 'expired'
  lastSyncAt: Date | null
  createdAt: Date
}

export interface GcTransaction {
  transactionId?: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  remittanceInformationUnstructured?: string
  remittanceInformationStructured?: string
  creditorName?: string
  debtorName?: string
}

function connectionsRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'gcConnections')
}

export function getGcConnections(
  orgId: string,
  callback: (conns: GcConnection[]) => void
): Unsubscribe {
  return onSnapshot(connectionsRef(orgId), (snap) => {
    const conns: GcConnection[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        orgId,
        requisitionId: data.requisitionId,
        institutionId: data.institutionId,
        institutionName: data.institutionName,
        institutionLogo: data.institutionLogo ?? '',
        accounts: data.accounts ?? [],
        status: data.status ?? 'pending',
        lastSyncAt: data.lastSyncAt?.toDate?.() ?? null,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      }
    })
    callback(conns)
  })
}

export async function createGcConnection(
  orgId: string,
  data: Omit<GcConnection, 'id' | 'orgId' | 'createdAt' | 'lastSyncAt'>
): Promise<string> {
  const ref = await addDoc(connectionsRef(orgId), {
    ...data,
    orgId,
    lastSyncAt: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateGcConnection(
  orgId: string,
  connectionId: string,
  data: Partial<GcConnection>
): Promise<void> {
  await updateDoc(doc(connectionsRef(orgId), connectionId), data)
}

export async function deleteGcConnection(orgId: string, connectionId: string): Promise<void> {
  await deleteDoc(doc(connectionsRef(orgId), connectionId))
}

// ─── API helpers (client-side, call our Next.js proxy) ───────────────────────

export async function fetchInstitutions(country: string): Promise<GcInstitution[]> {
  const res = await fetch(`/api/gocardless?action=institutions&country=${country}`)
  if (!res.ok) throw new Error('Не вдалося завантажити банки')
  return res.json()
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<{ id: string; link: string }> {
  const res = await fetch('/api/gocardless?action=requisition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ institutionId, redirectUrl, reference }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Помилка створення з\'єднання')
  }
  return res.json()
}

export async function fetchRequisition(id: string): Promise<{
  id: string
  status: string
  institution_id: string
  accounts: string[]
}> {
  const res = await fetch(`/api/gocardless?action=requisition&id=${id}`)
  if (!res.ok) throw new Error('Помилка отримання статусу')
  return res.json()
}

export async function fetchAccountDetails(id: string): Promise<{
  account: { iban?: string; currency: string; name?: string; product?: string; ownerName?: string }
}> {
  const res = await fetch(`/api/gocardless?action=account-details&id=${id}`)
  if (!res.ok) throw new Error('Помилка отримання рахунку')
  return res.json()
}

export async function fetchAccountBalances(id: string): Promise<{
  balances: Array<{ balanceAmount: { amount: string; currency: string }; balanceType: string }>
}> {
  const res = await fetch(`/api/gocardless?action=balances&id=${id}`)
  if (!res.ok) throw new Error('Помилка балансу')
  return res.json()
}

export async function fetchAccountTransactions(
  id: string,
  dateFrom?: string
): Promise<{ transactions: { booked: GcTransaction[]; pending?: GcTransaction[] } }> {
  const qs = dateFrom ? `&dateFrom=${dateFrom}` : ''
  const res = await fetch(`/api/gocardless?action=transactions&id=${id}${qs}`)
  if (!res.ok) throw new Error('Помилка транзакцій')
  return res.json()
}
