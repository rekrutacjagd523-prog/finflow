import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { EB_STATE_TTL_SECONDS, signEbState, verifyEbState } from '@/lib/server/eb-state'
import { HttpError } from '@/lib/server/http-error'

const SECRET = 'unit-test-secret-0123456789abcdef'
const NOW = 1_800_000_000
const P = { orgId: 'org-acme', uid: 'user-alice' }

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

/** Builds a state string signed with `secret` around an arbitrary payload (used to forge edge cases). */
function forge(payloadJson: string, secret: string = SECRET): string {
  const payloadPart = b64url(payloadJson)
  const sig = createHmac('sha256', secret).update(payloadPart).digest('base64url')
  return `${payloadPart}.${sig}`
}

function expectHttpError(fn: () => unknown, status: number, message: string): void {
  let caught: unknown
  try {
    fn()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(HttpError)
  expect((caught as HttpError).status).toBe(status)
  expect((caught as HttpError).message).toBe(message)
}

describe('eb-state', () => {
  it('uses a 15 minute TTL', () => {
    expect(EB_STATE_TTL_SECONDS).toBe(900)
  })

  it('round-trips orgId and uid', () => {
    const state = signEbState(P, SECRET, NOW)
    expect(verifyEbState(state, SECRET, NOW)).toEqual(P)
  })

  it('produces base64url(JSON {o,u,n,e}) + "." + base64url(HMAC-SHA256)', () => {
    const state = signEbState(P, SECRET, NOW)
    const [payloadPart, sigPart, extra] = state.split('.')
    expect(extra).toBeUndefined()
    expect(payloadPart).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(sigPart).toBe(createHmac('sha256', SECRET).update(payloadPart).digest('base64url'))
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    expect(Object.keys(payload)).toEqual(['o', 'u', 'n', 'e'])
    expect(payload.o).toBe('org-acme')
    expect(payload.u).toBe('user-alice')
    expect(payload.n).toMatch(/^[0-9a-f]{16}$/)
    expect(payload.e).toBe(NOW + 900)
  })

  it('uses a fresh nonce on every call', () => {
    expect(signEbState(P, SECRET, NOW)).not.toBe(signEbState(P, SECRET, NOW))
  })

  it('defaults nowSec to the current time', () => {
    const state = signEbState(P, SECRET)
    expect(verifyEbState(state, SECRET)).toEqual(P)
  })

  it('is still valid exactly at the expiry second', () => {
    const state = signEbState(P, SECRET, NOW)
    expect(verifyEbState(state, SECRET, NOW + EB_STATE_TTL_SECONDS)).toEqual(P)
  })

  it('rejects an expired state with 400 "expired state"', () => {
    const state = signEbState(P, SECRET, NOW)
    expectHttpError(() => verifyEbState(state, SECRET, NOW + EB_STATE_TTL_SECONDS + 1), 400, 'expired state')
  })

  it('rejects a tampered payload', () => {
    const state = signEbState(P, SECRET, NOW)
    const [payloadPart, sigPart] = state.split('.')
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    payload.o = 'org-evil'
    const tampered = `${b64url(JSON.stringify(payload))}.${sigPart}`
    expectHttpError(() => verifyEbState(tampered, SECRET, NOW), 400, 'invalid state')
  })

  it('rejects a tampered signature', () => {
    const state = signEbState(P, SECRET, NOW)
    const [payloadPart, sigPart] = state.split('.')
    const flipped = (sigPart[0] === 'A' ? 'B' : 'A') + sigPart.slice(1)
    expectHttpError(() => verifyEbState(`${payloadPart}.${flipped}`, SECRET, NOW), 400, 'invalid state')
  })

  it('rejects a signature truncated by one character', () => {
    const state = signEbState(P, SECRET, NOW)
    expectHttpError(() => verifyEbState(state.slice(0, -1), SECRET, NOW), 400, 'invalid state')
  })

  it('rejects a state signed with a different secret', () => {
    const state = signEbState(P, 'some-other-secret', NOW)
    expectHttpError(() => verifyEbState(state, SECRET, NOW), 400, 'invalid state')
  })

  it('reports a forged expired state as invalid, not expired (signature is checked first)', () => {
    const forged = forge(JSON.stringify({ o: 'org-acme', u: 'user-alice', n: '0011223344556677', e: 1 }), 'attacker-secret')
    expectHttpError(() => verifyEbState(forged, SECRET, NOW), 400, 'invalid state')
  })

  it.each([
    ['empty string', ''],
    ['no dot', 'abc'],
    ['three parts', 'a.b.c'],
    ['only a dot', '.'],
    ['empty signature', 'abc.'],
    ['empty payload', '.abc'],
    ['non-base64url payload', 'a$b.c'],
    ['non-base64url signature', 'abc.d+f/'],
    ['whitespace', ' . '],
  ])('rejects a malformed state (%s)', (_label, state) => {
    expectHttpError(() => verifyEbState(state, SECRET, NOW), 400, 'invalid state')
  })

  it.each([
    ['not JSON', 'not json'],
    ['JSON null', 'null'],
    ['JSON array', '[]'],
    ['empty orgId', JSON.stringify({ o: '', u: 'user-alice', n: '0011223344556677', e: NOW + 60 })],
    ['missing uid', JSON.stringify({ o: 'org-acme', n: '0011223344556677', e: NOW + 60 })],
    ['missing nonce', JSON.stringify({ o: 'org-acme', u: 'user-alice', e: NOW + 60 })],
    ['string expiry', JSON.stringify({ o: 'org-acme', u: 'user-alice', n: '0011223344556677', e: String(NOW + 60) })],
    ['fractional expiry', JSON.stringify({ o: 'org-acme', u: 'user-alice', n: '0011223344556677', e: NOW + 0.5 })],
  ])('rejects a correctly signed but malformed payload (%s)', (_label, payloadJson) => {
    expectHttpError(() => verifyEbState(forge(payloadJson), SECRET, NOW), 400, 'invalid state')
  })

  it('throws 500 "server not configured" when the secret is empty', () => {
    expectHttpError(() => signEbState(P, '', NOW), 500, 'server not configured')
    const state = signEbState(P, SECRET, NOW)
    expectHttpError(() => verifyEbState(state, '', NOW), 500, 'server not configured')
  })

  it('refuses to sign without orgId or uid', () => {
    expect(() => signEbState({ orgId: '', uid: 'user-alice' }, SECRET, NOW)).toThrow('signEbState: orgId and uid are required')
    expect(() => signEbState({ orgId: 'org-acme', uid: '' }, SECRET, NOW)).toThrow('signEbState: orgId and uid are required')
  })
})
