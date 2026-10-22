import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { userOrganizationsQuery } from '@/lib/firebase/queries'

const PROJECT_ID = 'demo-finflow'
// FIRESTORE_RULES_FILE lets the plan's "red" check run this suite against a
// deliberately open ruleset; normally the repo's firestore.rules is used.
const RULES_FILE = process.env.FIRESTORE_RULES_FILE ?? resolve(process.cwd(), 'firestore.rules')
const SUBCOLLECTIONS = ['accounts', 'categories', 'transactions', 'bankConnections'] as const

let testEnv: RulesTestEnvironment

// RulesTestContext.firestore() is typed as the compat SDK; the modular API
// accepts that instance at runtime, so narrow the type once here.
function fs(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore
}
const anon = () => fs(testEnv.unauthenticatedContext())
const alice = () => fs(testEnv.authenticatedContext('alice'))

// Same shape as lib/firebase/firestore.ts#createOrganization.
function newOrg(uid: string, overrides: Record<string, unknown> = {}) {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  return {
    name: `${uid} org`,
    currency: 'UAH',
    ownerId: uid,
    plan: 'trial',
    trialEndsAt: Timestamp.fromDate(trialEndsAt),
    createdAt: Timestamp.fromDate(new Date()),
    members: { [uid]: { role: 'owner' } },
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_FILE, 'utf8') },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

// Fixture: alice owns orgA, bob owns orgB; each org has one doc per subcollection.
beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = fs(ctx)
    await setDoc(doc(db, 'organizations/orgA'), newOrg('alice'))
    await setDoc(doc(db, 'organizations/orgB'), newOrg('bob'))
    for (const orgId of ['orgA', 'orgB']) {
      for (const sub of SUBCOLLECTIONS) {
        await setDoc(doc(db, `organizations/${orgId}/${sub}/seed`), { orgId, name: 'seed' })
      }
    }
    await setDoc(doc(db, '_meta/health'), { ok: true })
  })
})

describe('anonymous user', () => {
  it('cannot get an organization', async () => {
    await assertFails(getDoc(doc(anon(), 'organizations/orgA')))
  })

  it('cannot list organizations, filtered or not', async () => {
    await assertFails(getDocs(collection(anon(), 'organizations')))
    await assertFails(getDocs(userOrganizationsQuery(anon(), 'alice')))
  })

  it('cannot create, update or delete an organization', async () => {
    await assertFails(setDoc(doc(anon(), 'organizations/new'), newOrg('alice')))
    await assertFails(updateDoc(doc(anon(), 'organizations/orgA'), { name: 'x' }))
    await assertFails(deleteDoc(doc(anon(), 'organizations/orgA')))
  })

  it.each(SUBCOLLECTIONS)('cannot read or write %s', async (sub) => {
    await assertFails(getDoc(doc(anon(), `organizations/orgA/${sub}/seed`)))
    await assertFails(getDocs(collection(anon(), `organizations/orgA/${sub}`)))
    await assertFails(setDoc(doc(anon(), `organizations/orgA/${sub}/new`), { orgId: 'orgA' }))
    await assertFails(updateDoc(doc(anon(), `organizations/orgA/${sub}/seed`), { name: 'x' }))
    await assertFails(deleteDoc(doc(anon(), `organizations/orgA/${sub}/seed`)))
  })

  it('cannot read or write _meta', async () => {
    await assertFails(getDoc(doc(anon(), '_meta/health')))
    await assertFails(setDoc(doc(anon(), '_meta/health'), { ok: false }))
  })
})

describe('user A (alice) against org B (owned by bob)', () => {
  it('cannot get org B', async () => {
    await assertFails(getDoc(doc(alice(), 'organizations/orgB')))
  })

  it('cannot list organizations unfiltered or filtered on another uid', async () => {
    await assertFails(getDocs(collection(alice(), 'organizations')))
    await assertFails(getDocs(userOrganizationsQuery(alice(), 'bob')))
  })

  it('cannot update or delete org B', async () => {
    await assertFails(updateDoc(doc(alice(), 'organizations/orgB'), { name: 'pwned' }))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgB'), { 'members.alice': { role: 'owner' } }))
    await assertFails(deleteDoc(doc(alice(), 'organizations/orgB')))
  })

  it.each(SUBCOLLECTIONS)('cannot read or write org B %s', async (sub) => {
    await assertFails(getDoc(doc(alice(), `organizations/orgB/${sub}/seed`)))
    await assertFails(getDocs(collection(alice(), `organizations/orgB/${sub}`)))
    await assertFails(addDoc(collection(alice(), `organizations/orgB/${sub}`), { orgId: 'orgB' }))
    await assertFails(updateDoc(doc(alice(), `organizations/orgB/${sub}/seed`), { name: 'x' }))
    await assertFails(deleteDoc(doc(alice(), `organizations/orgB/${sub}/seed`)))
  })
})

