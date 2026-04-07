import { NextRequest, NextResponse } from 'next/server'

const isSandbox = process.env.TRUELAYER_SANDBOX === 'true'
const AUTH_BASE = isSandbox
  ? 'https://auth.truelayer-sandbox.com'
  : 'https://auth.truelayer.com'

// GET /api/truelayer/connect?orgId=xxx
// Redirects user to TrueLayer bank picker
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgId = searchParams.get('orgId')

  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
  if (!process.env.TRUELAYER_CLIENT_ID) {
    return NextResponse.json({ error: 'TrueLayer not configured' }, { status: 500 })
  }

  const nonce = crypto.randomUUID()
  const state = Buffer.from(JSON.stringify({ orgId, nonce })).toString('base64url')
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/truelayer/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRUELAYER_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'info accounts balance transactions offline_access',
    state,
    nonce,
  })

  if (isSandbox) {
    params.set('enable_mock', 'true')
  }

  const url = `${AUTH_BASE}/connect/authorize?${params}`

  // Debug mode: return URL as JSON instead of redirecting
  if (req.nextUrl.searchParams.get('debug')) {
    return NextResponse.json({ url, client_id: process.env.TRUELAYER_CLIENT_ID, redirectUri })
  }

  return NextResponse.redirect(url)
}
