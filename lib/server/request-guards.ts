import 'server-only'
import { HttpError } from '@/lib/server/http-error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence in depth on top of `SameSite=Lax`: a state-changing request must carry an
 * `Origin` whose host equals the host the request was sent to. Browsers always send `Origin`
 * on cross-site and on same-site POST/PUT/PATCH/DELETE; a missing or "null" Origin is refused.
 * Safe methods are not checked.
 */
export function assertSameOrigin(req: Request): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return

  const origin = req.headers.get('origin')
  if (!origin) throw new HttpError(403, 'forbidden')

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw new HttpError(403, 'forbidden')
  }
  if (originHost !== new URL(req.url).host) throw new HttpError(403, 'forbidden')
}