describe('organization create', () => {
  it('allows the exact document createOrganization writes', async () => {
    await assertSucceeds(addDoc(collection(alice(), 'organizations'), newOrg('alice')))
  })

  it('rejects a foreign ownerId', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { ownerId: 'bob' })))
  })

  it('rejects extra members', async () => {
    const members = { alice: { role: 'owner' }, bob: { role: 'owner' } }
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { members })))
  })

  it('rejects a members map without the creator as owner', async () => {
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { members: { bob: { role: 'owner' } } })),
    )
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { members: { alice: { role: 'admin' } } })),
    )
  })

  it('rejects a non-trial plan', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { plan: 'pro' })))
  })

  it('rejects a trial longer than 15 days', async () => {
    const trialEndsAt = Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { trialEndsAt })))
  })

  it('rejects unknown top-level fields', async () => {
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { stripeCustomerId: 'cus_x' })),
    )
  })
})

describe('organization read, update and delete by its member', () => {
  it('member can get own org', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'organizations/orgA')))
  })

  it('member can list own orgs with the client query and sees only them', async () => {
    const snap = await assertSucceeds(getDocs(userOrganizationsQuery(alice(), 'alice')))
    expect(snap.docs.map((d) => d.id)).toEqual(['orgA'])
  })

  it('member can change name and currency (settings page)', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'organizations/orgA'), { name: 'Renamed', currency: 'PLN' }))
  })

  it('member cannot change members', async () => {
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { 'members.bob': { role: 'owner' } }))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { members: { alice: { role: 'admin' } } }))
  })

  it('member cannot change plan, trialEndsAt or ownerId', async () => {
    const later = Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { plan: 'pro' }))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { trialEndsAt: later }))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { ownerId: 'bob' }))
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), { name: 'ok', plan: 'pro' }))
  })

  it('member cannot delete own org', async () => {
    await assertFails(deleteDoc(doc(alice(), 'organizations/orgA')))
  })
})

describe('owner subcollections', () => {
  it.each(SUBCOLLECTIONS)('owner can create, get, list, update and delete %s', async (sub) => {
    const db = alice()
    const ref = doc(db, `organizations/orgA/${sub}/item1`)
    await assertSucceeds(setDoc(ref, { orgId: 'orgA', name: 'item' }))
    await assertSucceeds(addDoc(collection(db, `organizations/orgA/${sub}`), { orgId: 'orgA', name: 'auto-id' }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(getDocs(collection(db, `organizations/orgA/${sub}`)))
    await assertSucceeds(updateDoc(ref, { name: 'changed' }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('owner can run the transactions journal query with combined filters', async () => {
    const q = query(
      collection(alice(), 'organizations/orgA/transactions'),
      orderBy('date', 'desc'),
      where('accountId', '==', 'acc1'),
      where('categoryId', '==', 'cat1'),
      where('date', '>=', Timestamp.fromDate(new Date('2026-01-01'))),
    )
    await assertSucceeds(getDocs(q))
  })

  it('owner cannot use subcollections outside the allow-list or nested deeper', async () => {
    await assertFails(setDoc(doc(alice(), 'organizations/orgA/secrets/x'), { a: 1 }))
    await assertFails(getDoc(doc(alice(), 'organizations/orgA/secrets/x')))
    await assertFails(setDoc(doc(alice(), 'organizations/orgA/accounts/seed/history/h1'), { a: 1 }))
  })
})

describe('server-only and unknown paths', () => {
  it('signed-in user cannot read or write _meta', async () => {
    await assertFails(getDoc(doc(alice(), '_meta/health')))
    await assertFails(setDoc(doc(alice(), '_meta/health'), { ok: false }))
  })

  it('everything else is denied by default', async () => {
    await assertFails(getDoc(doc(alice(), 'users/alice')))
    await assertFails(setDoc(doc(alice(), 'users/alice'), { a: 1 }))
    await assertFails(getDocs(collection(alice(), 'anything')))
  })
})
