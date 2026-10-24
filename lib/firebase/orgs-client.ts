// Creates a company through POST /api/orgs (the browser never writes organizations: firestore.rules).
// The session cookie is sent automatically (same-origin).

export type OrgCreateErrorCode = 'org_limit_reached' | 'unauthorized' | 'invalid' | 'network' | 'server'

const MESSAGES: Record<OrgCreateErrorCode, string> = {
  org_limit_reached: 'You can own at most 3 companies.',
  unauthorized: 'Your session has expired. Please sign in again.',
  invalid: 'Please check the company name and currency.',
  network: 'Network error. Please check your connection and try again.',
  server: 'Could not create the company. Please try again.',
}

export class OrgCreateError extends Error {
  constructor(public readonly code: OrgCreateErrorCode) {
    super(MESSAGES[code])
    this.name = 'OrgCreateError'
  }
}

export async function createOrgViaApi(name: string, currency: string): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/orgs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, currency }),
    })
  } catch {
    throw new OrgCreateError('network')
  }

  const body = (await res.json().catch(() => null)) as { orgId?: unknown; error?: unknown } | null

  if (res.status === 201) {
    if (typeof body?.orgId === 'string' && body.orgId.length > 0) return body.orgId
    throw new OrgCreateError('server')
  }
  if (res.status === 409 && body?.error === 'org_limit_reached') throw new OrgCreateError('org_limit_reached')
  if (res.status === 401) throw new OrgCreateError('unauthorized')
  if (res.status === 400) throw new OrgCreateError('invalid')
  throw new OrgCreateError('server')
}
