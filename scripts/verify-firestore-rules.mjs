// Black-box check of the deployed Firestore rules (S02 membership model) through the
// public REST API, i.e. what anyone holding the public web config can do.
//
// Prints only PASS/FAIL lines with HTTP statuses, never document contents.
// Creates one throwaway Auth user (always deleted at the end). The throwaway user belongs
// to no company, so every check here is a NEGATIVE one (what a stranger must not do) plus
// the one positive check that needs no company: the collection-group membership query
// (which also proves that the `members.uid` index and the S02 rules are deployed).
// Clients cannot create organizations or memberships by design; if one unexpectedly gets
// through, it is counted as a failure and printed as LEFTOVER=<path>; remove it with:
//   firebase firestore:delete "<path>" -r --force --project <projectId>
//
// The POSITIVE paths (the owner's real company opens, the role-aware UI, a foreign URL shows
// "Немає доступу", the company limit) are checked MANUALLY on production with the owner's
// real company; this script does not cover them.
//
// Environment:
//   FIREBASE_API_KEY     required, public web API key
//   FIREBASE_PROJECT_ID  default "finflow-e94b5"
//   FIRESTORE_ORIGIN     default "https://firestore.googleapis.com"
//                        emulator: "http://127.0.0.1:8080"
//   AUTH_ORIGIN          default "https://identitytoolkit.googleapis.com"
//                        emulator: "http://127.0.0.1:9099/identitytoolkit.googleapis.com"

const apiKey = process.env.FIREBASE_API_KEY
if (!apiKey) {
  console.error('FIREBASE_API_KEY is not set')
  process.exit(2)
}
const projectId = process.env.FIREBASE_PROJECT_ID || 'finflow-e94b5'
const firestoreOrigin = process.env.FIRESTORE_ORIGIN || 'https://firestore.googleapis.com'
const authOrigin = process.env.AUTH_ORIGIN || 'https://identitytoolkit.googleapis.com'
const docs = `${firestoreOrigin}/v1/projects/${projectId}/databases/(default)/documents`
const key = `key=${encodeURIComponent(apiKey)}`

let failures = 0
const leftovers = []

function report(ok, label) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
}

function expectStatus(label, actual, expected) {
  report(actual === expected, `${label}: HTTP ${actual} (expected ${expected})`)
  return actual === expected
}

async function call(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json }
}

// POST that must be refused; if the server accepted it, remember the created path for cleanup.
async function postExpectDenied(label, url, token, body) {
  const res = await call('POST', url, { token, body })
  if (res.status === 200 && res.json?.name) leftovers.push(res.json.name.split('/documents/')[1])
  return expectStatus(label, res.status, 403)
}

// A full, valid-looking organization document (the shape the server writes).
function orgDocument(ownerId) {
  const now = Date.now()
  return {
    fields: {
      name: { stringValue: 'rules-check (safe to delete)' },
      currency: { stringValue: 'PLN' },
      ownerId: { stringValue: ownerId },
      plan: { stringValue: 'trial' },
      trialEndsAt: { timestampValue: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString() },
      createdAt: { timestampValue: new Date(now).toISOString() },
    },
  }
}

const unfilteredOrganizations = { structuredQuery: { from: [{ collectionId: 'organizations' }], limit: 1 } }

// REST form of lib/firebase/members.ts#getMemberships (collectionGroup('members').where('uid', '==', uid)).
function membersGroupQuery(uid) {
  const from = [{ collectionId: 'members', allDescendants: true }]
  if (uid === null) return { structuredQuery: { from, limit: 1 } }
  return {
    structuredQuery: {
      from,
      where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
    },
  }
}

// 1. No credentials at all.
expectStatus('anonymous list organizations', (await call('GET', `${docs}/organizations?pageSize=1&${key}`)).status, 403)
expectStatus('anonymous get _meta/health', (await call('GET', `${docs}/_meta/health?${key}`)).status, 403)

// 2. A freshly registered user who belongs to no organization.
const signUp = await call('POST', `${authOrigin}/v1/accounts:signUp?${key}`, {
  body: {
    email: `rules-check-${Date.now()}@example.com`,
    password: `Rc-${crypto.randomUUID()}`,
    returnSecureToken: true,
  },
})
if (signUp.status !== 200) {
  console.log(`FAIL sign up throwaway user: HTTP ${signUp.status} ${signUp.json?.error?.message ?? ''}`)
  process.exit(1)
}
const { idToken, localId: uid } = signUp.json

try {
  const rulesActive = expectStatus(
    'signed-in unfiltered list organizations',
    (await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: unfilteredOrganizations })).status,
    403,
  )
  if (!rulesActive) {
    console.log('FAIL the Firestore rules are not active; aborting before any write')
  } else {
    const randomOrg = `rules-check-${Date.now()}`
    expectStatus('signed-in get organization without membership', (await call('GET', `${docs}/organizations/${randomOrg}?${key}`, { token: idToken })).status, 403)
    await postExpectDenied('client create organization', `${docs}/organizations?${key}`, idToken, orgDocument(uid))
    await postExpectDenied(
      'client create own owner membership',
      `${docs}/organizations/${randomOrg}/members?documentId=${encodeURIComponent(uid)}&${key}`,
      idToken,
      {
        fields: {
          uid: { stringValue: uid },
          role: { stringValue: 'owner' },
          createdAt: { timestampValue: new Date().toISOString() },
          addedBy: { stringValue: uid },
        },
      },
    )

    // 3. Collection group `members`. Own uid: 200 and no documents (also proves the index and the
    // S02 rule are deployed; a missing index answers 400 FAILED_PRECONDITION, and the S00 rules
    // would answer 403). Another uid and an unfiltered query: 403.
    const own = await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: membersGroupQuery(uid) })
    expectStatus('collection-group members where uid == own uid', own.status, 200)
    if (own.status === 200) {
      const count = Array.isArray(own.json) ? own.json.filter((row) => row.document).length : -1
      report(count === 0, `own membership list is empty for a user without a company: ${count} document(s)`)
    }
    expectStatus(
      'collection-group members where uid == another uid',
      (await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: membersGroupQuery(`not-${uid}`) })).status,
      403,
    )
    expectStatus(
      'collection-group members unfiltered',
      (await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: membersGroupQuery(null) })).status,
      403,
    )
  }
} finally {
  const deleted = await call('POST', `${authOrigin}/v1/accounts:delete?${key}`, { body: { idToken } })
  expectStatus('delete throwaway user', deleted.status, 200)
}

for (const path of leftovers) console.log(`LEFTOVER=${path}`)
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
