import { NextRequest, NextResponse } from 'next/server'
import { createJwt } from '@/lib/enablebanking/jwt'

const BASE = 'https://api.enablebanking.com'

// GET /api/enablebanking/accounts?sessionId=xxx
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  try {
    const token = await createJwt()
    const res = await fetch(`${BASE}/sessions/${sessionId}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({ accounts: data.accounts ?? data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
