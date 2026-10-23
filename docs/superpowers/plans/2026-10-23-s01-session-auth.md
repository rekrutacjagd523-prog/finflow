# S01 Session Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client-set `__session=1` cookie with a verified, revocable Firebase session cookie, give every server route a single `requireUser()` entry point, and add soft email verification.

**Architecture:** After every Firebase sign-in the browser posts the fresh ID token to `POST /api/auth/session`, which mints a 7-day `HttpOnly` session cookie with `createSessionCookie`. `requireUser()` / `requireVerifiedUser()` verify that cookie (with revocation check) in API routes; `proxy.ts` verifies it (without the revocation round-trip) for page navigation. Bearer-token auth is removed. The Enable Banking callback additionally requires the session `uid` to equal the `uid` in the signed OAuth state.

**Tech Stack:** Next.js 16 (`proxy.ts`, Node runtime), `firebase-admin` 14 (`verifySessionCookie`, `createSessionCookie`, `revokeRefreshTokens`), Firebase client SDK 12, Vitest 5, Playwright on the Auth + Firestore emulators.

**Spec:** [2026-10-23-s01-session-auth-design.md](../specs/2026-10-23-s01-session-auth-design.md)

---

## Working conventions (read first)

- Repo: `F:\AI\finflow`, branch `s01-session-auth` (already created; the spec and roadmap commits are on it). **Never commit to `master`.** Shell commands below are for Git Bash: `cd /f/AI/finflow`.
- Commit author is already configured (`remit-agency`). Every commit message ends with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; pass it as a second `-m` argument as shown.
- Unit tests: `npx vitest run <file>`; whole suite: `npm run test:unit`. Type check: `npm run typecheck`. Lint: `npm run lint` (the 25 existing warnings are expected; **no new errors**).
- Emulator tests need Java: `export PATH="$HOME/.jre/temurin-21/bin:$PATH"; java -version` (portable Temurin 21 installed in S00; if the path differs, `ls ~/.jre`). Firebase CLI: `firebase` (global, installed in S00; otherwise `npx -y firebase-tools@15`).
- Never print or commit secrets. Nothing in this plan needs a secret: the emulator project is `demo-finflow`.
- Language of code comments: English (matches the codebase). UI strings follow the surrounding component (Ukrainian in settings/app shell).

## Spec refinements decided while planning

These refine the approved spec; Task 13 writes them into the spec so the docs match the code.

1. **No silent session renewal.** Spec §1 allowed re-minting an expired cookie from a live SDK user. That conflicts with the 5-minute `auth_time` rule (a days-old sign-in always fails it) and would make sessions effectively unlimited. The 7 days are **absolute**: after that the user signs in again.
2. **`requireVerifiedUser` reads the live user record** (`auth.getUser(uid).emailVerified`), not the `email_verified` claim in the cookie. The claim is frozen at sign-in, so a user who verifies later would stay blocked until re-login.
3. **The proxy does not check revocation** (by design, spec §4), so a revoked cookie can still load *pages* until it expires; every API route checks revocation. E2E asserts revocation on the API only.
4. **`/login` consumes `?redirect=`** through `safeRedirectPath` (the old login ignored it).
5. **Shared path rules** live in `lib/auth/paths.ts` (used by `proxy.ts` and the client `AuthProvider`).
6. **Check order in `requireUser`:** session first (401), then `Origin` for unsafe methods (403). Unauthenticated callers keep getting 401.
7. Banner text is Ukrainian (matches the settings UI); S03 translates.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/auth/paths.ts` | create | Pure path rules + `safeRedirectPath` (client and server) |
| `lib/server/session-cookie.ts` | create | Cookie name, lifetime, read/build/clear helpers |
| `lib/server/request-guards.ts` | create | `assertSameOrigin` (CSRF defence in depth) |
| `lib/server/auth.ts` | modify | `requireUser`, `requireVerifiedUser`, `isSessionCookieValid`, `toAuthHttpError`; later delete Bearer |
| `app/api/auth/session/route.ts` | create | Mint the session cookie from a fresh ID token |
| `app/api/auth/logout/route.ts` | create | Revoke + clear |
| `app/api/enablebanking/{session,accounts,institutions,callback}/route.ts` | modify | Use `requireUser`/`requireVerifiedUser`; callback binds state to session |
| `lib/enablebanking/client.ts` | modify | Same-origin fetch, 401 → login |
| `components/settings/EnableBankingConnect.tsx` | modify | Friendly `email_not_verified` message |
| `lib/firebase/session.ts` | create | `establishSession`, `clearSession` (browser) |
| `lib/firebase/auth.ts` | modify | Session after sign-in/up, verification mail, logout |
| `lib/hooks/useAuth.tsx` | modify | Remove cookie writes; SDK ⇄ cookie sync |
| `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` | modify | Remove `document.cookie`; login honours `redirect` |
| `proxy.ts` | rewrite | Verified session check |
| `components/auth/VerifyEmailBanner.tsx` | create | Soft email-verification banner |
| `app/(app)/[orgSlug]/layout.tsx` | modify | Mount the banner |
| `tests/unit/**`, `tests/e2e/**` | create/modify | See tasks |

---

### Task 1: Shared path rules and safe redirect

**Files:**
- Create: `lib/auth/paths.ts`
- Test: `tests/unit/auth/paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/auth/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAppPath, isAuthPath, isPublicPath, safeRedirectPath } from '@/lib/auth/paths'

describe('isPublicPath', () => {
  it.each(['/login', '/register', '/forgot-password', '/login/extra'])('is true for %s', (p) => {
    expect(isPublicPath(p)).toBe(true)
  })
  it.each(['/', '/pricing', '/org1/transactions'])('is false for %s', (p) => {
    expect(isPublicPath(p)).toBe(false)
  })
})

describe('isAuthPath', () => {
  it.each(['/login', '/register'])('is true for %s', (p) => expect(isAuthPath(p)).toBe(true))
  it.each(['/forgot-password', '/', '/org1/settings'])('is false for %s', (p) => {
    expect(isAuthPath(p)).toBe(false)
  })
})

describe('isAppPath', () => {
  it.each(['/org1/transactions', '/Ab_c-9/settings', '/org1/analytics/cashflow'])('is true for %s', (p) => {
    expect(isAppPath(p)).toBe(true)
  })
  it.each(['/', '/login', '/login/x', '/register', '/forgot-password', '/pricing', '/org1', '//evil/x'])(
    'is false for %s',
    (p) => expect(isAppPath(p)).toBe(false),
  )
})

describe('safeRedirectPath', () => {
  it.each(['/org1/settings', '/org1/transactions?month=2026-10', '/'])('accepts %s', (p) => {
    expect(safeRedirectPath(p)).toBe(p)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['relative without slash', 'org1/x'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['absolute URL', 'https://evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['newline', '/a\nb'],
    ['NUL', '/a\u0000b'],
    ['API path', '/api/enablebanking/x'],
    ['bare /api', '/api'],
    ['too long', '/' + 'a'.repeat(600)],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value as string | null | undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/auth/paths.test.ts`
Expected: FAIL (cannot resolve `@/lib/auth/paths`).

- [ ] **Step 3: Implement**

Create `lib/auth/paths.ts`:

```ts
// Path rules shared by proxy.ts (server) and AuthProvider (browser).
// Pure on purpose: no imports, so it is safe in both bundles.

export const PUBLIC_PATHS = ['/login', '/register', '/forgot-password']
export const AUTH_PATHS = ['/login', '/register']

const MAX_REDIRECT_LENGTH = 512

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p))
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
  if (raw === '/api' || raw.startsWith('/api/')) return null
  return raw
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/auth/paths.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add lib/auth/paths.ts tests/unit/auth/paths.test.ts && git commit -m "feat(auth): shared path rules and safe redirect validation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Session cookie helpers

**Files:**
- Create: `lib/server/session-cookie.ts`
- Test: `tests/unit/server/session-cookie.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/session-cookie.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildClearedSessionCookie,
  buildSessionCookie,
  isSecureCookieEnv,
  readSessionCookie,
} from '@/lib/server/session-cookie'

function headers(cookie?: string): Headers {
  const h = new Headers()
  if (cookie !== undefined) h.set('cookie', cookie)
  return h
}

describe('constants', () => {
  it('uses the __session name and a 7-day lifetime', () => {
    expect(SESSION_COOKIE_NAME).toBe('__session')
    expect(SESSION_MAX_AGE_SECONDS).toBe(604800)
  })
})

describe('readSessionCookie', () => {
  it('returns the value of __session', () => {
    expect(readSessionCookie(headers('__session=abc.def.ghi'))).toBe('abc.def.ghi')
  })

  it('finds it among other cookies and ignores whitespace', () => {
    expect(readSessionCookie(headers('theme=dark; __session=tok ; other=1'))).toBe('tok')
  })

  it('does not match a cookie whose name merely ends with __session', () => {
    expect(readSessionCookie(headers('x__session=nope'))).toBeNull()
  })

  it.each([
    ['no Cookie header', undefined],
    ['an empty header', ''],
    ['other cookies only', 'a=1; b=2'],
    ['an empty value', '__session='],
    ['a segment without "="', '__session'],
  ])('returns null for %s', (_label, value) => {
    expect(readSessionCookie(headers(value))).toBeNull()
  })

  it('keeps "=" characters inside the value', () => {
    expect(readSessionCookie(headers('__session=a=b=='))).toBe('a=b==')
  })
})

describe('buildSessionCookie', () => {
  it('sets HttpOnly, SameSite=Lax, Path=/ and a 7-day Max-Age', () => {
    expect(buildSessionCookie('v', false)).toBe(
      '__session=v; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax',
    )
  })

  it('adds Secure when requested', () => {
    expect(buildSessionCookie('v', true)).toBe(
      '__session=v; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure',
    )
  })
})

describe('buildClearedSessionCookie', () => {
  it('expires the cookie immediately with matching attributes', () => {
    expect(buildClearedSessionCookie(false)).toBe('__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
    expect(buildClearedSessionCookie(true)).toBe(
      '__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure',
    )
  })
})

describe('isSecureCookieEnv', () => {
  it('is true only in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isSecureCookieEnv()).toBe(true)
    vi.stubEnv('NODE_ENV', 'development')
    expect(isSecureCookieEnv()).toBe(false)
    vi.stubEnv('NODE_ENV', 'test')
    expect(isSecureCookieEnv()).toBe(false)
  })

  it('drives the default of the builders', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(buildSessionCookie('v')).toContain('; Secure')
    expect(buildClearedSessionCookie()).toContain('; Secure')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/session-cookie.test.ts`
Expected: FAIL (cannot resolve the module).

- [ ] **Step 3: Implement**

Create `lib/server/session-cookie.ts`:

```ts
import 'server-only'

/** Name kept from the pre-S01 cookie; it now carries a Firebase session cookie (a signed JWT). */
export const SESSION_COOKIE_NAME = '__session'
/** Absolute session lifetime: 7 days (no sliding renewal). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

/** Only production is served over HTTPS; `Secure` cookies would not be stored on plain-http dev. */
export function isSecureCookieEnv(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Extracts the `__session` value from a request's Cookie header, or null. */
export function readSessionCookie(headers: Headers): string | null {
  const header = headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE_NAME) continue
    const value = part.slice(eq + 1).trim()
    return value.length > 0 ? value : null
  }
  return null
}

