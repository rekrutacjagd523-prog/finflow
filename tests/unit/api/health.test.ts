import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import { GET, dynamic, runtime } from '@/app/api/health/route'

const admin = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/lib/server/firebase-admin', () => ({ getAdmin: admin.getAdmin }))

beforeEach(() => {
  admin.get.mockReset().mockResolvedValue({ exists: false, data: () => undefined })
  admin.doc.mockReset().mockReturnValue({ get: admin.get })
  admin.getAdmin.mockReset().mockReturnValue({ db: { doc: admin.doc } })
  vi.stubEnv('VERCEL_REGION', undefined)
})

describe('GET /api/health', () => {
  it('runs on the Node.js runtime and is never statically cached', () => {
    expect(runtime).toBe('nodejs')
    expect(dynamic).toBe('force-dynamic')
  })

  it('reads _meta/health with the Admin SDK and reports ok', async () => {
    const res = await GET()

    expect(admin.doc).toHaveBeenCalledWith('_meta/health')
    expect(admin.get).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, region: 'local', firestore: 'ok' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('reports the Vercel function region when deployed', async () => {
    vi.stubEnv('VERCEL_REGION', 'fra1')

    const res = await GET()

    expect(await res.json()).toEqual({ ok: true, region: 'fra1', firestore: 'ok' })
  })

  it('returns a generic 500 when Firestore is unreachable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    admin.get.mockRejectedValue(new Error('14 UNAVAILABLE: connection refused'))

    const res = await GET()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(log).toHaveBeenCalled()
  })

  it('returns 500 "server not configured" when the service account is missing', async () => {
    admin.getAdmin.mockImplementation(() => {
      throw new HttpError(500, 'server not configured')
    })

    const res = await GET()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server not configured' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
