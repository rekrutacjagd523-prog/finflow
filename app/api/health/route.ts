import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { errorResponse } from '@/lib/server/http-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A health probe must never be served from a CDN or browser cache.
function noStore(res: Response): Response {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// GET /api/health — proves the function can reach Firestore with the Admin SDK.
// Reads one service document (it does not need to exist) and returns no user data.
export async function GET(): Promise<Response> {
  try {
    await getAdmin().db.doc('_meta/health').get()
    return noStore(
      Response.json({
        ok: true,
        region: process.env.VERCEL_REGION ?? 'local',
        firestore: 'ok',
      }),
    )
  } catch (e) {
    return noStore(errorResponse(e))
  }
}
