import { NextRequest, NextResponse } from 'next/server'

const YAPILY_BASE = 'https://api.yapily.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function basicAuth() {
  const creds = `${process.env.YAPILY_APPLICATION_UUID}:${process.env.YAPILY_SECRET}`
  return 'Basic ' + Buffer.from(creds).toString('base64')
}

// POST /api/yapily/consent
// Body: { institutionId, orgId, userId }
export async function POST(req: NextRequest) {
  const { institutionId, orgId, userId } = await req.json()

  if (!institutionId || !orgId || !userId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const callbackUrl = `${APP_URL}/api/yapily/callback`

  const res = await fetch(`${YAPILY_BASE}/account-auth-requests`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      applicationUserId: userId,
      institutionId,
      callback: callbackUrl,
      // Pass orgId in the state via institutionId field — store in user profile
      userSettings: {
        featureScopeList: ['ACCOUNTS', 'TRANSACTIONS', 'ACCOUNT_BALANCES'],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const consentToken = data.data?.consentToken
  const authorisationUrl = data.data?.authorisationUrl

  if (!authorisationUrl) {
    return NextResponse.json({ error: 'No authorisation URL' }, { status: 500 })
  }

  // Store mapping of consentToken → orgId via encoded state in URL
  // We append orgId to callback via query param trick: store in consentToken prefix
  const stateParam = Buffer.from(JSON.stringify({ orgId, consentToken })).toString('base64url')
  const urlWithState = authorisationUrl.includes('?')
    ? `${authorisationUrl}&state=${stateParam}`
    : `${authorisationUrl}?state=${stateParam}`

  return NextResponse.json({ authorisationUrl: urlWithState, consentToken })
}