function attributes(maxAgeSeconds: number, secure: boolean): string {
  return `Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

/** `Set-Cookie` header value that stores a freshly minted session cookie. */
export function buildSessionCookie(value: string, secure: boolean = isSecureCookieEnv()): string {
  return `${SESSION_COOKIE_NAME}=${value}; ${attributes(SESSION_MAX_AGE_SECONDS, secure)}`
}

/** `Set-Cookie` header value that deletes the session cookie (same attributes, Max-Age=0). */
export function buildClearedSessionCookie(secure: boolean = isSecureCookieEnv()): string {
  return `${SESSION_COOKIE_NAME}=; ${attributes(0, secure)}`
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/session-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add lib/server/session-cookie.ts tests/unit/server/session-cookie.test.ts && git commit -m "feat(auth): session cookie helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Same-origin guard

**Files:**
- Create: `lib/server/request-guards.ts`
- Test: `tests/unit/server/request-guards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/request-guards.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'

function req(method: string, origin?: string, url = 'http://localhost:3000/api/x'): Request {
  const headers = new Headers()
  if (origin !== undefined) headers.set('origin', origin)
  return new Request(url, { method, headers })
}

describe('assertSameOrigin', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('accepts %s with a matching Origin', (method) => {
    expect(() => assertSameOrigin(req(method, 'http://localhost:3000'))).not.toThrow()
  })

  it('compares hosts (including port), not the scheme', () => {
    expect(() =>
      assertSameOrigin(req('POST', 'https://finflow.test', 'https://finflow.test/api/x')),
    ).not.toThrow()
    expect(() => assertSameOrigin(req('POST', 'http://localhost:3001'))).toThrow(HttpError)
  })

  it.each([
    ['a foreign origin', 'https://evil.example'],
    ['a look-alike host', 'http://localhost:3000.evil.example'],
    ['the literal "null" origin', 'null'],
    ['garbage', 'not a url'],
  ])('rejects an unsafe method with %s', (_label, origin) => {
    const err = (() => {
      try {
        assertSameOrigin(req('POST', origin))
        return null
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'forbidden' })
  })

  it('rejects an unsafe method without an Origin header', () => {
    expect(() => assertSameOrigin(req('POST'))).toThrow(HttpError)
    expect(() => assertSameOrigin(req('DELETE'))).toThrow(HttpError)
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('lets safe method %s through regardless of Origin', (method) => {
    expect(() => assertSameOrigin(req(method, 'https://evil.example'))).not.toThrow()
    expect(() => assertSameOrigin(req(method))).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/request-guards.test.ts`
Expected: FAIL (cannot resolve the module).

- [ ] **Step 3: Implement**

Create `lib/server/request-guards.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/request-guards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add lib/server/request-guards.ts tests/unit/server/request-guards.test.ts && git commit -m "feat(auth): same-origin guard for state-changing requests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `requireUser`, `requireVerifiedUser`, `isSessionCookieValid` (Bearer kept for now)

The old Bearer helper stays until Task 7 so the suite stays green while the routes are migrated.

**Files:**
- Modify: `lib/server/auth.ts`
- Modify: `tests/unit/server/auth.test.ts` (add tests; existing ones stay)

- [ ] **Step 1: Extend the test file's mock and add failing tests**

In `tests/unit/server/auth.test.ts` replace the import line and the `admin` hoisted block plus `beforeEach` (the first 22 lines) with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import {
  isOrgMember,
  isSessionCookieValid,
  requireOrgMember,
  requireUser,
  requireUserFromBearer,
  requireVerifiedUser,
} from '@/lib/server/auth'

// lib/server/auth.ts talks to Firebase only through getAdmin(); replace it with
// a fake { auth: { verifyIdToken, verifySessionCookie, getUser }, db: { doc(path).get() } }.
const admin = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  verifySessionCookie: vi.fn(),
  getUser: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/lib/server/firebase-admin', () => ({ getAdmin: admin.getAdmin }))

beforeEach(() => {
  admin.verifyIdToken.mockReset()
  admin.verifySessionCookie.mockReset()
  admin.getUser.mockReset()
  admin.get.mockReset()
  admin.doc.mockReset().mockReturnValue({ get: admin.get })
  admin.getAdmin.mockReset().mockReturnValue({
    auth: {
      verifyIdToken: admin.verifyIdToken,
      verifySessionCookie: admin.verifySessionCookie,
      getUser: admin.getUser,
    },
    db: { doc: admin.doc },
  })
})
```

Then insert this block immediately **before** the line `function requestWithAuth(authorization?: string): Request {`:

```ts
function requestWithCookie(
  cookie?: string,
  init: { method?: string; origin?: string } = {},
): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', cookie)
  if (init.origin !== undefined) headers.set('origin', init.origin)
  return new Request('http://localhost/api/test', { method: init.method ?? 'GET', headers })
}

function rejection(code: string, message = 'x'): Error {
  return Object.assign(new Error(message), { code })
}

describe('requireUser', () => {
  it('returns uid and emailVerified for a valid, unrevoked session cookie', async () => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: true })

    await expect(requireUser(requestWithCookie('__session=good'))).resolves.toEqual({
      uid: 'u1',
      emailVerified: true,
    })
    expect(admin.verifySessionCookie).toHaveBeenCalledWith('good', true)
  })

  it('reports emailVerified=false when the claim is absent or false', async () => {
    admin.verifySessionCookie.mockResolvedValueOnce({ uid: 'u1' })
    await expect(requireUser(requestWithCookie('__session=a'))).resolves.toMatchObject({
      emailVerified: false,
    })
    admin.verifySessionCookie.mockResolvedValueOnce({ uid: 'u1', email_verified: false })
    await expect(requireUser(requestWithCookie('__session=b'))).resolves.toMatchObject({
      emailVerified: false,
    })
  })

  it.each([
    ['no Cookie header', undefined],
    ['other cookies only', 'theme=dark'],
    ['an empty __session', '__session='],
  ])('rejects %s with 401 without calling Firebase', async (_label, cookie) => {
    const err = await requireUser(requestWithCookie(cookie)).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
    expect(admin.verifySessionCookie).not.toHaveBeenCalled()
  })

  it.each([
    'auth/session-cookie-expired',
    'auth/session-cookie-revoked',
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('maps cookie-validity error %s to 401', async (code) => {
    admin.verifySessionCookie.mockRejectedValue(rejection(code))

    const err = await requireUser(requestWithCookie('__session=t')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it.each([
    ['an auth/internal-error', rejection('auth/internal-error', 'boom SECRET-BODY'), 'auth/internal-error'],
    ['a network error', rejection('ENOTFOUND', 'getaddrinfo ENOTFOUND SECRET-BODY'), 'ENOTFOUND'],
    ['an error without a code', new TypeError('fetch failed SECRET-BODY'), 'TypeError'],
  ])('maps %s to 503, logging only the code or name', async (_label, failure, logged) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.verifySessionCookie.mockRejectedValue(failure)

    const err = await requireUser(requestWithCookie('__session=secret-cookie')).catch(
      (e: unknown) => e,
    )

    expect(err).toMatchObject({ status: 503, message: 'auth unavailable' })
    expect(log).toHaveBeenCalledWith('verifySessionCookie failed', logged)
    const dump = JSON.stringify(log.mock.calls)
    expect(dump).not.toContain('SECRET-BODY')
    expect(dump).not.toContain('secret-cookie')
    log.mockRestore()
  })

  it('does not mask a server configuration error as 401', async () => {
    admin.getAdmin.mockImplementation(() => {
      throw new HttpError(500, 'server not configured')
    })

    const err = await requireUser(requestWithCookie('__session=good')).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 500, message: 'server not configured' })
  })

  describe('same-origin check for unsafe methods', () => {
    beforeEach(() => {
      admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: true })
    })

    it('accepts POST with a matching Origin', async () => {
      await expect(
        requireUser(requestWithCookie('__session=g', { method: 'POST', origin: 'http://localhost' })),
      ).resolves.toMatchObject({ uid: 'u1' })
    })

    it.each([
      ['a foreign Origin', 'https://evil.example'],
      ['no Origin', undefined],
    ])('rejects POST with %s using 403 (after the session was verified)', async (_label, origin) => {
      const err = await requireUser(
        requestWithCookie('__session=g', { method: 'POST', origin }),
      ).catch((e: unknown) => e)

      expect(err).toMatchObject({ status: 403, message: 'forbidden' })
    })

    it('does not check Origin for GET', async () => {
      await expect(
        requireUser(requestWithCookie('__session=g', { origin: 'https://evil.example' })),
      ).resolves.toMatchObject({ uid: 'u1' })
    })

    it('answers an unauthenticated POST with 401, not 403', async () => {
      const err = await requireUser(requestWithCookie(undefined, { method: 'POST' })).catch(
        (e: unknown) => e,
      )
      expect(err).toMatchObject({ status: 401 })
    })
  })
})

describe('requireVerifiedUser', () => {
  beforeEach(() => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email_verified: false })
  })

  it('resolves when the live user record says the email is verified (even if the cookie claim is stale)', async () => {
    admin.getUser.mockResolvedValue({ uid: 'u1', emailVerified: true })

    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).resolves.toEqual({
      uid: 'u1',
      emailVerified: true,
    })
    expect(admin.getUser).toHaveBeenCalledWith('u1')
  })

  it('rejects with 403 email_not_verified when the email is not verified', async () => {
    admin.getUser.mockResolvedValue({ uid: 'u1', emailVerified: false })

    const err = await requireVerifiedUser(requestWithCookie('__session=g')).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 403, message: 'email_not_verified' })
  })

  it('answers 401 without a session and never reads the user record', async () => {
    const err = await requireVerifiedUser(requestWithCookie()).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401 })
    expect(admin.getUser).not.toHaveBeenCalled()
  })

  it('maps a deleted user to 401 and an outage to 503', async () => {
    admin.getUser.mockRejectedValueOnce(rejection('auth/user-not-found'))
    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).rejects.toMatchObject({
      status: 401,
    })

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.getUser.mockRejectedValueOnce(rejection('auth/internal-error'))
    await expect(requireVerifiedUser(requestWithCookie('__session=g'))).rejects.toMatchObject({
      status: 503,
    })
    expect(log).toHaveBeenCalledWith('getUser failed', 'auth/internal-error')
    log.mockRestore()
  })
})

describe('isSessionCookieValid', () => {
  it('is true for a valid cookie and skips the revocation round-trip', async () => {
    admin.verifySessionCookie.mockResolvedValue({ uid: 'u1' })

    await expect(isSessionCookieValid('good')).resolves.toBe(true)
    expect(admin.verifySessionCookie).toHaveBeenCalledWith('good', false)
  })

  it.each(['auth/session-cookie-expired', 'auth/argument-error', 'auth/invalid-id-token'])(
    'is false for %s',
    async (code) => {
      admin.verifySessionCookie.mockRejectedValue(rejection(code))
      await expect(isSessionCookieValid('bad')).resolves.toBe(false)
    },
  )

  it('throws a 503 HttpError on an outage so callers can fail closed without logging users out', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.verifySessionCookie.mockRejectedValue(rejection('auth/internal-error'))

    await expect(isSessionCookieValid('x')).rejects.toMatchObject({ status: 503 })
    log.mockRestore()
  })
})

```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/auth.test.ts`
Expected: FAIL (`requireUser`, `requireVerifiedUser`, `isSessionCookieValid` are not exported); the older Bearer tests still compile.

- [ ] **Step 3: Implement**

Replace the whole of `lib/server/auth.ts` with:

