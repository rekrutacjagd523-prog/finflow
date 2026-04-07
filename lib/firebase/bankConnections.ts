import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export interface BankConnection {
  id: string
  orgId: string
  bank: 'monobank'
  token: string
  clientName: string
  accounts: MonobankAccount[]
  lastSyncAt: Date | null
  createdAt: Date
}

export interface MonobankAccount {
  id: string
  type: string
  currencyCode: number
  balance: number
  creditLimit: number
  maskedPan: string[]
  iban: string
}

export interface MonobankTx {
  id: string
  time: number
  description: string
  mcc: number
  amount: number
  operationAmount: number
  currencyCode: number
  commissionRate: number
  cashbackAmount: number
  balance: number
  comment?: string
  hold: boolean
}

// Map Monobank currency code → string
export function currencyCodeToString(code: number): string {
  const map: Record<number, string> = {
    980: 'UAH',
    978: 'EUR',
    840: 'USD',
    985: 'PLN',
    826: 'GBP',
  }
  return map[code] ?? 'UAH'
}

// Map Monobank account type → human-readable
export function accountTypeLabel(type: string): string {
  const map: Record<string, string> = {
    black: 'Чорна',
    white: 'Біла',
    platinum: 'Platinum',
    iron: 'Iron',
    fop: 'ФОП',
    yellow: 'Жовта',
    eAid: 'єПідтримка',
    iban: 'IBAN',
  }
  return map[type] ?? type
}

function connectionsRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'bankConnections')
}

export function getBankConnections(
  orgId: string,
  callback: (connections: BankConnection[]) => void
): Unsubscribe {
  return onSnapshot(connectionsRef(orgId), (snap) => {
    const connections: BankConnection[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        orgId,
        bank: data.bank,
        token: data.token,
        clientName: data.clientName,
        accounts: data.accounts ?? [],
        lastSyncAt: data.lastSyncAt?.toDate?.() ?? null,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      }
    })
    callback(connections)
  })
}

export async function createBankConnection(
  orgId: string,
  data: Omit<BankConnection, 'id' | 'orgId' | 'createdAt' | 'lastSyncAt'>
): Promise<string> {
  const ref = await addDoc(connectionsRef(orgId), {
    ...data,
    orgId,
    lastSyncAt: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateBankConnection(
  orgId: string,
  connectionId: string,
  data: Partial<BankConnection>
): Promise<void> {
  await updateDoc(doc(connectionsRef(orgId), connectionId), data)
}

export async function deleteBankConnection(orgId: string, connectionId: string): Promise<void> {
  await deleteDoc(doc(connectionsRef(orgId), connectionId))
}

// Fetch client info from Monobank via our proxy
export async function fetchMonobankClient(token: string): Promise<{
  clientId: string
  name: string
  accounts: MonobankAccount[]
}> {
  const res = await fetch(`/api/monobank?action=client&token=${encodeURIComponent(token)}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Помилка підключення до Monobank')
  }
  return res.json()
}

// Fetch transactions for an account from Monobank
export async function fetchMonobankStatement(
  token: string,
  accountId: string,
  fromTimestamp: number,
  toTimestamp?: number
): Promise<MonobankTx[]> {
  const params = new URLSearchParams({
    action: 'statement',
    token,
    account: accountId,
    from: fromTimestamp.toString(),
    ...(toTimestamp ? { to: toTimestamp.toString() } : {}),
  })
  const res = await fetch(`/api/monobank?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Помилка отримання виписки')
  }
  return res.json()
}
