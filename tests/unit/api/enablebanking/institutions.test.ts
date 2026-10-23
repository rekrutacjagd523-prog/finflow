import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFakeAdmin, upstreamJson } from '@/tests/unit/helpers/fake-admin'
import { GET } from '@/app/api/enablebanking/institutions/route'

vi.mock('@/lib/server/firebase-admin', async () => {
  const { fakeAdmin: admin } = await import('@/tests/unit/helpers/fake-admin')
  return { getAdmin: () => admin }
})
vi.mock('@/lib/enablebanking/jwt', () => ({ createJwt: vi.fn(async () => 'eb-jwt') }))

const fetchMock = vi.fn()

function institutionsRequest(country: string | null, token?: string): Request {
  const url = new URL('http://localhost:3000/api/enablebanking/institutions')
  if (country !== null) url.searchParams.set('country', country)
  return new Request(url, { headers: token ? { Cookie: `__session=${token}` } : {} })
}

describe('GET /api/enablebanking/institutions', () => {
  let errorSpy: { mockRestore: () => void }

  beforeEach(() => {
    resetFakeAdmin()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('returns 401 without a session cookie', async () => {
    const res = await GET(institutionsRequest('PL'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 401 for a forged session cookie', async () => {
    const res = await GET(institutionsRequest('PL', 'token-forged'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a malformed country', async () => {
    const res = await GET(institutionsRequest('PL&psu_type=business', 'token-alice'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid country' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the same { institutions } shape as before for any signed-in user', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamJson({
        aspsps: [
          { name: 'Mock ASPSP', country: 'FI', logo: 'https://enablebanking.com/brands/FI/Mock/', bic: 'MOCKFIHH' },
          { name: 'Bank Millennium', country: 'PL' },
        ],
      }),
    )

    // mallory is signed in but belongs to no org: institutions only needs authentication.
    const res = await GET(institutionsRequest('FI', 'token-mallory'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      institutions: [
        {
          id: 'Mock ASPSP',
          name: 'Mock ASPSP',
          country: 'FI',
          logo: 'https://enablebanking.com/brands/FI/Mock/',
          bic: 'MOCKFIHH',
        },
        { id: 'Bank Millennium', name: 'Bank Millennium', country: 'PL', logo: null, bic: null },
      ],
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.enablebanking.com/aspsps?country=FI')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer eb-jwt')
  })

  it('defaults country to PL', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ aspsps: [] }))
    const res = await GET(institutionsRequest(null, 'token-alice'))
    expect(await res.json()).toEqual({ institutions: [] })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.enablebanking.com/aspsps?country=PL')
  })

  it('maps an Enable Banking failure to 502', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ message: 'unauthorized' }, 401))
    const res = await GET(institutionsRequest('PL', 'token-alice'))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'enable banking error' })
  })
})
