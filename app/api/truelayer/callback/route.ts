import { NextRequest, NextResponse } from 'next/server'

const isSandbox = process.env.TRUELAYER_SANDBOX === 'true'
const AUTH_BASE = isSandbox
  ? 'https://auth.truelayer-sandbox.com'
  : 'https://auth.truelayer.com'
const API_BASE = isSandbox
  ? 'https://api.truelayer-sandbox.com'
  : 'https://api.truelayer.com'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// GET /api/truelayer/callback?code=xxx&state=xxx
// TrueLayer redirects here after user authorizes
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${APP_URL}?tl_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}?tl_error=missing_params`)
  }

  try {
    // Decode state to get orgId
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { orgId } = stateData as { orgId: string }

    const redirectUri = `${APP_URL}/api/truelayer/callback`

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch(`${AUTH_BASE}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.TRUELAYER_CLIENT_ID!,
        client_secret: process.env.TRUELAYER_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Token exchange failed: ${err}`)
    }

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    // 2. Fetch accounts to get provider name
    let providerName = 'Bank'
    try {
      const accRes = await fetch(`${API_BASE}/data/v1/accounts`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (accRes.ok) {
        const accData = await accRes.json() as {
          results: Array<{ provider?: { display_name?: string } }>
        }
        providerName = accData.results?.[0]?.provider?.display_name ?? 'Bank'
      }
    } catch {
      // provider name is optional
    }

    // 3. Encode all data for client-side processing
    // The encoded payload is passed via URL — HTTPS only, processed immediately
    const payload = Buffer.from(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      orgId,
      providerName,
    })).toString('base64url')

    return NextResponse.redirect(`${APP_URL}/${orgId}/settings?tl_auth=${payload}`)
  } catch (e) {
    const msg = encodeURIComponent(String(e).slice(0, 200))
    return NextResponse.redirect(`${APP_URL}?tl_error=${msg}`)
  }
}