```ts
import 'server-only'
import { getAdmin } from '@/lib/server/firebase-admin'
import { HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { readSessionCookie } from '@/lib/server/session-cookie'

// RFC 7235: the auth scheme is case-insensitive; the token is one opaque word.
const BEARER = /^Bearer (\S+)$/i

// Firestore document id allow-list for ids that arrive from the request.
// Dots are excluded ('.' and '..' are invalid ids); ids matching __.*__ are
// reserved by Firestore, so they are refused as well.
const ORG_ID = /^[A-Za-z0-9_-]{1,128}$/
const RESERVED_ID = /^__.*__$/

// Admin SDK errors that mean "this token / cookie is not acceptable" (a client
// problem). Everything else is an outage/bug on our side and must not look
// like a bad credential.
const TOKEN_ERROR_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
])

/**
 * Pure membership check against an organizations/{orgId} document's data.
 * Mirrors the Firestore rule `request.auth.uid in resource.data.members`.
 */
export function isOrgMember(orgData: unknown, uid: string): boolean {
  if (!uid || typeof orgData !== 'object' || orgData === null) return false
  const members: unknown = (orgData as { members?: unknown }).members
  if (typeof members !== 'object' || members === null || Array.isArray(members)) return false
  return Object.hasOwn(members, uid)
}

/**
 * Maps a failed Admin Auth call to an HttpError: 401 for credential problems, 503 for
 * everything else. `operation` only labels the log line; the error code or class name is
 * logged, never the message body (it can quote the token or cookie).
 */
export function toAuthHttpError(e: unknown, operation: string): HttpError {
  const code = (e as { code?: unknown } | null)?.code
  if (typeof code === 'string' && TOKEN_ERROR_CODES.has(code)) {
    return new HttpError(401, 'unauthorized')
  }
  const kind = typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
  console.error(`${operation} failed`, kind)
  return new HttpError(503, 'auth unavailable')
}

export type SessionUser = { uid: string; emailVerified: boolean }

/**
 * Authenticates a request by its `__session` cookie, verified with revocation checking.
 * 401 for a missing/invalid/expired/revoked cookie, 503 when verification itself fails.
 * For POST/PUT/PATCH/DELETE the `Origin` must also match the host (403 otherwise); the
 * session is checked first so unauthenticated callers always get 401.
 * `emailVerified` is the claim frozen into the cookie at sign-in: use requireVerifiedUser
 * for decisions that depend on verification.
 */
export async function requireUser(req: Request): Promise<SessionUser> {
  const cookie = readSessionCookie(req.headers)
  if (!cookie) throw new HttpError(401, 'unauthorized')

  // Outside the try: a missing service account must surface as 500, not 401.
  const { auth } = getAdmin()
  let uid: string
  let claimVerified: boolean
  try {
    const decoded = await auth.verifySessionCookie(cookie, true)
    uid = decoded.uid
    claimVerified = decoded.email_verified === true
  } catch (e) {
    throw toAuthHttpError(e, 'verifySessionCookie')
  }

  assertSameOrigin(req)
  return { uid, emailVerified: claimVerified }
}

/**
 * requireUser plus a live check that the user's email is verified (403 `email_not_verified`
 * otherwise). Reads the user record because the cookie's claim would stay stale after the
 * user verifies their address.
 */
export async function requireVerifiedUser(req: Request): Promise<SessionUser> {
  const user = await requireUser(req)

  let verified: boolean
  try {
    verified = (await getAdmin().auth.getUser(user.uid)).emailVerified
  } catch (e) {
    throw toAuthHttpError(e, 'getUser')
  }
  if (!verified) throw new HttpError(403, 'email_not_verified')
  return { uid: user.uid, emailVerified: true }
}

/**
 * Signature + expiry check of a session cookie WITHOUT the revocation round-trip. Used by
 * proxy.ts on every page navigation; API routes use requireUser for the full check.
 * Returns false for an unacceptable cookie; throws HttpError(503) when verification failed
 * for reasons on our side (the proxy then answers 503 instead of logging everyone out).
 */
export async function isSessionCookieValid(cookie: string): Promise<boolean> {
  const { auth } = getAdmin()
  try {
    await auth.verifySessionCookie(cookie, false)
    return true
  } catch (e) {
    const err = toAuthHttpError(e, 'verifySessionCookie')
    if (err.status === 401) return false
    throw err
  }
}

/**
 * Reads `Authorization: Bearer <Firebase ID token>` and verifies it with
 * revocation checking. Throws HttpError(401) for a missing/malformed header or
 * any token the Admin SDK rejects as invalid, and HttpError(503) when
 * verification itself fails (outage). Removed in S01 Task 7 (routes use requireUser).
 */
export async function requireUserFromBearer(req: Request): Promise<{ uid: string }> {
  const match = BEARER.exec(req.headers.get('authorization') ?? '')
  if (!match) throw new HttpError(401, 'unauthorized')

  // Outside the try: a missing service account must surface as 500, not 401.
  const { auth } = getAdmin()
  try {
    const decoded = await auth.verifyIdToken(match[1], true)
    return { uid: decoded.uid }
  } catch (e) {
    throw toAuthHttpError(e, 'verifyIdToken')
  }
}

/**
 * Throws HttpError(403) unless organizations/{orgId} exists and lists uid in
 * its `members` map. Reads with the Admin SDK (bypasses security rules).
 * Temporary until S02 moves membership to its own document.
 */
export async function requireOrgMember(uid: string, orgId: string): Promise<void> {
  // orgId comes from the request: allow-list a single plain doc id, otherwise
  // "org1/accounts/x" would read a different document. Same error as a
  // non-member so ids cannot be probed.
  if (typeof orgId !== 'string' || !ORG_ID.test(orgId) || RESERVED_ID.test(orgId)) {
    throw new HttpError(403, 'forbidden')
  }

  const snap = await getAdmin().db.doc(`organizations/${orgId}`).get()
  if (!snap.exists || !isOrgMember(snap.data(), uid)) {
    throw new HttpError(403, 'forbidden')
  }
}
```

Note: the refactor of `requireUserFromBearer` keeps its observable behaviour (`'verifyIdToken failed'` log label, same codes) so the old Bearer tests stay green.

- [ ] **Step 4: Run to verify everything passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/auth.test.ts && npm run typecheck`
Expected: PASS (old Bearer tests + new tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add lib/server/auth.ts tests/unit/server/auth.test.ts && git commit -m "feat(auth): requireUser, requireVerifiedUser and proxy-side cookie check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fake admin extension and the `/api/auth/session` + `/api/auth/logout` routes

**Files:**
- Modify (replace whole file): `tests/unit/helpers/fake-admin.ts`
- Create: `app/api/auth/session/route.ts`, `app/api/auth/logout/route.ts`
- Test: `tests/unit/api/auth/session.test.ts`, `tests/unit/api/auth/logout.test.ts`

- [ ] **Step 1: Replace the fake admin helper (superset of the old one)**

Replace `tests/unit/helpers/fake-admin.ts` entirely with:

```ts
import { vi } from 'vitest'

/**
 * In-memory stand-in for getAdmin() from '@/lib/server/firebase-admin'.
 * Route tests mock that module with `{ getAdmin: () => fakeAdmin }`, so the REAL
 * requireUser / requireVerifiedUser / requireOrgMember from '@/lib/server/auth' run against this data.
 * Only `organizations/{orgId}` documents are modelled; both db.doc(path) and
 * db.collection(name).doc(id) access styles are supported.
 */
export const fakeOrgs = new Map<string, Record<string, unknown>>()

/** Accepted credential -> uid. Used for BOTH session-cookie values and ID tokens. */
export const fakeTokens = new Map<string, string>()

/** uids whose email is NOT verified (everyone else is verified). */
export const fakeUnverified = new Set<string>()

/** ID token -> seconds since its sign-in (default 0 = just signed in). */
export const fakeIdTokenAgeSec = new Map<string, number>()

export const TEST_EB_STATE_SECRET = 'route-test-secret-0123456789abcdef'
export const TEST_APP_URL = 'https://finflow.test'

function snapshotFor(path: string) {
  const segments = path.split('/')
  const data =
    segments.length === 2 && segments[0] === 'organizations' ? fakeOrgs.get(segments[1]) : undefined
  return {
    id: segments[segments.length - 1],
    exists: data !== undefined,
    data: () => data,
    get: (field: string) => (data === undefined ? undefined : data[field]),
  }
}

function docRef(path: string) {
  return {
    id: path.split('/').pop(),
    path,
    get: async () => snapshotFor(path),
  }
}

function invalid(what: string): Error {
  // Like the real Admin SDK: a rejected credential carries an `auth/...` code, which
  // toAuthHttpError maps to 401 (errors without such a code become 503).
  return Object.assign(new Error(`invalid ${what}`), { code: 'auth/argument-error' })
}

export const fakeAdmin = {
  db: {
    doc: (path: string) => docRef(path),
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
  },
  auth: {
    verifyIdToken: vi.fn(async (token: string) => {
      const uid = fakeTokens.get(token)
      if (!uid) throw invalid('id token')
      return {
        uid,
        auth_time: Math.floor(Date.now() / 1000) - (fakeIdTokenAgeSec.get(token) ?? 0),
      }
    }),
    verifySessionCookie: vi.fn(async (cookie: string) => {
      const uid = fakeTokens.get(cookie)
      if (!uid) throw invalid('session cookie')
      return { uid, email_verified: !fakeUnverified.has(uid) }
    }),
    getUser: vi.fn(async (uid: string) => {
      if (![...fakeTokens.values()].includes(uid)) {
        throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' })
      }
      return { uid, emailVerified: !fakeUnverified.has(uid) }
    }),
    createSessionCookie: vi.fn(async (_idToken: string, _options: { expiresIn: number }) => 'minted-session-cookie'),
    revokeRefreshTokens: vi.fn(async (_uid: string) => {}),
  },
}

/**
 * Resets the fixture:
 *  - alice owns org-acme and has a verified email;
 *  - mallory is signed in with a verified email but is not a member of anything;
 *  - bob is signed in but his email is NOT verified.
 * Each user has a credential named token-<name> (works as an ID token and as a session cookie).
 */
export function resetFakeAdmin(): void {
  fakeOrgs.clear()
  fakeTokens.clear()
  fakeUnverified.clear()
  fakeIdTokenAgeSec.clear()
  fakeTokens.set('token-alice', 'user-alice')
  fakeTokens.set('token-mallory', 'user-mallory')
  fakeTokens.set('token-bob', 'user-bob')
  fakeUnverified.add('user-bob')
  fakeOrgs.set('org-acme', {
    name: 'Acme',
    currency: 'PLN',
    ownerId: 'user-alice',
    plan: 'trial',
    members: { 'user-alice': { role: 'owner' } },
  })
  for (const fn of Object.values(fakeAdmin.auth)) fn.mockClear()
}

/** A JSON Response, as returned by the mocked global fetch for Enable Banking calls. */
export function upstreamJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Write the failing route tests**

Create `tests/unit/api/auth/session.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAdmin, fakeIdTokenAgeSec, resetFakeAdmin } from '@/tests/unit/helpers/fake-admin'
import { POST } from '@/app/api/auth/session/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})

function mintRequest(body: unknown, origin: string | null = 'http://localhost:3000'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin !== null) headers.Origin = origin
  return new Request('http://localhost:3000/api/auth/session', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/auth/session', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('mints a 7-day HttpOnly session cookie for a freshly issued ID token', async () => {
    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(
      '__session=minted-session-cookie; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax',
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fakeAdmin.auth.verifyIdToken).toHaveBeenCalledWith('token-alice', true)
    expect(fakeAdmin.auth.createSessionCookie).toHaveBeenCalledWith('token-alice', {
      expiresIn: 604800 * 1000,
    })
  })

  it('adds Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await POST(mintRequest({ idToken: 'token-alice' }))
    expect(res.headers.get('set-cookie')).toContain('; Secure')
  })

  it('accepts a sign-in that is just inside the 5-minute window', async () => {
    fakeIdTokenAgeSec.set('token-alice', 299)
    expect((await POST(mintRequest({ idToken: 'token-alice' }))).status).toBe(204)
  })

  it('refuses a sign-in older than 5 minutes with 401 reauth_required and mints nothing', async () => {
    fakeIdTokenAgeSec.set('token-alice', 301)

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'reauth_required' })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.createSessionCookie).not.toHaveBeenCalled()
  })

  it.each([
    ['a foreign Origin', 'https://evil.example'],
    ['no Origin', null],
  ])('returns 403 for %s before touching Firebase', async (_label, origin) => {
    const res = await POST(mintRequest({ idToken: 'token-alice' }, origin))

    expect(res.status).toBe(403)
    expect(fakeAdmin.auth.verifyIdToken).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', 'not json'],
    ['an empty object', {}],
    ['a non-string idToken', { idToken: 123 }],
    ['an empty idToken', { idToken: '' }],
    ['an oversized idToken', { idToken: 'x'.repeat(5000) }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await POST(mintRequest(body))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing params' })
    expect(fakeAdmin.auth.verifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 for an ID token Firebase rejects', async () => {
    const res = await POST(mintRequest({ idToken: 'token-forged' }))

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.createSessionCookie).not.toHaveBeenCalled()
  })

  it('returns 503 when ID token verification fails for reasons on our side', async () => {
    fakeAdmin.auth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'auth/internal-error' }),
    )

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'auth unavailable' })
  })

  it('returns 503 when Firebase cannot mint the cookie', async () => {
    fakeAdmin.auth.createSessionCookie.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'auth/internal-error' }),
    )

    const res = await POST(mintRequest({ idToken: 'token-alice' }))

    expect(res.status).toBe(503)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
```

