import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError } from '@/lib/server/http-error'

/** Lifetime of an Enable Banking OAuth `state` value: 15 minutes. */
export const EB_STATE_TTL_SECONDS = 900

/** Wire payload. Short keys keep the state (sent through the bank redirect) compact. */
type EbStatePayload = { o: string; u: string; n: string; e: number }

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/
const MAX_STATE_LENGTH = 2048

function currentSec(): number {
  return Math.floor(Date.now() / 1000)
}

function assertSecret(secret: string): void {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new HttpError(500, 'server not configured')
  }
}

function hmac(payloadPart: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadPart).digest('base64url')
}

function isPayload(value: unknown): value is EbStatePayload {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.o === 'string' &&
    r.o.length > 0 &&
    typeof r.u === 'string' &&
    r.u.length > 0 &&
    typeof r.n === 'string' &&
    r.n.length > 0 &&
    typeof r.e === 'number' &&
    Number.isInteger(r.e)
  )
}

/**
 * Signs `{ orgId, uid }` into an opaque `state` for POST https://api.enablebanking.com/auth.
 * Format: base64url(JSON {o, u, n, e}) + "." + base64url(HMAC-SHA256(secret, payloadPart)).
 */
export function signEbState(p: { orgId: string; uid: string }, secret: string, nowSec: number = currentSec()): string {
  assertSecret(secret)
  if (!p.orgId || !p.uid) throw new Error('signEbState: orgId and uid are required')
  const payload: EbStatePayload = {
    o: p.orgId,
    u: p.uid,
    n: randomBytes(8).toString('hex'),
    e: nowSec + EB_STATE_TTL_SECONDS,
  }
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadPart}.${hmac(payloadPart, secret)}`
}

/**
 * Verifies a `state` produced by signEbState.
 * Throws HttpError(400, 'invalid state') for any format or signature problem and
 * HttpError(400, 'expired state') when the signature is valid but the TTL has passed.
 */
export function verifyEbState(state: string, secret: string, nowSec: number = currentSec()): { orgId: string; uid: string } {
  assertSecret(secret)
  const invalid = () => new HttpError(400, 'invalid state')

  if (typeof state !== 'string' || state.length === 0 || state.length > MAX_STATE_LENGTH) throw invalid()
  const parts = state.split('.')
  if (parts.length !== 2) throw invalid()
  const [payloadPart, sigPart] = parts
  if (!BASE64URL_RE.test(payloadPart) || !BASE64URL_RE.test(sigPart)) throw invalid()

  // Constant-time comparison of the canonical base64url signature strings.
  const expected = Buffer.from(hmac(payloadPart, secret), 'utf8')
  const given = Buffer.from(sigPart, 'utf8')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid()

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    throw invalid()
  }
  if (!isPayload(payload)) throw invalid()
  if (nowSec > payload.e) throw new HttpError(400, 'expired state')
  return { orgId: payload.o, uid: payload.u }
}
