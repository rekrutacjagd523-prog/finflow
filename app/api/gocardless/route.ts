import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://bankaccountdata.gocardless.com/api/v2'

// Simple in-memory token cache (survives hot-reload in dev)
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const res = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless auth failed: ${err}`)
  }

  const data = await res.json()
  cachedToken = data.access
  // access token valid for 24h (86400s), cache with buffer
  tokenExpiresAt = Date.now() + (data.access_expires ?? 86400) * 1000
  return cachedToken!
}

async function gc(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

// GET /api/gocardless?action=institutions&country=PL
// GET /api/gocardless?action=requisition&id=xxx
// GET /api/gocardless?action=accounts&requisitionId=xxx
// GET /api/gocardless?action=account-details&id=xxx
// GET /api/gocardless?action=balances&id=xxx
// GET /api/gocardless?action=transactions&id=xxx&dateFrom=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    const token = await getAccessToken()

    if (action === 'institutions') {
      const country = searchParams.get('country') ?? 'PL'
      const data = await gc(`/institutions/?country=${country}`, token)
      return NextResponse.json(data)
    }

    if (action === 'requisition') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const data = await gc(`/requisitions/${id}/`, token)
      return NextResponse.json(data)
    }

    if (action === 'account-details') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const data = await gc(`/accounts/${id}/details/`, token)
      return NextResponse.json(data)
    }

    if (action === 'balances') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const data = await gc(`/accounts/${id}/balances/`, token)
      return NextResponse.json(data)
    }

    if (action === 'transactions') {
      const id = searchParams.get('id')
      const dateFrom = searchParams.get('dateFrom')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const qs = dateFrom ? `?date_from=${dateFrom}` : ''
      const data = await gc(`/accounts/${id}/transactions/${qs}`, token)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/gocardless?action=requisition  { institutionId, redirectUrl, reference }
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    const token = await getAccessToken()

    if (action === 'requisition') {
      const body = await req.json()
      const { institutionId, redirectUrl, reference } = body

      if (!institutionId || !redirectUrl) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 })
      }

      const res = await fetch(`${BASE}/requisitions/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          redirect: redirectUrl,
          institution_id: institutionId,
          reference: reference ?? crypto.randomUUID(),
          user_language: 'UK',
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      return NextResponse.json(await res.json())
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
