import { NextRequest, NextResponse } from 'next/server'

const isSandbox = process.env.TRUELAYER_SANDBOX === 'true'
const API_BASE = isSandbox
  ? 'https://api.truelayer-sandbox.com'
  : 'https://api.truelayer.com'
const AUTH_BASE = isSandbox
  ? 'https://auth.truelayer-sandbox.com'
  : 'https://auth.truelayer.com'

async function tlFetch(path: string, accessToken: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

// GET /api/truelayer/data?action=accounts&token=xxx
// GET /api/truelayer/data?action=balance&token=xxx&accountId=xxx
// GET /api/truelayer/data?action=transactions&token=xxx&accountId=xxx&from=2024-01-01T00:00:00Z
// POST /api/truelayer/data?action=refresh  body: { refreshToken }
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    if (action === 'accounts') {
      const data = await tlFetch('/data/v1/accounts', token)
      return NextResponse.json(data)
    }

    if (action === 'balance') {
      const accountId = searchParams.get('accountId')
      if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
      const data = await tlFetch(`/data/v1/accounts/${accountId}/balance`, token)
      return NextResponse.json(data)
    }

    if (action === 'transactions') {
      const accountId = searchParams.get('accountId')
      if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
      const from = searchParams.get('from')
      const qs = from ? `?from=${encodeURIComponent(from)}` : ''
      const data = await tlFetch(`/data/v1/accounts/${accountId}/transactions${qs}`, token)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  if (action === 'refresh') {
    try {
      const body = await req.json() as { refreshToken: string }

      const res = await fetch(`${AUTH_BASE}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.TRUELAYER_CLIENT_ID!,
          client_secret: process.env.TRUELAYER_CLIENT_SECRET!,
          refresh_token: body.refreshToken,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Refresh failed: ${err}`)
      }

      const data = await res.json() as {
        access_token: string
        refresh_token: string
        expires_in: number
      }

      return NextResponse.json({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