Create `tests/unit/api/auth/logout.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAdmin, resetFakeAdmin } from '@/tests/unit/helpers/fake-admin'
import { POST } from '@/app/api/auth/logout/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})

const CLEARED = '__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'

function logoutRequest(cookie?: string, origin: string | null = 'http://localhost:3000'): Request {
  const headers: Record<string, string> = {}
  if (origin !== null) headers.Origin = origin
  if (cookie !== undefined) headers.Cookie = cookie
  return new Request('http://localhost:3000/api/auth/logout', { method: 'POST', headers })
}

describe('POST /api/auth/logout', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('revokes the refresh tokens of a valid session and clears the cookie', async () => {
    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.verifySessionCookie).toHaveBeenCalledWith('token-alice', false)
    expect(fakeAdmin.auth.revokeRefreshTokens).toHaveBeenCalledWith('user-alice')
  })

  it('clears the cookie and answers 204 even without a session', async () => {
    const res = await POST(logoutRequest())

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })

  it('clears a garbage cookie without revoking anything', async () => {
    const res = await POST(logoutRequest('__session=garbage'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })

  it('still clears the cookie when revocation fails, logging only the code', async () => {
    fakeAdmin.auth.revokeRefreshTokens.mockRejectedValueOnce(
      Object.assign(new Error('boom SECRET-BODY'), { code: 'auth/internal-error' }),
    )
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(logoutRequest('__session=token-alice'))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBe(CLEARED)
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET-BODY')
    expect(log).toHaveBeenCalledWith('logout revoke failed', 'auth/internal-error')
    log.mockRestore()
  })

  it.each([
    ['a foreign Origin', 'https://evil.example'],
    ['no Origin', null],
  ])('returns 403 for %s and neither clears nor revokes', async (_label, origin) => {
    const res = await POST(logoutRequest('__session=token-alice', origin))

    expect(res.status).toBe(403)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(fakeAdmin.auth.revokeRefreshTokens).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/api/auth`
Expected: FAIL (cannot resolve the route modules).

- [ ] **Step 4: Implement the routes**

Create `app/api/auth/session/route.ts`:

```ts
import type { DecodedIdToken } from 'firebase-admin/auth'
import { toAuthHttpError } from '@/lib/server/auth'
import { getAdmin } from '@/lib/server/firebase-admin'
import { errorResponse, HttpError } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { SESSION_MAX_AGE_SECONDS, buildSessionCookie } from '@/lib/server/session-cookie'

export const runtime = 'nodejs'

// A session may only be minted right after a real sign-in (Firebase's own recommendation):
// a stolen, older ID token cannot be exchanged for a 7-day cookie.
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60
const MAX_ID_TOKEN_LENGTH = 4096

// POST /api/auth/session  { idToken }
// Not to be confused with /api/enablebanking/session (starts a bank connection).
// Exchanges a freshly issued Firebase ID token for the HttpOnly `__session` cookie.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)

    const body: unknown = await req.json().catch(() => null)
    const idToken = (body as { idToken?: unknown } | null)?.idToken
    if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > MAX_ID_TOKEN_LENGTH) {
      throw new HttpError(400, 'Missing params')
    }

    const { auth } = getAdmin()

    let decoded: DecodedIdToken
    try {
      decoded = await auth.verifyIdToken(idToken, true)
    } catch (e) {
      throw toAuthHttpError(e, 'verifyIdToken')
    }
    if (Math.floor(Date.now() / 1000) - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
      throw new HttpError(401, 'reauth_required')
    }

    let cookie: string
    try {
      cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 })
    } catch (e) {
      throw toAuthHttpError(e, 'createSessionCookie')
    }

    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': buildSessionCookie(cookie), 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
```

Create `app/api/auth/logout/route.ts`:

```ts
import { getAdmin } from '@/lib/server/firebase-admin'
import { errorResponse } from '@/lib/server/http-error'
import { assertSameOrigin } from '@/lib/server/request-guards'
import { buildClearedSessionCookie, readSessionCookie } from '@/lib/server/session-cookie'

export const runtime = 'nodejs'

// POST /api/auth/logout
// Revokes the user's refresh tokens (so a copied cookie stops working on every device) and
// clears the cookie. Always answers 204 for a same-origin caller, even with no or a broken session.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
  } catch (e) {
    return errorResponse(e)
  }

  const cookie = readSessionCookie(req.headers)
  if (cookie) {
    try {
      const { auth } = getAdmin()
      // No revocation check: an already revoked cookie still identifies its user.
      const { uid } = await auth.verifySessionCookie(cookie, false)
      await auth.revokeRefreshTokens(uid)
    } catch (e) {
      // Best effort: the cookie is cleared below regardless. Log the code only.
      const code = (e as { code?: unknown } | null)?.code
      const kind = typeof code === 'string' ? code : e instanceof Error ? e.name : typeof e
      console.error('logout revoke failed', kind)
    }
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': buildClearedSessionCookie(), 'Cache-Control': 'no-store' },
  })
}
```

- [ ] **Step 5: Run to verify they pass, plus the whole unit suite and typecheck**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/api/auth && npm run test:unit && npm run typecheck`
Expected: PASS everywhere (the extended fake-admin is a superset, so the existing EB route tests still pass).

- [ ] **Step 6: Commit**

```bash
cd /f/AI/finflow && git add tests/unit/helpers/fake-admin.ts tests/unit/api/auth app/api/auth && git commit -m "feat(auth): session and logout endpoints" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Migrate the Enable Banking routes (and bind the callback to the session)

**Files:**
- Modify: `app/api/enablebanking/session/route.ts`, `accounts/route.ts`, `institutions/route.ts`, `callback/route.ts`
- Modify: `tests/unit/api/enablebanking/{session,accounts,institutions,callback}.test.ts`

- [ ] **Step 1: Update the tests first (they will fail until the routes are migrated)**

**`tests/unit/api/enablebanking/session.test.ts`** — apply these edits:

1. Replace the `sessionRequest` function with:

```ts
function sessionRequest(body: unknown, token?: string, origin = 'http://localhost:3000'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: origin }
  if (token) headers.Cookie = `__session=${token}`
  return new Request('http://localhost:3000/api/enablebanking/session', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}
```

2. Rename the two tests: `'returns 401 without an Authorization header and never calls Enable Banking'` → `'returns 401 without a session cookie and never calls Enable Banking'`; `'returns 401 for an invalid ID token'` → `'returns 401 for a forged session cookie'`.
3. Replace `expect(fakeAdmin.auth.verifyIdToken).toHaveBeenCalledTimes(1)` with `expect(fakeAdmin.auth.verifySessionCookie).toHaveBeenCalledTimes(1)`.
4. Insert these two tests directly after the `'returns 401 for a forged session cookie'` test:

```ts
  it('returns 403 email_not_verified for a signed-in user whose email is not verified', async () => {
    const res = await POST(sessionRequest(VALID_BODY, 'token-bob'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'email_not_verified' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 403 for a cross-origin request even with a valid session', async () => {
    const res = await POST(sessionRequest(VALID_BODY, 'token-alice', 'https://evil.example'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
```

**`tests/unit/api/enablebanking/accounts.test.ts`** — replace the last line of `accountsRequest` with `return new Request(url, { headers: token ? { Cookie: `__session=${token}` } : {} })`; rename `'returns 401 without an Authorization header'` → `'returns 401 without a session cookie'` and `'returns 401 for a forged ID token'` → `'returns 401 for a forged session cookie'`.

**`tests/unit/api/enablebanking/institutions.test.ts`** — replace the last line of `institutionsRequest` with `return new Request(url, { headers: token ? { Cookie: `__session=${token}` } : {} })`; rename `'returns 401 without an Authorization header'` → `'returns 401 without a session cookie'` and `'returns 401 for an invalid ID token'` → `'returns 401 for a forged session cookie'`. Also rename the test `'returns the same { institutions } shape as before for any signed-in user'` to keep its text but note mallory is verified; no other change.

**`tests/unit/api/enablebanking/callback.test.ts`** — apply:

1. Replace `callbackRequest` with:

```ts
function callbackRequest(query: Record<string, string>, token: string | null = 'token-alice'): Request {
  const url = new URL('http://localhost:3000/api/enablebanking/callback')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new Request(url, { headers: token ? { Cookie: `__session=${token}` } : {} })
}
```

2. In the test `'returns 403 when the user in the state is no longer a member, before exchanging the code'` change the call to `await GET(callbackRequest({ code: 'auth-code', state }, 'token-mallory'))` (state and cookie are both mallory, so the membership check is what rejects).
3. Insert after that test:

```ts
  it('returns 400 for a forged state even without a session (state is verified first)', async () => {
    const forged = signEbState({ orgId: 'org-acme', uid: 'user-alice' }, 'attacker-secret')
    const res = await GET(callbackRequest({ code: 'auth-code', state: forged }, null))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid state' })
  })

  it.each([
    ['no session cookie', null],
    ['a forged session cookie', 'token-forged'],
  ])('redirects to /login (keeping the settings path) with %s, without exchanging the code', async (_label, token) => {
    const res = await GET(callbackRequest({ code: 'auth-code', state: aliceState() }, token))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?redirect=%2Forg-acme%2Fsettings')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the session belongs to a different user than the state', async () => {
    const res = await GET(callbackRequest({ code: 'auth-code', state: aliceState() }, 'token-mallory'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run to verify the failures**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/api/enablebanking`
Expected: FAIL (routes still expect Bearer).

- [ ] **Step 3: Migrate the routes**

`app/api/enablebanking/session/route.ts`:
- change the import line to `import { requireOrgMember, requireVerifiedUser } from '@/lib/server/auth'`;
- replace the two lines
  ```ts
  // Requires `Authorization: Bearer <Firebase ID token>` of a member of `orgId`.
  ```
  with
  ```ts
  // Requires the session cookie of a user with a verified email who is a member of `orgId`.
  ```
- replace `const { uid } = await requireUserFromBearer(req)` with `const { uid } = await requireVerifiedUser(req)`.

`app/api/enablebanking/accounts/route.ts`:
- import `{ requireOrgMember, requireUser }`;
- comment becomes `// Requires the session cookie of a member of `orgId`.`;
- `const { uid } = await requireUser(req)`.

`app/api/enablebanking/institutions/route.ts`:
- import `{ requireUser }`;
- comment becomes `// Requires a session cookie (any signed-in user; no org data involved).`;
- `await requireUser(req)`.

