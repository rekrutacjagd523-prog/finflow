import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Organization } from '@/types'

export async function createOrganization(
  userId: string,
  name: string,
  currency: string = 'UAH'
): Promise<string> {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const orgData = {
    name,
    currency,
    ownerId: userId,
    plan: 'trial' as const,
    trialEndsAt: Timestamp.fromDate(trialEndsAt),
    createdAt: Timestamp.fromDate(new Date()),
    members: {
      [userId]: { role: 'owner' },
    },
  }

  const orgRef = await addDoc(collection(db, 'organizations'), orgData)
  return orgRef.id
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const orgDoc = await getDoc(doc(db, 'organizations', orgId))

  if (!orgDoc.exists()) return null

  const data = orgDoc.data()
  return {
    id: orgDoc.id,
    name: data.name,
    currency: data.currency,
    ownerId: data.ownerId,
    plan: data.plan,
    trialEndsAt: (data.trialEndsAt as Timestamp).toDate(),
    createdAt: (data.createdAt as Timestamp).toDate(),
  }
}

export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const q = query(
    collection(db, 'organizations'),
    where(`members.${userId}.role`, '!=', null)
  )

  const snapshot = await getDocs(q)

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      name: data.name,
      currency: data.currency,
      ownerId: data.ownerId,
      plan: data.plan,
      trialEndsAt: (data.trialEndsAt as Timestamp).toDate(),
      createdAt: (data.createdAt as Timestamp).toDate(),
    }
  })
}
