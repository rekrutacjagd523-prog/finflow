import { requireUser } from '@/lib/server/auth'
import { errorResponse, HttpError } from '@/lib/server/http-error'
import { createOrganizationForUser, parseCreateOrgInput } from '@/lib/server/orgs'

export const runtime = 'nodejs'

// A legitimate body is `{"name":"<=120 chars","currency":"PLN"}`.
const MAX_BODY_BYTES = 2048

// POST /api/orgs  { name, currency }
// The only way to create a company: the browser never writes organizations or memberships
// (firestore.rules). Requires a session (and a same-origin request); a verified email is not required.
export async function POST(req: Request) {
  try {
    const { uid } = await requireUser(req)

    const declaredLength = req.headers.get('content-length')
    if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
      throw new HttpError(413, 'payload too large')
    }
    if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      throw new HttpError(415, 'unsupported media type')
    }
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload too large')

    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new HttpError(400, 'invalid_body')
    }

    const orgId = await createOrganizationForUser(uid, parseCreateOrgInput(body))
    return Response.json({ orgId }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
