import { NextRequest, NextResponse } from 'next/server'
import { createJwt } from '@/lib/enablebanking/jwt'

const BASE = 'https://api.enablebanking.com'

// POST /api/enablebanking/session  { aspspName, country, orgId }
export async function POST(req: NextRequest) {
  try {
    const { aspspName, country, orgId } = await req.json()
    if (!aspspName || !orgId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const token = await createJwt()
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/enablebanking/callback`

    const body = {
      access: {
        valid_until: new Date(Date.now() + 90 * 86400_000).toISOString(),
        balances: true,
        transactions: true,
      },
      aspsp: { name: aspspName, country: country ?? 'PL' },
      redirect_url: redirectUrl,
      psu_type: 'personal',
      state: Buffer.from(JSON.stringify({ orgId })).toString('base64url'),
    }

    const res = await fetch(`${BASE}/auth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({ url: data.url, authorizationId: data.authorization_id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