`app/api/enablebanking/callback/route.ts`:
- change the imports to include `requireUser`: `import { requireOrgMember, requireUser } from '@/lib/server/auth'`;
- replace the comment block above `export async function GET` and the whole top of the handler up to and including the closing `}` of the first `try/catch` (the one that sets `orgId`) with:

```ts
// GET /api/enablebanking/callback?code=xxx&state=xxx
// Enable Banking redirects the browser here after the bank login (a top-level navigation, so the
// SameSite=Lax session cookie is sent). Order matters: the HMAC-signed `state` created by
// /api/enablebanking/session is verified first (forgeries get 400 and nothing else is touched),
// then the session must belong to the same user as the state, then membership is checked.
// All of that happens BEFORE the code is exchanged.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const code = params.get('code')
  const state = params.get('state')

  let verified: { orgId: string; uid: string }
  try {
    if (!state) throw new HttpError(400, 'invalid state')
    verified = verifyEbState(state, process.env.EB_STATE_SECRET!)
  } catch (e) {
    return errorResponse(e)
  }
  const orgId = verified.orgId
  const settingsPath = `/${encodeURIComponent(orgId)}/settings`

  try {
    const { uid } = await requireUser(req)
    if (uid !== verified.uid) throw new HttpError(403, 'forbidden')
    await requireOrgMember(verified.uid, verified.orgId)
  } catch (e) {
    // The session ended (or never existed) while the user was at the bank: sign in again and
    // come back to settings. The one-time code is dropped; the user restarts the connection.
    if (e instanceof HttpError && e.status === 401) {
      return redirectTo(req, `/login?redirect=${encodeURIComponent(settingsPath)}`)
    }
    return errorResponse(e)
  }
```

  and delete the now-duplicated line `const settingsPath = `/${encodeURIComponent(orgId)}/settings`` that followed the old `try/catch` (the rest of the handler, from `// No code: the user cancelled…` on, is unchanged).

- [ ] **Step 4: Run to verify everything passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/api/enablebanking && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add app/api/enablebanking tests/unit/api/enablebanking && git commit -m "feat(auth): Enable Banking routes use the session cookie; callback bound to the session" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Remove the Bearer path; `ebFetch` uses the cookie

**Files:**
- Modify: `lib/server/auth.ts`, `tests/unit/server/auth.test.ts`
- Modify: `lib/enablebanking/client.ts`, `tests/unit/enablebanking/client.test.ts`
- Modify: `components/settings/EnableBankingConnect.tsx`

- [ ] **Step 1: Delete Bearer from the server**

In `lib/server/auth.ts` delete: the `BEARER` constant and its comment line, and the whole `requireUserFromBearer` function with its doc comment.

In `tests/unit/server/auth.test.ts` delete: `requireUserFromBearer` from the import list, `verifyIdToken: admin.verifyIdToken` from both the `admin` hoisted object, the `mockReset` call and the `getAdmin` return value (keep `verifySessionCookie` and `getUser`), the `requestWithAuth` helper, and the whole `describe('requireUserFromBearer', …)` block.

- [ ] **Step 2: Rewrite `ebFetch` and its test**

Replace `lib/enablebanking/client.ts` with:

```ts
'use client'

const ALLOWED_PREFIX = '/api/enablebanking/'

/**
 * The path part (before ? or #) must live under ALLOWED_PREFIX and contain no empty, "." or ".."
 * segments (also when percent-encoded) and no backslashes, so it cannot be steered to another route.
 */
function isAllowedPath(path: string): boolean {
  if (!path.startsWith(ALLOWED_PREFIX)) return false
  const pathname = path.split(/[?#]/, 1)[0]
  if (pathname.includes('\\')) return false
  const segments = pathname.slice(ALLOWED_PREFIX.length).split('/')
  return segments.every((segment, i) => {
    // An empty segment is only fine as the very last one (bare prefix or a trailing slash).
    if (segment === '') return i === segments.length - 1
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return false
    }
    return decoded !== '.' && decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\')
  })
}

/**
 * fetch() for FinFlow's own /api/enablebanking/* routes from the browser.
 * Authentication is the HttpOnly `__session` cookie, sent automatically on same-origin requests,
 * so no token is handled here. A 401 means the session is gone: send the user to /login and
 * bring them back afterwards.
 */
export async function ebFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isAllowedPath(path)) {
    throw new Error('ebFetch: only /api/enablebanking/* paths are allowed')
  }
  const res = await fetch(path, { ...init, credentials: 'same-origin' })
  if (res.status === 401 && typeof window !== 'undefined') {
    const back = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.assign(`/login?redirect=${back}`)
  }
  return res
}
```

Replace `tests/unit/enablebanking/client.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ebFetch } from '@/lib/enablebanking/client'

const fetchMock = vi.fn()
const assign = vi.fn()

describe('ebFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    assign.mockReset()
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { location: { pathname: '/org-acme/settings', search: '?x=1', assign } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends same-origin credentials and never an Authorization header; keeps method, body and headers', async () => {
    await ebFetch('/api/enablebanking/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"orgId":"org-acme"}',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/enablebanking/session')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"orgId":"org-acme"}')
    expect(init.credentials).toBe('same-origin')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('works without init (plain GET)', async () => {
    const res = await ebFetch('/api/enablebanking/institutions?country=PL')
    expect(res.status).toBe(200)
    expect(assign).not.toHaveBeenCalled()
  })

  it('sends the user to /login (and back afterwards) on a 401', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))

    const res = await ebFetch('/api/enablebanking/institutions')

    expect(res.status).toBe(401)
    expect(assign).toHaveBeenCalledWith('/login?redirect=%2Forg-acme%2Fsettings%3Fx%3D1')
  })

  it.each([403, 500])('does not redirect on %s', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }))
    await ebFetch('/api/enablebanking/institutions')
    expect(assign).not.toHaveBeenCalled()
  })

  it('refuses any path outside /api/enablebanking/*', async () => {
    await expect(ebFetch('https://evil.example/api/enablebanking/x')).rejects.toThrow(
      'ebFetch: only /api/enablebanking/* paths are allowed',
    )
    await expect(ebFetch('/api/other')).rejects.toThrow('ebFetch: only /api/enablebanking/* paths are allowed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    '/api/enablebanking/../x',
    '/api/enablebanking/a/../../other',
    '/api/enablebanking/%2e%2e/x',
    '/api/enablebanking/./x',
    '//evil.example',
    '/api/enablebanking//x',
    '/api/enablebanking/a\\..\\x',
  ])('rejects the path-traversal / double-slash path %s', async (path) => {
    await expect(ebFetch(path)).rejects.toThrow('ebFetch: only /api/enablebanking/* paths are allowed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still allows "//" inside the query string', async () => {
    await ebFetch('/api/enablebanking/institutions?next=https://x.test/a')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Friendly message for the verification gate**

In `components/settings/EnableBankingConnect.tsx`, inside `handleConnect`, directly after the line `const data = await res.json()` and before `if (!res.ok || data.error) throw …`, insert:

```ts
      if (res.status === 403 && data.error === 'email_not_verified') {
        toast.error('Підтвердіть email, щоб підключити банк')
        setConnecting(false)
        return
      }
```

- [ ] **Step 4: Run everything**

Run: `cd /f/AI/finflow && npm run test:unit && npm run typecheck && npm run lint`
Expected: unit all green, typecheck clean, lint 0 errors (warnings unchanged).
Then confirm nothing references the old helper: `cd /f/AI/finflow && grep -rn "requireUserFromBearer\|BEARER" app lib components tests scripts proxy.ts` → expect no output.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add lib components tests && git commit -m "refactor(auth): remove the Bearer path; ebFetch relies on the session cookie" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Browser session sync (sign-in/up, sign-out, SDK ⇄ cookie)

**Files:**
- Create: `lib/firebase/session.ts`, `tests/unit/firebase/session.test.ts`
- Modify: `lib/firebase/auth.ts`, `lib/hooks/useAuth.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/firebase/session.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { clearSession, establishSession } from '@/lib/firebase/session'

const fetchMock = vi.fn()

function fakeUser(token = 'id-token-1') {
  const getIdToken = vi.fn(async (_forceRefresh?: boolean) => token)
  return { user: { getIdToken } as unknown as User, getIdToken }
}

describe('establishSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts a force-refreshed ID token to /api/auth/session', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const { user, getIdToken } = fakeUser()

    await establishSession(user)

    expect(getIdToken).toHaveBeenCalledWith(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/session')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(String(init.body))).toEqual({ idToken: 'id-token-1' })
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('throws when the server refuses the session', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"reauth_required"}', { status: 401 }))
    await expect(establishSession(fakeUser().user)).rejects.toThrow('session setup failed (401)')
  })
})

describe('clearSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts to /api/auth/logout', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await clearSession()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/logout')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
  })

  it('never throws (offline): the cookie then expires on its own', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(clearSession()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/firebase/session.test.ts`
Expected: FAIL (cannot resolve the module).

- [ ] **Step 3: Implement `session.ts`**

Create `lib/firebase/session.ts`:

```ts
'use client'

import type { User } from 'firebase/auth'

/**
 * Exchanges the signed-in user's ID token for the HttpOnly `__session` cookie.
 * Call it right after every successful Firebase sign-in/sign-up: the server only accepts a
 * sign-in that is at most 5 minutes old. getIdToken(true) guarantees a fresh token.
 */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true)
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error(`session setup failed (${res.status})`)
}

/** Revokes the server session and clears the cookie. Never throws. */
export async function clearSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // Offline: the cookie expires on its own and every API call re-checks it.
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/firebase/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the session into the auth functions**

Replace `lib/firebase/auth.ts` with:

```ts
'use client'

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { createOrganization } from './firestore'
import { clearSession, establishSession } from './session'

const googleProvider = new GoogleAuthProvider()

/**
 * Mints the server session for a user who just signed in. If that fails, the SDK sign-in is
 * undone so the browser never ends up "signed in" without a session cookie.
 */
async function withSession(user: User): Promise<void> {
  try {
    await establishSession(user)
  } catch (e) {
    await firebaseSignOut(auth)
    throw e
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  orgName: string,
  currency: string
): Promise<{ user: User; orgId: string }> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const user = credential.user

  await withSession(user)
  // Best effort: a failed mail must not undo the registration. The in-app banner offers "send again".
  await sendEmailVerification(user).catch(() => {})
  await updateProfile(user, { displayName: name })

  const orgId = await createOrganization(user.uid, orgName, currency)

  return { user, orgId }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await withSession(credential.user)
  return credential.user
}

export async function signInWithGoogle(): Promise<{ user: User; orgId?: string }> {
  const credential = await signInWithPopup(auth, googleProvider)
  const user = credential.user
  await withSession(user)

  // For Google sign-in, org creation is handled separately if it's a new user
  return { user }
}

export async function signOut(): Promise<void> {
  await clearSession()
  await firebaseSignOut(auth)
}
```

Replace `lib/hooks/useAuth.tsx` with:

```tsx
'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/firebase'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
} from '@/lib/firebase/auth'
import { clearSession } from '@/lib/firebase/session'
import { isAppPath } from '@/lib/auth/paths'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User>
  signUp: (
    email: string,
    password: string,
    name: string,
    orgName: string,
    currency: string
  ) => Promise<{ user: User; orgId: string }>
  signOut: () => Promise<void>
  signInGoogle: () => Promise<{ user: User; orgId?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (firebaseUser) {
        hadUser.current = true
        return
      }

      // The Firebase SDK has no user. The server session (HttpOnly cookie, invisible to scripts)
      // must not outlive it: drop it when the user was signed in a moment ago (sign-out in another
      // tab, revoked or deleted account) or when we are on an app page that the proxy let through
      // on a cookie whose SDK user is gone. On an app page, also leave for /login.
      const onAppPage = isAppPath(window.location.pathname)
      if (hadUser.current || onAppPage) {
        hadUser.current = false
        void clearSession().finally(() => {
          if (onAppPage) window.location.replace('/login')
        })
      }
    })
    return unsubscribe
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signOut: firebaseSignOut,
    signInGoogle: firebaseSignInWithGoogle,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
```

