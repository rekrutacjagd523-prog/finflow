import { createJwt } from '@/lib/enablebanking/jwt'
import { requireOrgMember, requireUserFromBearer } from '@/lib/server/auth'
import { errorResponse, HttpError } from '@/lib/server/http-error'

export const runtime = 'nodejs'

const BASE = 'https://api.enablebanking.com'
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

// GET /api/enablebanking/accounts?sessionId=xxx&orgId=yyy
// Requires `Authorization: Bearer <Firebase ID token>` of a member of `orgId`.
export async function GET(req: Request) {
  try {
    const { uid } = await requireUserFromBearer(req)

    const params = new URL(req.url).searchParams
    const sessionId = params.get('sessionId')
    const orgId = params.get('orgId')
    if (!sessionId || !ID_RE.test(sessionId)) throw new HttpError(400, 'Missing sessionId')
    if (!orgId || !ID_RE.test(orgId)) throw new HttpError(400, 'Missing orgId')

    await requireOrgMember(uid, orgId)

    const token = await createJwt()
    // Upstream call unchanged in S00 (no UI uses this route). Known debt for S09: the
    // Enable Banking API has no /sessions/{id}/accounts; GET /sessions/{id} returns `accounts`.
    const res = await fetch(`${BASE}/sessions/${sessionId}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('Enable Banking GET /sessions/{id}/accounts failed:', res.status, await res.text())
      throw new HttpError(502, 'enable banking error')
    }
    const data = await res.json()
    return Response.json({ accounts: data.accounts ?? data ?? [] })
  } catch (e) {
    return errorResponse(e)
  }
}
