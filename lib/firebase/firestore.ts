import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { userOrganizationsQuery } from './queries'
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

// firestore.rules deny `get` both for orgs the user is not a member of and for
// org ids that do not exist (resource == null), so permission-denied means
// "no such org for this user", exactly like a missing document.
// The code is checked structurally: `instanceof FirestoreError` is not reliable
// when the SDK is loaded more than once (e.g. under Vitest).
function isPermissionDenied(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'permission-denied'
}

async function getOrganizationSnapshot(orgId: string) {
  try {
    return await getDoc(doc(db, 'organizations', orgId))
  } catch (e) {
    if (isPermissionDenied(e)) return null
    throw e
  }
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const orgDoc = await getOrganizationSnapshot(orgId)

  if (!orgDoc || !orgDoc.exists()) return null

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
  const snapshot = await getDocs(userOrganizationsQuery(db, userId))

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
