import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Account } from '@/types'

function accountsRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'accounts')
}

function accountRef(orgId: string, accountId: string) {
  return doc(db, 'organizations', orgId, 'accounts', accountId)
}

export function getAccounts(
  orgId: string,
  callback: (accounts: Account[]) => void
): Unsubscribe {
  return onSnapshot(accountsRef(orgId), (snap) => {
    const accounts: Account[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Account, 'id'>),
    }))
    callback(accounts)
  })
}

export async function createAccount(
  orgId: string,
  data: Omit<Account, 'id' | 'orgId'>
): Promise<string> {
  const ref = await addDoc(accountsRef(orgId), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAccount(
  orgId: string,
  accountId: string,
  data: Partial<Omit<Account, 'id' | 'orgId'>>
): Promise<void> {
  await updateDoc(accountRef(orgId, accountId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteAccount(
  orgId: string,
  accountId: string
): Promise<void> {
  await deleteDoc(accountRef(orgId, accountId))
}

export async function updateAccountBalance(
  orgId: string,
  accountId: string,
  delta: number
): Promise<void> {
  await updateDoc(accountRef(orgId, accountId), {
    balance: increment(delta),
    updatedAt: serverTimestamp(),
  })
}
