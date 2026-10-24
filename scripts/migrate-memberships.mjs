#!/usr/bin/env node
// One-off migration (S02): legacy `organizations/{id}.members` map -> membership documents
// `organizations/{id}/members/{uid}` = { uid, role, createdAt, addedBy }.
//
//   node scripts/migrate-memberships.mjs                       dry run: prints counts and org ids, writes nothing
//   node scripts/migrate-memberships.mjs --apply               creates the missing membership documents (idempotent)
//   node scripts/migrate-memberships.mjs --drop-members-map    removes the legacy `members` field, only after every
//                                                              membership document is verified (run AFTER the
//                                                              rollout, see the S02 spec)
//
// Membership documents are created with create(), never set(): an existing membership document is never overwritten
// (a role that differs from the legacy map is reported as a conflict and left untouched).
//
// Production guards (a run WITHOUT FIRESTORE_EMULATOR_HOST targets production; the emulator is never restricted):
//   dry run                    needs no flag.
//   --apply                    needs --project=finflow-e94b5, otherwise it refuses with exit code 2.
//   --drop-members-map         needs --project=finflow-e94b5 AND --rules-deployed (your statement that the S02 app is
//                              deployed and the new firestore.rules are live: with the old rules or the old app the
//                              dropped field would lock every member out); otherwise exit code 2.
//                              It also refuses (exit code 1, org and uid listed) while the plan skips members with
//                              reason invalid_role or invalid_uid, because the drop would erase the only record of them;
//                              --allow-skipped accepts that.
//   The flag check runs before credentials are read or anything is contacted.
//
// Credentials (never printed): GOOGLE_APPLICATION_CREDENTIALS, else the service-account JSON in .secrets/
// (finflow-*-firebase-adminsdk-*.json). Nothing from document contents is printed, only counters and ids.
//
// Emulator: when FIRESTORE_EMULATOR_HOST is set (for example inside `firebase emulators:exec`), the script targets
// project `demo-finflow` on that emulator and uses no credentials, so it can never reach production.
import fs from 'node:fs'
import path from 'node:path'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { assertDropSkippedAllowed, assertProductionFlags } from './lib/migration-guard.mjs'
import { planMemberships } from './lib/plan-memberships.mjs'

const PROJECT_ID = 'finflow-e94b5'
const EMULATOR_PROJECT_ID = 'demo-finflow'
const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const DROP = args.has('--drop-members-map')
const CHUNK = 400

if (APPLY && DROP) {
  console.error('Use --apply and --drop-members-map in separate runs.')
  process.exit(2)
}

// Before credentials are read or anything is contacted.
const flagCheck = assertProductionFlags({ emulator: !!process.env.FIRESTORE_EMULATOR_HOST, apply: APPLY, drop: DROP, args })
if (!flagCheck.ok) {
  console.error(flagCheck.message)
  process.exit(flagCheck.exitCode)
}

function credential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault()
  const dir = path.resolve('.secrets')
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^finflow-.*-firebase-adminsdk-.*\.json$/.test(f)) : undefined
  if (!file) {
    console.error('No credentials: set GOOGLE_APPLICATION_CREDENTIALS or put the service-account JSON in .secrets/.')
    process.exit(2)
  }
  return cert(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')))
}

if (process.env.FIRESTORE_EMULATOR_HOST) {
  // The Admin SDK routes every Firestore call to the emulator when this variable is set; no credentials are needed
  // and none are read, so a mistaken run cannot touch production.
  initializeApp({ projectId: EMULATOR_PROJECT_ID })
  console.log(`target: Firestore EMULATOR (project ${EMULATOR_PROJECT_ID})`)
} else {
  initializeApp({ credential: credential(), projectId: PROJECT_ID })
  console.log(`target: PRODUCTION (project ${PROJECT_ID})`)
}
const db = getFirestore()

const orgSnap = await db.collection('organizations').get()
const orgDocs = orgSnap.docs.map((d) => ({ id: d.id, data: d.data() }))
const plan = planMemberships(orgDocs)

