// Black-box check of the deployed Firestore rules and composite indexes through
// the public REST API, i.e. what anyone holding the public web config can do.
//
// Prints only PASS/FAIL lines with HTTP statuses, never document contents.
// Creates one throwaway Auth user (always deleted at the end). Every
// organization document it manages to create is printed as LEFTOVER_ORG=<path>;
// clients cannot delete organizations by design, so remove each one with:
//   firebase firestore:delete "<path>" -r --force --project <projectId>
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

// Same shape as lib/firebase/firestore.ts#createOrganization.
function orgDocument(ownerId, memberUids, plan = 'trial') {
  const now = Date.now()
  const role = { mapValue: { fields: { role: { stringValue: 'owner' } } } }
  return {
    fields: {
      name: { stringValue: 'rules-check (safe to delete)' },
      currency: { stringValue: 'UAH' },
      ownerId: { stringValue: ownerId },
      plan: { stringValue: plan },
      trialEndsAt: { timestampValue: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString() },
      createdAt: { timestampValue: new Date(now).toISOString() },
      members: { mapValue: { fields: Object.fromEntries(memberUids.map((uid) => [uid, role])) } },
    },
  }
}

// POST a new organization; remember its path if the server accepted it.
async function createOrg(token, body) {
  const res = await call('POST', `${docs}/organizations?${key}`, { token, body })
  if (res.status === 200 && res.json?.name) leftovers.push(res.json.name.split('/documents/')[1])
  return res
}

// REST form of where(`members.${uid}.role`, '!=', null) from lib/firebase/queries.ts.
function memberQuery(uid) {
  return {
    structuredQuery: {
      from: [{ collectionId: 'organizations' }],
      where: { unaryFilter: { op: 'IS_NOT_NULL', field: { fieldPath: `members.\`${uid}\`.role` } } },
    },
  }
}

const unfilteredQuery = { structuredQuery: { from: [{ collectionId: 'organizations' }], limit: 1 } }

// REST form of lib/firebase/transactions.ts#getTransactions with filters.
function transactionsQuery(filters) {
  const fieldFilters = filters.map(([fieldPath, op, value]) => ({ fieldFilter: { field: { fieldPath }, op, value } }))
  return {
    structuredQuery: {
      from: [{ collectionId: 'transactions' }],
      where: fieldFilters.length === 1 ? fieldFilters[0] : { compositeFilter: { op: 'AND', filters: fieldFilters } },
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit: 1,
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
    (await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: unfilteredQuery })).status,
    403,
  )
  if (!rulesActive) {
    console.log('FAIL the S00 rules are not active; aborting before any write')
  } else {
    expectStatus('create org with foreign ownerId', (await createOrg(idToken, orgDocument('someone-else', [uid]))).status, 403)
    expectStatus('create org with plan=pro', (await createOrg(idToken, orgDocument(uid, [uid], 'pro'))).status, 403)

    const before = leftovers.length
    const created = await createOrg(idToken, orgDocument(uid, [uid]))
    expectStatus('create own trial org', created.status, 200)

    if (created.status === 200) {
      const orgPath = leftovers[before]

      const listed = await call('POST', `${docs}:runQuery?${key}`, { token: idToken, body: memberQuery(uid) })
      expectStatus('member-filtered list organizations (useOrg query)', listed.status, 200)
      const count = Array.isArray(listed.json) ? listed.json.filter((row) => row.document).length : -1
      report(count === 1, `member-filtered list returns exactly the own org: ${count} document(s)`)

      expectStatus('member get own org', (await call('GET', `${docs}/${orgPath}?${key}`, { token: idToken })).status, 200)
      expectStatus(
        'member update name',
        (
          await call('PATCH', `${docs}/${orgPath}?updateMask.fieldPaths=name&${key}`, {
            token: idToken,
            body: { fields: { name: { stringValue: 'rules-check renamed (safe to delete)' } } },
          })
        ).status,
        200,
      )
      expectStatus(
        'member update plan',
        (
          await call('PATCH', `${docs}/${orgPath}?updateMask.fieldPaths=plan&${key}`, {
            token: idToken,
            body: { fields: { plan: { stringValue: 'pro' } } },
          })
        ).status,
        403,
      )
      expectStatus('member delete org', (await call('DELETE', `${docs}/${orgPath}?${key}`, { token: idToken })).status, 403)
      expectStatus(
        'member create account in own org',
        (
          await call('POST', `${docs}/${orgPath}/accounts?${key}`, {
            token: idToken,
            body: { fields: { name: { stringValue: 'rules-check' }, balance: { integerValue: '0' } } },
          })
        ).status,
        200,
      )

      // Composite indexes from firestore.indexes.json. A missing or still
      // building index answers HTTP 400 FAILED_PRECONDITION, even on an empty
      // collection. The emulator never requires indexes.
      const acc = ['accountId', 'EQUAL', { stringValue: 'rules-check-account' }]
      const cat = ['categoryId', 'EQUAL', { stringValue: 'rules-check-category' }]
      const from = ['date', 'GREATER_THAN_OR_EQUAL', { timestampValue: '2026-01-01T00:00:00Z' }]
      for (const [label, filters] of [
        ['index accountId + date desc', [acc]],
        ['index categoryId + date desc', [cat]],
        ['index accountId + categoryId + date range desc', [acc, cat, from]],
      ]) {
        const res = await call('POST', `${docs}/${orgPath}:runQuery?${key}`, {
          token: idToken,
          body: transactionsQuery(filters),
        })
        expectStatus(label, res.status, 200)
      }
    }
  }
} finally {
  const deleted = await call('POST', `${authOrigin}/v1/accounts:delete?${key}`, { body: { idToken } })
  expectStatus('delete throwaway user', deleted.status, 200)
}

for (const path of leftovers) console.log(`LEFTOVER_ORG=${path}`)
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
