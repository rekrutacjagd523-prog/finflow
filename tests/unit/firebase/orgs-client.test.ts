import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgCreateError, createOrgViaApi } from '@/lib/firebase/orgs-client'

const fetchMock = vi.fn()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
  } catch (e) {
    return e instanceof OrgCreateError ? e.code : `other:${String(e)}`
  }
  return undefined
}

describe('createOrgViaApi', () => {
  it('posts name and currency same-origin and returns the new org id', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(json(201, { orgId: 'org123' }))

    await expect(createOrgViaApi('Acme', 'PLN')).resolves.toBe('org123')

    expect(fetchMock).toHaveBeenCalledWith('/api/orgs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme', currency: 'PLN' }),
    })
  })

  it.each([
    [409, { error: 'org_limit_reached' }, 'org_limit_reached'],
    [401, { error: 'unauthorized' }, 'unauthorized'],
    [400, { error: 'invalid_name' }, 'invalid'],
    [500, { error: 'internal' }, 'server'],
    [503, { error: 'auth unavailable' }, 'server'],
  ])('maps HTTP %s to the %s code', async (status, body, code) => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(json(status, body))
    expect(await codeOf(createOrgViaApi('A', 'PLN'))).toBe(code)
  })

  it('maps a network failure to "network"', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(createOrgViaApi('A', 'PLN'))).toBe('network')
  })

  it('treats a 201 without an orgId as a server error', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(json(201, {}))
    expect(await codeOf(createOrgViaApi('A', 'PLN'))).toBe('server')
  })

  it('has a human readable message for the limit error', () => {
    expect(new OrgCreateError('org_limit_reached').message).toMatch(/3 companies/)
  })
})
