// Path rules shared by proxy.ts (server) and AuthProvider (browser).
// Pure on purpose: no imports, so it is safe in both bundles.

export const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'] as const
export const AUTH_PATHS = ['/login', '/register'] as const

const MAX_REDIRECT_LENGTH = 512

// Match on a segment boundary: `/login` and `/login/x` match, `/login1234/x` (an org slug) does not.
function matchesPath(pathname: string, entries: readonly string[]): boolean {
  return entries.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function isPublicPath(pathname: string): boolean {
  return matchesPath(pathname, PUBLIC_PATHS)
}

export function isAuthPath(pathname: string): boolean {
  return matchesPath(pathname, AUTH_PATHS)
}

/** `/<segment>/...`: the organization-scoped app area (same rule the pre-S01 proxy used). */
export function isAppPath(pathname: string): boolean {
  return /^\/[a-zA-Z0-9_-]+\//.test(pathname) && !isPublicPath(pathname)
}

/**
 * Validates a `?redirect=` value. Returns it unchanged only when it is a same-site relative
 * path; anything else (absolute URL, `//host`, backslashes, control characters, API paths,
 * very long values) becomes null so the caller falls back to its default destination.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null

  // Resolve dot segments, query and hash the way the browser will, then decode, so inputs like
  // `/./api/x`, `/%2e/api/x`, `/%61pi/x` or `/api?x=1` cannot dodge the API-path rule.
  let pathname: string
  try {
    const url = new URL(raw, 'http://x')
    if (url.origin !== 'http://x') return null
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) return null
  return raw
}