const existing = new Map() // `${orgId}/${uid}` -> role | null
for (let i = 0; i < plan.writes.length; i += CHUNK) {
  const refs = plan.writes.slice(i, i + CHUNK).map((w) => db.doc(`organizations/${w.orgId}/members/${w.uid}`))
  const snaps = await db.getAll(...refs)
  snaps.forEach((s, j) => {
    const w = plan.writes[i + j]
    existing.set(`${w.orgId}/${w.uid}`, s.exists ? (s.data().role ?? null) : undefined)
  })
}
const toCreate = plan.writes.filter((w) => existing.get(`${w.orgId}/${w.uid}`) === undefined)
const alreadyThere = plan.writes.filter((w) => existing.get(`${w.orgId}/${w.uid}`) === w.role)
const conflicts = plan.writes.filter((w) => {
  const e = existing.get(`${w.orgId}/${w.uid}`)
  return e !== undefined && e !== w.role
})

console.log(`organizations: ${orgDocs.length}`)
console.log(`membership documents implied by legacy maps: ${plan.writes.length}`)
console.log(`  to create: ${toCreate.length}, already present: ${alreadyThere.length}, role conflicts (left untouched): ${conflicts.length}`)
console.log(`skipped: ${plan.skipped.length}`)
for (const s of plan.skipped) console.log(`  skipped org=${s.orgId} uid=${s.uid ?? '-'} reason=${s.reason}`)
for (const c of conflicts) console.log(`  conflict org=${c.orgId} uid=${c.uid}`)

if (DROP) {
  // Safety: members that could not become membership documents would lose their only record.
  const skippedCheck = assertDropSkippedAllowed({ args, skipped: plan.skipped })
  if (!skippedCheck.ok) {
    console.error(skippedCheck.message)
    for (const s of skippedCheck.ids) console.error(`  org=${s.orgId} uid=${s.uid ?? '-'} reason=${s.reason}`)
    process.exit(skippedCheck.exitCode)
  }
  // Safety: refuse unless every membership implied by a legacy map exists with the planned role.
  const missing = plan.writes.filter((w) => existing.get(`${w.orgId}/${w.uid}`) !== w.role)
  if (missing.length > 0) {
    console.error(`REFUSED: ${missing.length} membership document(s) are missing or differ; run --apply first and verify.`)
    for (const m of missing) console.error(`  org=${m.orgId} uid=${m.uid}`)
    process.exit(1)
  }
  const withMap = orgDocs.filter((o) => Object.hasOwn(o.data, 'members'))
  for (let i = 0; i < withMap.length; i += CHUNK) {
    const batch = db.batch()
    for (const o of withMap.slice(i, i + CHUNK)) batch.update(db.doc(`organizations/${o.id}`), { members: FieldValue.delete() })
    await batch.commit()
  }
  console.log(`removed the legacy members field from ${withMap.length} organization(s)`)
  process.exit(0)
}

if (!APPLY) {
  console.log('DRY RUN: nothing written. Re-run with --apply to create the missing membership documents.')
  process.exit(0)
}

const orgById = new Map(orgDocs.map((o) => [o.id, o.data]))
for (let i = 0; i < toCreate.length; i += CHUNK) {
  const batch = db.batch()
  for (const w of toCreate.slice(i, i + CHUNK)) {
    const created = orgById.get(w.orgId)?.createdAt
    batch.create(db.doc(`organizations/${w.orgId}/members/${w.uid}`), {
      uid: w.uid,
      role: w.role,
      createdAt: created && typeof created.toDate === 'function' ? created : FieldValue.serverTimestamp(),
      addedBy: w.addedBy,
    })
  }
  await batch.commit()
}

// Verify by re-reading.
let bad = 0
for (let i = 0; i < plan.writes.length; i += CHUNK) {
  const slice = plan.writes.slice(i, i + CHUNK)
  const snaps = await db.getAll(...slice.map((w) => db.doc(`organizations/${w.orgId}/members/${w.uid}`)))
  snaps.forEach((s, j) => {
    const w = slice[j]
    if (!s.exists || s.data().role !== w.role || s.data().uid !== w.uid) bad++
  })
}
console.log(`created: ${toCreate.length}; verification mismatches: ${bad}`)
process.exit(bad === 0 ? 0 : 1)
