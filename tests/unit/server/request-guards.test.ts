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
    ['a look-alike subdomain host', 'http://localhost.evil.example:3000'],
    ['a userinfo bypass attempt', 'http://localhost:3000@evil.example'],
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

  it('treats an uppercase scheme/host and the default port form as the request host', () => {
    expect(() => assertSameOrigin(req('POST', 'HTTP://LOCALHOST:3000'))).not.toThrow()
    expect(() =>
      assertSameOrigin(req('POST', 'https://finflow.test:443', 'https://finflow.test/api/x')),
    ).not.toThrow()
  })

  it('rejects a lowercase method with a foreign Origin', () => {
    expect(() => assertSameOrigin(req('post', 'https://evil.example'))).toThrow(HttpError)
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
