import { NextRequest, NextResponse } from 'next/server'

const YAPILY_BASE = 'https://api.yapily.com'

function basicAuth() {
  const creds = `${process.env.YAPILY_APPLICATION_UUID}:${process.env.YAPILY_SECRET}`
  return 'Basic ' + Buffer.from(creds).toString('base64')
}

function consentHeaders(consentToken: string) {
  return {
    Authorization: basicAuth(),
    'Consent': consentToken,
    'Content-Type': 'application/json',
  }
}

// GET /api/yapily/data?type=accounts&consentToken=xxx
// GET /api/yapily/data?type=transactions&consentToken=xxx&accountId=xxx&from=2024-01-01
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type')
  const consentToken = searchParams.get('consentToken')

  if (!consentToken) return NextResponse.json({ error: 'Missing consentToken' }, { status: 400 })

  if (type === 'accounts') {
    const res = await fetch(`${YAPILY_BASE}/accounts`, {
      headers: consentHeaders(consentToken),
    })
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({ accounts: data.data ?? [] })
  }

  if (type === 'transactions') {
    const accountId = searchParams.get('accountId')
    const from = searchParams.get('from') ?? new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

    const params = new URLSearchParams({ from })
    const res = await fetch(`${YAPILY_BASE}/accounts/${accountId}/transactions?${params}`, {
      headers: consentHeaders(consentToken),
    })
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({ transactions: data.data ?? [] })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