In `app/(auth)/register/page.tsx` delete both lines `document.cookie = '__session=1; path=/; max-age=86400; SameSite=Lax'` (one in `handleSubmit`, one in `handleGoogle`).

In `app/(auth)/login/page.tsx`:
- add the import `import { safeRedirectPath } from '@/lib/auth/paths'`;
- delete both `document.cookie = '__session=1; …'` lines;
- in `handleSubmit` replace

```ts
      if (orgs.length > 0) {
        router.push(`/${orgs[0].id}/transactions`)
      } else {
        router.push('/register')
      }
```

with

```ts
      if (orgs.length > 0) {
        const target = safeRedirectPath(new URLSearchParams(window.location.search).get('redirect'))
        router.push(target ?? `/${orgs[0].id}/transactions`)
      } else {
        router.push('/register')
      }
```

- in `handleGoogle` replace

```ts
      if (orgs.length > 0) {
        router.push(`/${orgs[0].id}/transactions`)
      } else {
        router.push('/register?step=org')
      }
```

with

```ts
      if (orgs.length > 0) {
        const target = safeRedirectPath(new URLSearchParams(window.location.search).get('redirect'))
        router.push(target ?? `/${orgs[0].id}/transactions`)
      } else {
        router.push('/register?step=org')
      }
```

Verify no cookie writes remain: `cd /f/AI/finflow && grep -rn "document.cookie" app lib components` → expect no output.

- [ ] **Step 6: Run checks**

Run: `cd /f/AI/finflow && npm run test:unit && npm run typecheck && npm run lint`
Expected: green; lint 0 errors. If the React Compiler lint complains about the `hadUser` ref write inside the subscription callback, it is a false positive (the write is in an event callback, not render): add `// eslint-disable-next-line react-hooks/refs` only on the offending line and note it in the commit message; do not demote rules.

- [ ] **Step 7: Commit**

```bash
cd /f/AI/finflow && git add lib app tests && git commit -m "feat(auth): browser session sync, verification mail, login honours redirect" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `proxy.ts` verifies the session

**Files:**
- Rewrite: `proxy.ts`
- Test: `tests/unit/proxy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/proxy.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HttpError } from '@/lib/server/http-error'
import { proxy } from '@/proxy'

const auth = vi.hoisted(() => ({ isSessionCookieValid: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ isSessionCookieValid: auth.isSessionCookieValid }))

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `__session=${cookie}` } : {},
  })
}

const isNext = (res: Response) => res.headers.get('x-middleware-next') === '1'

beforeEach(() => {
  auth.isSessionCookieValid.mockReset()
})

