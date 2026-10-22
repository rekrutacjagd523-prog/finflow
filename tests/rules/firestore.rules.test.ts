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
  collectionGroup,
  deleteDoc,
  deleteField,
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
// A signed-in user whose ID token carries the given Firebase sign-in provider.
const asProvider = (uid: string, signInProvider: string) =>
  fs(
    testEnv.authenticatedContext(uid, {
      // The SDK types sign_in_provider as a closed union; cast to keep the helper generic.
      firebase: { sign_in_provider: signInProvider as 'anonymous', identities: {} },
    }),
  )

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

  it('rejects an anonymous Firebase user', async () => {
    await assertFails(addDoc(collection(asProvider('alice', 'anonymous'), 'organizations'), newOrg('alice')))
  })

  it.each(['password', 'google.com'])('allows a %s user', async (provider) => {
    await assertSucceeds(addDoc(collection(asProvider('alice', provider), 'organizations'), newOrg('alice')))
  })

  it('rejects a 900 KB name', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { name: 'x'.repeat(900_000) })))
  })

  it('rejects an empty or non-string name', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { name: '' })))
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { name: { a: 1 } })))
  })

  it('rejects a non-string or wrong-length currency', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { currency: 980 })))
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { currency: 'UAHX' })))
  })

  it('rejects a createdAt that is not a timestamp or is far from now', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { createdAt: '2026-01-01' })))
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { createdAt: Timestamp.fromDate(new Date('2100-01-01')) })),
    )
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { createdAt: Timestamp.fromDate(new Date('2000-01-01')) })),
    )
  })

  it('allows trialEndsAt at +15 days and rejects +15 days and 2 hours', async () => {
    const DAY = 24 * 60 * 60 * 1000
    await assertSucceeds(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { trialEndsAt: Timestamp.fromMillis(Date.now() + 15 * DAY) })),
    )
    await assertFails(
      addDoc(
        collection(alice(), 'organizations'),
        newOrg('alice', { trialEndsAt: Timestamp.fromMillis(Date.now() + 15 * DAY + 2 * 60 * 60 * 1000) }),
      ),
    )
  })

  it('rejects an empty members map and a role map with extra keys', async () => {
    await assertFails(addDoc(collection(alice(), 'organizations'), newOrg('alice', { members: {} })))
    await assertFails(
      addDoc(collection(alice(), 'organizations'), newOrg('alice', { members: { alice: { role: 'owner', extra: 1 } } })),
    )
  })

  it('cannot take over an existing foreign org id, with or without merge', async () => {
    await assertFails(setDoc(doc(alice(), 'organizations/orgB'), newOrg('alice')))
    await assertFails(setDoc(doc(alice(), 'organizations/orgB'), newOrg('alice'), { merge: true }))
    await assertFails(setDoc(doc(alice(), 'organizations/orgB'), { members: { alice: { role: 'owner' } } }, { merge: true }))
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

  it.each([
    ['stripeCustomerId', { stripeCustomerId: 'x' }],
    ['createdAt', { createdAt: 'x' }],
    ['name plus createdAt', { name: 'ok', createdAt: 'x' }],
    ['deleting currency', { currency: deleteField() }],
    ['a 5000 character name', { name: 'x'.repeat(5000) }],
    ['an empty name', { name: '' }],
    ['a non-string name', { name: 123 }],
    ['a 4 letter currency', { currency: 'EURO' }],
    ['a nested members role', { 'members.alice.role': 'admin' }],
    ['removing own membership', { 'members.alice': deleteField() }],
    ['deleting members', { members: deleteField() }],
    ['deleting plan', { plan: deleteField() }],
  ])('member cannot update org with %s', async (_label, data) => {
    await assertFails(updateDoc(doc(alice(), 'organizations/orgA'), data))
  })

  it('member cannot add a member through a merge set', async () => {
    await assertFails(
      setDoc(doc(alice(), 'organizations/orgA'), { members: { bob: { role: 'owner' } } }, { merge: true }),
    )
  })

  it('member can update name and currency together', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'organizations/orgA'), { name: 'New', currency: 'EUR' }))
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

  it.each(['accounts', 'categories', 'transactions'] as const)('%s: orgId must match the path org', async (sub) => {
    const db = alice()
    await assertFails(setDoc(doc(db, `organizations/orgA/${sub}/x1`), { orgId: 'orgB', name: 'x' }))
    await assertFails(addDoc(collection(db, `organizations/orgA/${sub}`), { orgId: 'orgB', name: 'x' }))
    await assertFails(updateDoc(doc(db, `organizations/orgA/${sub}/seed`), { orgId: 'orgB' }))
    await assertFails(setDoc(doc(db, `organizations/orgA/${sub}/seed`), { orgId: 'orgB', name: 'x' }))
    // The client always writes orgId = path org; a doc without orgId stays allowed.
    await assertSucceeds(setDoc(doc(db, `organizations/orgA/${sub}/x2`), { orgId: 'orgA', name: 'x' }))
    await assertSucceeds(setDoc(doc(db, `organizations/orgA/${sub}/x3`), { name: 'no orgId' }))
  })

  it('cannot write into a subcollection of a non-existent org', async () => {
    await assertFails(setDoc(doc(alice(), 'organizations/ghost/transactions/t1'), { orgId: 'ghost' }))
    await assertFails(getDocs(collection(alice(), 'organizations/ghost/transactions')))
  })

  it.each(['transactions', 'accounts'] as const)('cannot run a collectionGroup query on %s', async (sub) => {
    await assertFails(getDocs(collectionGroup(alice(), sub)))
  })

  it('owner cannot use subcollections outside the allow-list or nested deeper', async () => {
    await assertFails(setDoc(doc(alice(), 'organizations/orgA/secrets/x'), { a: 1 }))
    await assertFails(getDoc(doc(alice(), 'organizations/orgA/secrets/x')))
    await assertFails(setDoc(doc(alice(), 'organizations/orgA/accounts/seed/history/h1'), { a: 1 }))
  })
})

describe('organization list queries', () => {
  it('cannot run a collectionGroup query on organizations', async () => {
    await assertFails(getDocs(collectionGroup(alice(), 'organizations')))
  })

  it('allows the membership filter combined with another where', async () => {
    const q = query(
      collection(alice(), 'organizations'),
      where('members.alice.role', '!=', null),
      where('currency', '==', 'UAH'),
    )
    const snap = await assertSucceeds(getDocs(q))
    expect(snap.docs.map((d) => d.id)).toEqual(['orgA'])
  })

  it('cannot list with orderBy alone', async () => {
    await assertFails(getDocs(query(collection(alice(), 'organizations'), orderBy('name'))))
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
