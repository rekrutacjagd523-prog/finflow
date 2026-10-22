import { createJwt } from '@/lib/enablebanking/jwt'
import { requireOrgMember } from '@/lib/server/auth'
import { verifyEbState } from '@/lib/server/eb-state'
import { errorResponse, HttpError } from '@/lib/server/http-error'

export const runtime = 'nodejs'

const BASE = 'https://api.enablebanking.com'

function redirectTo(req: Request, path: string): Response {
  return new Response(null, { status: 307, headers: { Location: new URL(path, req.url).toString() } })
}

// GET /api/enablebanking/callback?code=xxx&state=xxx
// Enable Banking redirects the browser here after the bank login, so there is no Bearer token:
// the HMAC-signed `state` created by /api/enablebanking/session identifies the org and the user.
// The state and the user's membership are verified BEFORE the code is exchanged.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const code = params.get('code')
  const state = params.get('state')

  let orgId: string
  try {
    if (!state) throw new HttpError(400, 'invalid state')
    const verified = verifyEbState(state, process.env.EB_STATE_SECRET!)
    await requireOrgMember(verified.uid, verified.orgId)
    orgId = verified.orgId
  } catch (e) {
    return errorResponse(e)
  }

  const settingsPath = `/${encodeURIComponent(orgId)}/settings`

  // No code: the user cancelled at the bank or Enable Banking returned ?error=...
  if (!code) {
    console.error('Enable Banking callback without code:', params.get('error'), params.get('error_description'))
    return redirectTo(req, `${settingsPath}?eb_error=1`)
  }

  try {
    const token = await createJwt()
    const res = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!res.ok) {
      console.error('Enable Banking session error:', res.status, await res.text())
      return redirectTo(req, `${settingsPath}?eb_error=1`)
    }

    const data = await res.json()
    const payload = Buffer.from(JSON.stringify({ sessionId: data.session_id })).toString('base64url')
    return redirectTo(req, `${settingsPath}?eb_auth=${payload}`)
  } catch (e) {
    console.error('Callback error:', e)
    return redirectTo(req, `${settingsPath}?eb_error=1`)
  }
}
