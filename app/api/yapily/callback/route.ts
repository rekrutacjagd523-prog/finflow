import { NextRequest, NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// GET /api/yapily/callback?consent=xxx&error=xxx
// Yapily redirects here after user authorizes at their bank
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const consent = searchParams.get('consent')
  const error = searchParams.get('error')
  const state = searchParams.get('state') // encoded {orgId, consentToken}

  if (error) {
    return NextResponse.redirect(`${APP_URL}?yapily_error=${encodeURIComponent(error)}`)
  }

  if (!consent) {
    return NextResponse.redirect(`${APP_URL}?yapily_error=no_consent`)
  }

  // Decode orgId from state
  let orgId = ''
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
      orgId = decoded.orgId ?? ''
    }
  } catch {
    // fallback
  }

  if (!orgId) {
    return NextResponse.redirect(`${APP_URL}?yapily_error=no_org`)
  }

  // Encode consent token for client-side processing
  const payload = Buffer.from(JSON.stringify({ consentToken: consent, orgId })).toString('base64url')

  return NextResponse.redirect(`${APP_URL}/${orgId}/settings?yapily_auth=${payload}`)
}
