import { NextRequest, NextResponse } from 'next/server'

import { createJwt } from '@/lib/enablebanking/jwt'

const BASE = 'https://api.enablebanking.com'

// GET /api/enablebanking/callback?code=xxx&state=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!state || !code) return NextResponse.redirect(new URL('/', req.url))

  try {
    const { orgId } = JSON.parse(Buffer.from(state, 'base64url').toString())

    // Exchange code for session
    const token = await createJwt()
    const res = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!res.ok) {
      console.error('Enable Banking session error:', await res.text())
      return NextResponse.redirect(new URL(`/${orgId}/settings?eb_error=1`, req.url))
    }

    const data = await res.json()
    const payload = Buffer.from(JSON.stringify({ sessionId: data.session_id })).toString('base64url')
    return NextResponse.redirect(
      new URL(`/${orgId}/settings?eb_auth=${payload}`, req.url)
    )
  } catch (e) {
    console.error('Callback error:', e)
    return NextResponse.redirect(new URL('/', req.url))
  }
}
