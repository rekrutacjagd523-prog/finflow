import { NextRequest, NextResponse } from 'next/server'

// Dev-only endpoint for Playwright tests.
// Signs in via Firebase REST API (server-side, no IndexedDB issues)
// and returns the user's first org slug.

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const email = req.nextUrl.searchParams.get('email')
  const password = req.nextUrl.searchParams.get('password')
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  // 1. Sign in via Firebase Auth REST API
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  if (!signInRes.ok) {
    const err = await signInRes.json()
    return NextResponse.json({ error: err.error?.message ?? 'Sign in failed' }, { status: 401 })
  }
  const { localId: uid } = await signInRes.json()

  // 2. Query organizations where members.{uid} exists via Firestore REST API
  const firestoreBase = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`

  // List all organizations (simple approach for test env — no pagination needed)
  const queryRes = await fetch(
    `${firestoreBase}:runQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'organizations' }],
          where: {
            fieldFilter: {
              field: { fieldPath: `members.${uid}.role` },
              op: 'NOT_EQUAL',
              value: { nullValue: 'NULL_VALUE' },
            },
          },
          limit: 1,
        },
      }),
    }
  )

  let orgId: string | null = null

  if (queryRes.ok) {
    const rows = await queryRes.json() as Array<{ document?: { name: string } }>
    if (rows[0]?.document?.name) {
      orgId = rows[0].document.name.split('/').pop() ?? null
    }
  }

  // 3. If no org, create one via Firestore REST API
  if (!orgId) {
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const createRes = await fetch(
      `${firestoreBase}/organizations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: 'Test Organization' },
            currency: { stringValue: 'UAH' },
            ownerId: { stringValue: uid },
            plan: { stringValue: 'trial' },
            trialEndsAt: { timestampValue: trialEndsAt.toISOString() },
            createdAt: { timestampValue: new Date().toISOString() },
            members: {
              mapValue: {
                fields: {
                  [uid]: {
                    mapValue: {
                      fields: {
                        role: { stringValue: 'owner' },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      }
    )
    if (createRes.ok) {
      const doc = await createRes.json()
      orgId = doc.name?.split('/').pop() ?? null
    }
  }

  if (!orgId) {
    return NextResponse.json({ error: 'Could not find or create org' }, { status: 500 })
  }

  // 4. Return orgId — test page sets cookie and redirects
  return NextResponse.json({ orgId })
}
