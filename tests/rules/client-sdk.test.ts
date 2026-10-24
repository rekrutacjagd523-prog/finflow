import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, terminate, type Firestore } from 'firebase/firestore'

// Runs the real client modules (lib/firebase/*) against the Firestore emulator
// through the NEXT_PUBLIC_USE_EMULATORS=1 wiring, as a signed-out browser would.
let testEnv: RulesTestEnvironment
let client: typeof import('@/lib/firebase/firestore')
let members: typeof import('@/lib/firebase/members')
let clientDb: Firestore

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-finflow',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  })
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'organizations/orgB'), {
      name: 'B',
      currency: 'UAH',
      ownerId: 'bob',
      plan: 'trial',
    })
  })
  vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', '1')
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-finflow')
  client = await import('@/lib/firebase/firestore')
  members = await import('@/lib/firebase/members')
  clientDb = (await import('@/lib/firebase/firebase')).db
})

afterAll(async () => {
  if (clientDb) await terminate(clientDb)
  vi.unstubAllEnvs()
  await testEnv?.cleanup()
})

describe('client SDK against the emulator (signed out)', () => {
  it('reaches the emulator: the memberships query is rejected for a signed-out caller', async () => {
    await expect(members.getMemberships('bob')).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('getOrganization returns null for an org the caller may not read', async () => {
    await expect(client.getOrganization('orgB')).resolves.toBeNull()
  })

  it('getOrganization returns null for an org id that does not exist', async () => {
    await expect(client.getOrganization('missing-org')).resolves.toBeNull()
  })
})
