import { createJwt } from '@/lib/enablebanking/jwt'
import { requireUserFromBearer } from '@/lib/server/auth'
import { errorResponse, HttpError } from '@/lib/server/http-error'

export const runtime = 'nodejs'

const BASE = 'https://api.enablebanking.com'
const COUNTRY_RE = /^[A-Z]{2}$/

type Aspsp = { name: string; country: string; logo?: string; bic?: string }

// GET /api/enablebanking/institutions?country=PL
// Requires `Authorization: Bearer <Firebase ID token>` (any signed-in user; no org data involved).
export async function GET(req: Request) {
  try {
    await requireUserFromBearer(req)

    const country = new URL(req.url).searchParams.get('country') ?? 'PL'
    if (!COUNTRY_RE.test(country)) throw new HttpError(400, 'invalid country')

    const token = await createJwt()
    const res = await fetch(`${BASE}/aspsps?country=${country}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('Enable Banking GET /aspsps failed:', res.status, await res.text())
      throw new HttpError(502, 'enable banking error')
    }
    const data = await res.json()
    const institutions = ((data.aspsps ?? []) as Aspsp[]).map((b) => ({
      id: b.name,
      name: b.name,
      country: b.country,
      logo: b.logo ?? null,
      bic: b.bic ?? null,
    }))
    return Response.json({ institutions })
  } catch (e) {
    return errorResponse(e)
  }
}
