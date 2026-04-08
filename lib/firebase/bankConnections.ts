import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export interface BankConnection {
  id: string
  sessionId: string
  institutionName: string
  connectedAt: string
}

function connectionsRef(orgId: string) {
  return collection(db, 'organizations', orgId, 'bankConnections')
}

export function getBankConnections(
  orgId: string,
  callback: (connections: BankConnection[]) => void
): Unsubscribe {
  return onSnapshot(connectionsRef(orgId), (snap) => {
    const connections: BankConnection[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BankConnection, 'id'>),
    }))
    callback(connections)
  })
}

export async function saveBankConnection(
  orgId: string,
  connection: Omit<BankConnection, 'id'>
): Promise<void> {
  // Use sessionId as doc id to prevent duplicates
  const ref = doc(connectionsRef(orgId), connection.sessionId)
  await setDoc(ref, { ...connection, updatedAt: serverTimestamp() })
}

export async function deleteBankConnection(
  orgId: string,
  sessionId: string
): Promise<void> {
  await deleteDoc(doc(connectionsRef(orgId), sessionId))
}