describe('proxy: app pages', () => {
  it('redirects to /login with the original path when there is no cookie, without verifying anything', async () => {
    const res = await proxy(request('/org1/transactions?month=2026-10'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?redirect=%2Forg1%2Ftransactions%3Fmonth%3D2026-10',
    )
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(auth.isSessionCookieValid).not.toHaveBeenCalled()
  })

  it('redirects and clears a cookie that fails verification (e.g. the old "1")', async () => {
    auth.isSessionCookieValid.mockResolvedValue(false)

    const res = await proxy(request('/org1/transactions', '1'))

    expect(auth.isSessionCookieValid).toHaveBeenCalledWith('1')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Forg1%2Ftransactions')
    expect(res.headers.get('set-cookie')).toMatch(/__session=;/)
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/)
  })

  it('lets a valid session through', async () => {
    auth.isSessionCookieValid.mockResolvedValue(true)

    const res = await proxy(request('/org1/settings', 'good'))

    expect(isNext(res)).toBe(true)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('answers 503 (and keeps the cookie) when verification fails on our side', async () => {
    auth.isSessionCookieValid.mockRejectedValue(new HttpError(503, 'auth unavailable'))

    const res = await proxy(request('/org1/settings', 'good'))

    expect(res.status).toBe(503)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})

describe('proxy: auth pages', () => {
  it.each(['/login', '/register'])('sends a valid session on %s to /', async (path) => {
    auth.isSessionCookieValid.mockResolvedValue(true)

    const res = await proxy(request(path, 'good'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('shows /login to a visitor with an invalid cookie and clears it', async () => {
    auth.isSessionCookieValid.mockResolvedValue(false)

    const res = await proxy(request('/login', 'stale'))

    expect(isNext(res)).toBe(true)
    expect(res.headers.get('set-cookie')).toMatch(/__session=;/)
  })

  it('shows /login to an anonymous visitor untouched', async () => {
    const res = await proxy(request('/login'))

    expect(isNext(res)).toBe(true)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(auth.isSessionCookieValid).not.toHaveBeenCalled()
  })
})

describe('proxy: other pages', () => {
  it.each(['/', '/pricing', '/forgot-password'])('does not verify anything on %s', async (path) => {
    const res = await proxy(request(path, 'whatever'))

    expect(isNext(res)).toBe(true)
    expect(auth.isSessionCookieValid).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/proxy.test.ts`
Expected: FAIL (the old proxy is synchronous and only checks presence).

- [ ] **Step 3: Implement**

Replace `proxy.ts` with:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAppPath, isAuthPath, safeRedirectPath } from '@/lib/auth/paths'
import { isSessionCookieValid } from '@/lib/server/auth'
import { SESSION_COOKIE_NAME, isSecureCookieEnv } from '@/lib/server/session-cookie'

function withClearedSession(res: NextResponse): NextResponse {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookieEnv(),
  })
  return res
}

// Page-navigation gate (Next 16 `proxy`, Node runtime). It verifies the signature and expiry of the
// `__session` cookie but NOT revocation (that would be a network round-trip per navigation); every
// API route re-checks with revocation. Firestore data is protected by security rules, not by this file.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const authPage = isAuthPath(pathname)
  if (!authPage && !isAppPath(pathname)) return NextResponse.next()

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  let valid = false
  if (cookie) {
    try {
      valid = await isSessionCookieValid(cookie)
    } catch {
      // Our auth backend failed: do not log everybody out, and do not let anyone in either.
      return new NextResponse('Authentication service unavailable', { status: 503 })
    }
  }

  if (valid) {
    return authPage ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next()
  }

  let res: NextResponse
  if (authPage) {
    res = NextResponse.next()
  } else {
    const loginUrl = new URL('/login', request.url)
    const back = safeRedirectPath(pathname + search)
    if (back) loginUrl.searchParams.set('redirect', back)
    res = NextResponse.redirect(loginUrl)
  }
  return cookie ? withClearedSession(res) : res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
```

- [ ] **Step 4: Run it to verify it passes; then check the bundle accepts the server-only imports**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/proxy.test.ts && npm run typecheck`
Expected: PASS.

Then build, because `proxy.ts` now imports modules that `import 'server-only'` and `firebase-admin`:

Run: `cd /f/AI/finflow && npm run build`
Expected: build succeeds. **Contingency (only if it fails):** if the error says `server-only` cannot be imported from the proxy bundle, remove the `import 'server-only'` line from `lib/server/session-cookie.ts` only (it is pure and holds no secrets) and add a one-line comment `// No 'server-only': imported by proxy.ts, which Next bundles in a layer where that package throws.`; the same applies to `lib/server/auth.ts` **only if the error names it**, in which case move `isSessionCookieValid` into a new file `lib/server/session-check.ts` (without the `server-only` import, importing `getAdmin` from `@/lib/server/firebase-admin`) and re-point `proxy.ts` and `tests/unit/proxy.test.ts` (`vi.mock` path) to it, re-exporting nothing from `auth.ts`. If the proxy fails at runtime with an `ERR_REQUIRE_ESM`-style error, run `npm run check:server-imports` and report; do not change dependencies on your own.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add proxy.ts tests/unit/proxy.test.ts lib && git commit -m "feat(auth): proxy verifies the session cookie" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Soft email-verification banner

**Files:**
- Create: `components/auth/VerifyEmailBanner.tsx`
- Modify: `app/(app)/[orgSlug]/layout.tsx`

(Browser-only behaviour; covered by the E2E in Task 12. No unit test: the component is a thin shell over Firebase SDK calls.)

- [ ] **Step 1: Create the component**

Create `components/auth/VerifyEmailBanner.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/useAuth'

const RESEND_COOLDOWN_MS = 60_000

// Soft verification: the app stays usable, sensitive actions (connecting a bank) are blocked on the
// server until the address is verified. Shows nothing for verified users (including Google sign-ins).
export default function VerifyEmailBanner() {
  const { user } = useAuth()
  const [, rerender] = useState(0)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  // user.reload() updates the same User object in place, so force a render afterwards.
  const refresh = useCallback(async () => {
    if (!user || user.emailVerified) return
    try {
      await user.reload()
      rerender((n) => n + 1)
    } catch {
      // Offline or token problem: try again on the next focus.
    }
  }, [user])

  useEffect(() => {
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  if (!user || user.emailVerified) return null

  const handleResend = async () => {
    if (sentAt !== null && Date.now() - sentAt < RESEND_COOLDOWN_MS) {
      toast.message('Лист уже надіслано. Зачекайте хвилину.')
      return
    }
    setSending(true)
    try {
      await sendEmailVerification(user)
      setSentAt(Date.now())
      toast.success('Лист надіслано')
    } catch {
      toast.error('Не вдалося надіслати лист. Спробуйте пізніше.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="status"
      data-testid="verify-email-banner"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900"
    >
      <p>
        Підтвердіть email <strong>{user.email}</strong>, щоб підключати банки. Лист із посиланням уже в
        вашій скриньці.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={sending}>
        {sending ? 'Надсилаємо…' : 'Надіслати лист ще раз'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Mount it**

In `app/(app)/[orgSlug]/layout.tsx` add the import `import VerifyEmailBanner from '@/components/auth/VerifyEmailBanner'` next to the other imports, and replace

```tsx
      <main className="flex-1 bg-[#f9fafb] overflow-auto">
        {children}
      </main>
```

with

```tsx
      <main className="flex-1 bg-[#f9fafb] overflow-auto">
        <VerifyEmailBanner />
        {children}
      </main>
```

- [ ] **Step 3: Check**

Run: `cd /f/AI/finflow && npm run typecheck && npm run lint`
Expected: clean (0 errors). If the React Compiler complains about reading `user.emailVerified` (a mutable external object) during render, keep the code and add `// eslint-disable-next-line react-hooks/<rule-name-from-the-message>` on that single line; do not demote rules globally.

- [ ] **Step 4: Commit**

```bash
cd /f/AI/finflow && git add components/auth app && git commit -m "feat(auth): soft email-verification banner" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Route coverage test (every route authenticates)

**Files:**
- Test: `tests/unit/server/route-auth-coverage.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/unit/server/route-auth-coverage.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const API_ROOT = join(import.meta.dirname, '..', '..', '..', 'app', 'api')

// Routes that authenticate some other way (or are deliberately public). Each needs a reason.
const ALLOW_LIST: Record<string, string> = {
  'auth/session': 'verifies the freshly issued ID token itself and mints the session',
  'auth/logout': 'clears the session; must work with a missing or broken one',
  health: 'public liveness probe',
}

function routeFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...routeFiles(full))
    else if (entry === 'route.ts') found.push(full)
  }
  return found
}

function routeKey(file: string): string {
  return relative(API_ROOT, file).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
}

describe('API route authentication coverage', () => {
  const files = routeFiles(API_ROOT)
  const keys = files.map(routeKey)

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(keys.filter((k) => !(k in ALLOW_LIST)))('%s calls requireUser or requireVerifiedUser', (key) => {
    const source = readFileSync(join(API_ROOT, key, 'route.ts'), 'utf8')
    expect(source).toMatch(/\brequire(Verified)?User\(/)
  })

  it('does not keep allow-list entries for routes that no longer exist', () => {
    for (const key of Object.keys(ALLOW_LIST)) {
      expect(keys, `allow-listed route ${key} does not exist`).toContain(key)
    }
  })

  it('no route still reads a Bearer token', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), routeKey(file)).not.toMatch(/Bearer \(|requireUserFromBearer/)
    }
  })
})
```

(The last test's regex only targets the removed helper and a Bearer *parser*; the callback route legitimately sends `Authorization: Bearer ${token}` to Enable Banking, which does not match `Bearer \(`.)

- [ ] **Step 2: Run it**

Run: `cd /f/AI/finflow && npx vitest run tests/unit/server/route-auth-coverage.test.ts`
Expected: PASS. Sanity check that it can fail: temporarily remove the `requireUser(req)` call from `app/api/enablebanking/institutions/route.ts`, rerun, see the `enablebanking/institutions` case FAIL, then restore the file with `git checkout app/api/enablebanking/institutions/route.ts`.

- [ ] **Step 3: Commit**

```bash
cd /f/AI/finflow && git add tests/unit/server/route-auth-coverage.test.ts && git commit -m "test(auth): every API route must authenticate (explicit allow-list)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end tests on the emulators

**Files:**
- Create: `tests/e2e/helpers/emulator-auth.ts`, `tests/e2e/session-auth.spec.ts`
- Modify: `tests/e2e/api-guards.spec.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Emulator helper**

Create `tests/e2e/helpers/emulator-auth.ts`:

```ts
import type { APIRequestContext } from '@playwright/test'

const API_KEY = 'demo-api-key'
const PROJECT = 'demo-finflow'

function emulatorHost(): string {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST is not set (run inside firebase emulators:exec)')
  return host
}

function identityToolkit(method: string): string {
  return `http://${emulatorHost()}/identitytoolkit.googleapis.com/v1/${method}?key=${API_KEY}`
}

async function ok(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string): Promise<void> {
  if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`)
}

/**
 * Marks the email verified the way a real user would: it applies the VERIFY_EMAIL code that the
 * Auth emulator recorded (the app requests one at sign-up; REST-created users get one from
 * createEmulatorUser). The ID token's `email_verified` claim does NOT change; only the user record does.
 */
export async function verifyEmailInEmulator(request: APIRequestContext, email: string): Promise<void> {
  const list = await request.get(`http://${emulatorHost()}/emulator/v1/projects/${PROJECT}/oobCodes`)
  await ok(list, 'list oob codes')
  const { oobCodes } = (await list.json()) as {
    oobCodes: { email: string; requestType: string; oobCode: string }[]
  }
  const match = [...oobCodes].reverse().find((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')
  if (!match) throw new Error(`no VERIFY_EMAIL code recorded for ${email}`)
  await ok(await request.post(identityToolkit('accounts:update'), { data: { oobCode: match.oobCode } }), 'apply oob code')
}

/** Creates an Auth-emulator user (no organization) and returns a fresh ID token. */
export async function createEmulatorUser(
  request: APIRequestContext,
  opts: { verified?: boolean } = {},
): Promise<{ email: string; idToken: string }> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@finflow.test`
  const signUp = await request.post(identityToolkit('accounts:signUp'), {
    data: { email, password: 'e2e-pass-123456', returnSecureToken: true },
  })
  await ok(signUp, 'signUp')
  const { idToken } = (await signUp.json()) as { idToken: string }

  if (opts.verified) {
    await ok(
      await request.post(identityToolkit('accounts:sendOobCode'), {
        data: { requestType: 'VERIFY_EMAIL', idToken },
      }),
      'sendOobCode',
    )
    await verifyEmailInEmulator(request, email)
  }
  return { email, idToken }
}
```

- [ ] **Step 2: The session E2E spec**

Create `tests/e2e/session-auth.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { createEmulatorUser, verifyEmailInEmulator } from './helpers/emulator-auth'

const ORIGIN = 'http://localhost:3000'
const NEEDS_EMULATORS =
  'Needs the Auth + Firestore emulators. Run: firebase emulators:exec --only auth,firestore --project demo-finflow "npm run test:e2e"'

// Filling a controlled input before React hydrates loses the value, so wait for hydration.
async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel)
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'))
  }, selector)
}

async function registerViaUi(page: Page): Promise<{ email: string; orgId: string }> {
  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const email = `session-${runId}@finflow.test`
  await page.goto('/register')
  await waitForHydration(page, '#name')
  await page.getByLabel('Your name', { exact: true }).fill('Session Tester')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('session-pass-123')
  await page.getByLabel('Company name', { exact: true }).fill(`Session Co ${runId}`)
  await page.getByRole('button', { name: 'Try 14 days free' }).click()
  await page.waitForURL(/\/[A-Za-z0-9]{20}\/transactions$/)
  return { email, orgId: new URL(page.url()).pathname.split('/')[1] }
}

const VICTIM_BODY = { aspspName: 'Bank Millennium', aspspCountry: 'PL', orgId: 'victim-org' }

test.describe('server session (emulators)', () => {
  test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST, NEEDS_EMULATORS)

  test('a forged __session cookie is rejected by the proxy and cleared', async ({ page, context }) => {
    await context.addCookies([{ name: '__session', value: '1', url: ORIGIN }])

    await page.goto('/some-org/transactions')

    await page.waitForURL(/\/login\?redirect=%2Fsome-org%2Ftransactions$/)
    expect((await context.cookies()).find((c) => c.name === '__session')).toBeUndefined()
  })

  test('API routes reject forged and missing sessions with 401', async ({ request }) => {
    const forged = await request.post('/api/enablebanking/session', {
      headers: { Cookie: '__session=1', Origin: ORIGIN },
      data: VICTIM_BODY,
    })
    expect(forged.status()).toBe(401)
    expect((await request.get('/api/enablebanking/institutions?country=PL', { headers: { Cookie: '__session=1' } })).status()).toBe(401)
  })

  test('/api/auth/session refuses a bad Origin, a missing Origin and a garbage token', async ({ request }) => {
    const user = await createEmulatorUser(request)
    expect((await request.post('/api/auth/session', { headers: { Origin: 'https://evil.example' }, data: { idToken: user.idToken } })).status()).toBe(403)
    expect((await request.post('/api/auth/session', { data: { idToken: user.idToken } })).status()).toBe(403)
    expect((await request.post('/api/auth/session', { headers: { Origin: ORIGIN }, data: { idToken: 'garbage' } })).status()).toBe(401)
  })

  test('registration sets an HttpOnly session cookie; unverified email gates the bank; verifying lifts the gate; cross-origin POST is refused', async ({ page, request }) => {
    const { email } = await registerViaUi(page)

    // The cookie is a real, script-invisible session (not the old "1").
    const cookie = (await page.context().cookies()).find((c) => c.name === '__session')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    expect(cookie?.value).not.toBe('1')
    expect(await page.evaluate(() => document.cookie)).not.toContain('__session')

    // Soft verification: the app is usable, the banner shows, the bank is blocked.
    await expect(page.getByTestId('verify-email-banner')).toBeVisible()
    const gated = await page.context().request.post('/api/enablebanking/session', {
      headers: { Origin: ORIGIN },
      data: VICTIM_BODY,
    })
    expect(gated.status()).toBe(403)
    expect(await gated.json()).toEqual({ error: 'email_not_verified' })

    // A cross-origin POST with the valid cookie is refused before anything else.
    const csrf = await page.context().request.post('/api/enablebanking/session', {
      headers: { Origin: 'https://evil.example' },
      data: VICTIM_BODY,
    })
    expect(csrf.status()).toBe(403)
    expect(await csrf.json()).toEqual({ error: 'forbidden' })

    // The user follows the mail link (emulator), comes back: banner gone, gate lifted
    // (the request now fails later, on membership of the foreign org).
    await verifyEmailInEmulator(request, email)
    await page.reload()
    await expect(page.getByTestId('verify-email-banner')).toHaveCount(0)
    const verified = await page.context().request.post('/api/enablebanking/session', {
      headers: { Origin: ORIGIN },
      data: VICTIM_BODY,
    })
    expect(verified.status()).toBe(403)
    expect(await verified.json()).toEqual({ error: 'forbidden' })
  })

  test('signing out revokes the session server-side', async ({ page, request }) => {
    await registerViaUi(page)
    const old = (await page.context().cookies()).find((c) => c.name === '__session')?.value
    expect(old).toBeTruthy()

    // Revocation is second-granular: make sure it happens after the sign-in second.
    await page.waitForTimeout(1_100)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/login$/)
    expect((await page.context().cookies()).find((c) => c.name === '__session')).toBeUndefined()

    // A copied cookie no longer works on the API (the proxy deliberately skips the revocation check).
    const replay = await request.post('/api/enablebanking/session', {
      headers: { Cookie: `__session=${old}`, Origin: ORIGIN },
      data: VICTIM_BODY,
    })
    expect(replay.status()).toBe(401)
  })
})
```

**Contingency for the revocation test:** the Auth emulator must implement `tokensValidAfterTime` for session cookies. If the replay returns something other than 401 *and* a manual check against the emulator shows `revokeRefreshTokens` has no effect there, mark that single test `test.fixme(...)` with a comment naming the emulator limitation (revocation stays covered by the unit tests in Task 5 and by the production smoke in Task 14). Do not weaken the other tests.

- [ ] **Step 3: Update the existing e2e specs**

`tests/e2e/api-guards.spec.ts`: rename the test `'Enable Banking routes require a bearer token (401)'` to `'Enable Banking routes require a session cookie (401)'`; its body stays as is (no cookie → 401 before any Firebase access).

`tests/e2e/smoke.spec.ts`: add the import `import { createEmulatorUser } from './helpers/emulator-auth'` and replace the whole test `'Enable Banking session from a signed-in non-member -> 403 (criterion 4)'` with:

```ts
  test('Enable Banking session from a verified non-member -> 403 (criterion 4)', async ({ request }) => {
    // A real Auth-emulator user with a verified email who belongs to no organization. The route
    // runs requireVerifiedUser and requireOrgMember before createJwt, so it answers 403 without
    // calling Enable Banking.
    const user = await createEmulatorUser(request, { verified: true })
    const mint = await request.post('/api/auth/session', {
      headers: { Origin: 'http://localhost:3000' },
      data: { idToken: user.idToken },
    })
    expect(mint.status()).toBe(204)

    const res = await request.post('/api/enablebanking/session', {
      headers: { Origin: 'http://localhost:3000' },
      data: { aspspName: 'Bank Millennium', aspspCountry: 'PL', orgId: 'victim-org' },
    })
    expect(res.status()).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
  })
```

- [ ] **Step 4: Run the whole e2e suite on the emulators**

Run (takes several minutes; use a 10-minute timeout):

```bash
cd /f/AI/finflow && export PATH="$HOME/.jre/temurin-21/bin:$PATH" && firebase emulators:exec --only auth,firestore --project demo-finflow "npm run test:e2e"
```

Expected: all specs pass (13 previous + the new ones; the smoke register→cash-flow test must still pass with the cookie now minted at sign-up). If a proxy request returns 503 for a garbage cookie (`__session=1`), the real SDK error code for an undecodable cookie is not in `TOKEN_ERROR_CODES`: read the logged code from the dev-server output (`verifySessionCookie failed <code>`), add that exact code to the set in `lib/server/auth.ts` and a case for it in the `it.each` list in `tests/unit/server/auth.test.ts`, then rerun.

- [ ] **Step 5: Commit**

```bash
cd /f/AI/finflow && git add tests/e2e && git commit -m "test(auth): e2e for forged cookie, HttpOnly session, verification gate, CSRF, revocation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentation

**Files:**
- Modify: `CLAUDE.md`, `PROGRESS.md`, `docs/superpowers/specs/2026-10-23-s01-session-auth-design.md`

- [ ] **Step 1: CLAUDE.md**

Read `CLAUDE.md`. Replace the **Proxy** bullet (line 12: ``- **Proxy:** `proxy.ts` — … S01 replaces it with a verified server session.``) with:

```md
- **Proxy:** `proxy.ts` — the Next 16 name for middleware (Node.js runtime). It verifies the signature and expiry of the `__session` cookie (not revocation) on app and auth pages and redirects to `/login?redirect=…` otherwise. Firestore data is protected by security rules, not by the proxy.
- **Auth/session (S01):** after every Firebase sign-in the browser calls `POST /api/auth/session` with a fresh ID token; the server mints an HttpOnly 7-day Firebase session cookie (`__session`). API routes call `requireUser(req)` / `requireVerifiedUser(req)` from `lib/server/auth.ts` (revocation-checked; POST/PUT/PATCH/DELETE also require a same-origin `Origin`). There is no Bearer-token auth. Every route under `app/api` must call one of them or be on the allow-list in `tests/unit/server/route-auth-coverage.test.ts`. Sign-out calls `POST /api/auth/logout` (revokes refresh tokens). Never write `__session` from client code.
```

If CLAUDE.md contains any other mention of Bearer tokens for the Enable Banking routes, update it to say they use the session cookie.

- [ ] **Step 2: PROGRESS.md**

Read `PROGRESS.md`. Add an S01 entry in the same style as the S00 entry (status, what shipped, test counts from the final run in Task 14, date 2026-10-23). In "Known follow-ups": delete the line saying `proxy.ts` only checks the cookie's presence; delete the follow-up about binding OAuth state to the browser session (done: the callback requires the session uid to equal the state uid); keep email-verification-at-signup but reword it to "email verification is soft: only bank connection is gated; extend the gated actions in later sub-projects"; add: "Proxy does not check revocation, so a revoked cookie can load app pages until it expires (API calls are always revoked-checked); consider a cheap revocation signal if this matters" and "Session is an absolute 7 days with no silent renewal".

- [ ] **Step 3: Spec refinements**

Append to `docs/superpowers/specs/2026-10-23-s01-session-auth-design.md` a section `## Уточнення під час планування (2026-10-23)` with these seven items in Ukrainian: (1) сесія абсолютні 7 днів, тихого оновлення немає (воно суперечило правилу `auth_time` ≤ 5 хв); (2) `requireVerifiedUser` читає живий запис користувача (`getUser`), а не claim у cookie; (3) `proxy` не перевіряє відкликання, тож відкликана cookie може відкривати сторінки до закінчення терміну, а API її відхиляє (E2E перевіряє відкликання на API); (4) `/login` споживає `?redirect=` через `safeRedirectPath`; (5) спільні правила шляхів у `lib/auth/paths.ts`; (6) порядок у `requireUser`: спочатку сесія (401), потім `Origin` (403); (7) текст банера українською. Also edit §1 of the spec: remove the bullet/sentence about silently renewing an expired cookie, and in the Testing section E2E item 3 remove the clause "`proxy` більше не пускає". Change the status line to `**дизайн затверджено** (2026-10-23), спека затверджена користувачем`.

- [ ] **Step 4: Commit**

```bash
cd /f/AI/finflow && git add CLAUDE.md PROGRESS.md docs && git commit -m "docs: S01 session auth (CLAUDE.md, PROGRESS.md, spec refinements)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Full verification, PR, production check

**Files:** none (verification and release).

- [ ] **Step 1: Full local verification**

Run each and record the counts:

```bash
cd /f/AI/finflow && npm run lint && npm run typecheck && npm run check:server-imports && npm run test:unit
export PATH="$HOME/.jre/temurin-21/bin:$PATH"
cd /f/AI/finflow && npm run test:rules
cd /f/AI/finflow && firebase emulators:exec --only auth,firestore --project demo-finflow "npm run test:e2e"
cd /f/AI/finflow && npm run build
```

Expected: lint 0 errors; typecheck clean; `check:server-imports` OK; unit suite green (174 before + the new ones); rules 72 green (unchanged); e2e green; build succeeds. Also run: `cd /f/AI/finflow && grep -rn "__session=1\|document.cookie" app lib components proxy.ts` → expect no output. Put the real counts into the S01 entry in `PROGRESS.md` (amend the Task 13 text; commit as `docs: record S01 test counts`).

- [ ] **Step 2: Push the branch and open the PR**

```bash
cd /f/AI/finflow && git push -u origin s01-session-auth
cd /f/AI/finflow && gh pr create --title "S01: server session auth" --body "$(cat <<'EOF'
## Summary
- Replaces the client-set `__session=1` with a verified, revocable Firebase session cookie (HttpOnly, 7 days).
- `requireUser()` / `requireVerifiedUser()` for every API route; Bearer auth removed; same-origin check on unsafe methods.
- `proxy.ts` verifies the cookie; the Enable Banking callback is bound to the session user.
- Soft email verification: banner + bank connection gated.
- Spec: docs/superpowers/specs/2026-10-23-s01-session-auth-design.md; plan: docs/superpowers/plans/2026-10-23-s01-session-auth.md

## Test plan
- [ ] CI job `ci` green (lint, typecheck, unit, rules, e2e on emulators, build)
- [ ] Production smoke after merge (see plan Task 14, step 4)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then watch CI: `cd /f/AI/finflow && gh pr checks --watch`. Fix any CI-only failure on the branch (new commits), never by weakening a test.

- [ ] **Step 3: STOP and ask the user before merging**

Merging deploys to production (Vercel Git integration). Report the PR URL, CI result and the counts to the user and wait for an explicit "merge". Do not merge on your own.

- [ ] **Step 4: Production smoke (after the user approves the merge and Vercel finishes the master deployment)**

Check, against `https://finflow-chi-coral.vercel.app` (read-only, no real banking data):

1. `curl -s -o /dev/null -w "%{http_code}\n" https://finflow-chi-coral.vercel.app/api/health` → `200`.
2. `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Cookie: __session=1" https://finflow-chi-coral.vercel.app/anyorg/transactions` → `307` to `/login?redirect=%2Fanyorg%2Ftransactions`.
3. `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://finflow-chi-coral.vercel.app" -H "Cookie: __session=1" https://finflow-chi-coral.vercel.app/api/enablebanking/session` → `401`.
4. `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{"idToken":"x"}' https://finflow-chi-coral.vercel.app/api/auth/session` → `403`.
5. Ask the user to do the manual check: sign in on production, confirm the app works, open DevTools → Application → Cookies and confirm `__session` is `HttpOnly` and `Secure` and is not `1`; confirm the email banner appears for an unverified test account; sign out and confirm the redirect to `/login`. If sign-in shows an error from `/api/auth/session` (503), the Admin service account may lack permission to create session cookies: report it, do not guess.

- [ ] **Step 5: Close out**

After the user confirms production works: update `PROGRESS.md` (production verified date) via a small follow-up PR, update the memory file `finflow-project.md` (S01 done; next is S01A), and report to the user. Do not start S01A without its own brainstorming → spec → plan cycle.

---

## Self-review (done while writing)

**Spec coverage**

| Spec item | Task |
|---|---|
| `POST /api/auth/session` (fresh ID token, 5-min rule, cookie attributes) | 5 |
| `POST /api/auth/logout` (revoke + clear) | 5 |
| Client calls session after every sign-in; all `document.cookie` removed | 8 |
| SDK ⇄ cookie sync (revised: no silent renewal) | 8 (refinement 1) |
| `requireUser`, `requireVerifiedUser`, Origin check | 3, 4 |
| Bearer removed; EB routes migrated; coverage test | 6, 7, 11 |
| Callback bound to session uid | 6 |
| `proxy.ts` verification + safe redirect | 1, 9 |
| Soft email verification (mail at sign-up, banner, gate) | 8, 10, 6 |
| Unit + E2E tests (forged cookie, HttpOnly, revocation, banner, CSRF) | 1–11, 12 |
| Docs (CLAUDE.md, PROGRESS.md, spec) | 13 |
| Production verification, rules suite untouched | 14 |

**Placeholder scan:** no TBD/TODO; every code step has full code; the only conditional instructions are explicit contingencies (`server-only` in the proxy bundle, emulator revocation, unknown SDK error code) with the exact action to take.

**Type consistency:** `SessionUser { uid, emailVerified }`, `requireUser`, `requireVerifiedUser`, `isSessionCookieValid`, `toAuthHttpError(e, operation)` (Task 4) are the names used in Tasks 5, 6, 9; `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS`, `buildSessionCookie`, `buildClearedSessionCookie`, `readSessionCookie`, `isSecureCookieEnv` (Task 2) match Tasks 4, 5, 9; `assertSameOrigin` (Task 3) matches Tasks 4, 5; `establishSession`/`clearSession` (Task 8) match `auth.ts` and `useAuth.tsx`; `safeRedirectPath`/`isAppPath`/`isAuthPath` (Task 1) match Tasks 8, 9; fake-admin names `fakeTokens`, `fakeUnverified`, `fakeIdTokenAgeSec`, `fakeAdmin.auth.{verifyIdToken,verifySessionCookie,getUser,createSessionCookie,revokeRefreshTokens}` match Tasks 5, 6.

---

## Відхилення від плану під час виконання (2026-10-23)

Що змінилося під час рев'ю й виконання проти тексту задач вище:

- **Збій отримання ключів підпису Google → 503.** Admin SDK повідомляє його як `auth/argument-error`, неотличний від зіпсованої cookie за кодом; `isKeyFetchFailure` розпізнає його за фіксованим префіксом повідомлення, і `toAuthHttpError`/`isCredentialError` віддають 503, а не 401.
- **Proxy пильнує лише сторінки застосунку.** `/login` і `/register` не перевіряються й не редіректяться (правило «валідна cookie на /login → /» відкинуто: пастка застарілої cookie). Збій перевірки на нашому боці — 503 без очищення cookie.
- **`AuthProvider` дедуплікований:** один екземпляр у кореневому layout, вкладений у `(app)/layout.tsx` прибрано.
- **`loginUrlAfterSessionLoss`** (`lib/auth/paths.ts`): куди вести браузер, коли зник користувач SDK (`/login` після виходу, інакше `/login?redirect=…`).
- **Суворіший `safeRedirectPath`:** нормалізація й декодування URL, відхилення шляхів API, `//`, зворотних скісних рисок, керівних символів і сторінок автентифікації; `/login` поважає `redirect` лише коли є організація.
- **`ebFetch` очищає сесію на 401** і веде на `/login?redirect=…` (інакше proxy, що не бачить відкликання, повертав би з `/login` назад).
- **Шум у логах виходу:** хелпери `isCredentialError` і `errorKind`; відхилена cookie при виході не логується, інші збої логуються лише за кодом.
- **`/api/auth/session`:** 413 для тіла понад 8 КБ, 415 для не-JSON, закритий при відсутньому чи нечисловому `auth_time` (401 `reauth_required`).
- **Тест покриття роутів на кожен обробник**, а не лише на мутуючі методи (allow-list із причинами).
- **Гонка організації:** `loadSeq` у `useOrg`, `switchOrg` через `auth.currentUser`, реєстрація викликає `switchOrg(orgId)` явно; лист підтвердження best-effort, текст банера не обіцяє, що лист надіслано.
- **Додані тести крайніх випадків:** жива cookie без користувача SDK, open redirect і шлях повернення, межі розміру й типу тіла, відсутній `auth_time`, збій ключів підпису.
