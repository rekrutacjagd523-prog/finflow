import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the three firebase-admin entry points so no real app, network or
// credentials are touched. vi.hoisted keeps the same vi.fn instances across
// vi.resetModules(), so the factories below always hand out these spies.
const sdk = vi.hoisted(() => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn(),
  initializeFirestore: vi.fn(),
  getAuth: vi.fn(),
}))

vi.mock('firebase-admin/app', () => ({
  getApps: sdk.getApps,
  initializeApp: sdk.initializeApp,
  cert: sdk.cert,
}))
vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: sdk.initializeFirestore,
}))
vi.mock('firebase-admin/auth', () => ({
  getAuth: sdk.getAuth,
}))

const fakeApp = { name: '[DEFAULT]' }
const fakeDb = { kind: 'firestore' }
const fakeAuth = { kind: 'auth' }
const fakeCredential = { kind: 'credential' }

// getAdmin() caches its result in module scope, so every test loads a fresh
// copy. HttpError is imported from the same fresh module registry: after
// vi.resetModules() a statically imported HttpError would be a different class
// and toBeInstanceOf would fail.
async function loadFresh() {
  vi.resetModules()
  const { getAdmin } = await import('@/lib/server/firebase-admin')
  const { HttpError } = await import('@/lib/server/http-error')
  return { getAdmin, HttpError }
}

beforeEach(() => {
  sdk.getApps.mockReset().mockReturnValue([])
  sdk.initializeApp.mockReset().mockReturnValue(fakeApp)
  sdk.cert.mockReset().mockReturnValue(fakeCredential)
  sdk.initializeFirestore.mockReset().mockReturnValue(fakeDb)
  sdk.getAuth.mockReset().mockReturnValue(fakeAuth)
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined)
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined)
  vi.stubEnv('VERCEL', undefined)
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', undefined)
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getAdmin', () => {
  it('throws HttpError 500 when FIREBASE_SERVICE_ACCOUNT is missing outside the emulator', async () => {
    const { getAdmin, HttpError } = await loadFresh()
    let caught: unknown
    try {
      getAdmin()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(HttpError)
    expect(caught).toMatchObject({ status: 500, message: 'server not configured' })
    expect(sdk.initializeApp).not.toHaveBeenCalled()
  })

  it('initialises from the base64 service account with REST Firestore', async () => {
    const serviceAccount = {
      type: 'service_account',
      project_id: 'finflow-test',
      client_email: 'sa@finflow-test.iam.gserviceaccount.com',
      private_key: 'not-a-real-key',
    }
    vi.stubEnv(
      'FIREBASE_SERVICE_ACCOUNT',
      Buffer.from(JSON.stringify(serviceAccount), 'utf8').toString('base64'),
    )
    const { getAdmin } = await loadFresh()

    const admin = getAdmin()

    expect(sdk.cert).toHaveBeenCalledWith(serviceAccount)
    expect(sdk.initializeApp).toHaveBeenCalledWith({ credential: fakeCredential })
    expect(sdk.initializeFirestore).toHaveBeenCalledWith(fakeApp, { preferRest: true })
    expect(sdk.getAuth).toHaveBeenCalledWith(fakeApp)
    expect(admin).toEqual({ db: fakeDb, auth: fakeAuth })
  })

  it('uses the emulator project without credentials when FIRESTORE_EMULATOR_HOST is set', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080')
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).toHaveBeenCalledWith({ projectId: 'demo-finflow' })
    expect(sdk.cert).not.toHaveBeenCalled()
    // REST needs Application Default Credentials even on the emulator; gRPC does not.
    expect(sdk.initializeFirestore).toHaveBeenCalledWith(fakeApp, { preferRest: false })
  })

  it('prefers NEXT_PUBLIC_FIREBASE_PROJECT_ID for the emulator project id', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-other')
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).toHaveBeenCalledWith({ projectId: 'demo-other' })
  })

  it('reuses an already-initialised default app (e.g. after a dev hot reload)', async () => {
    sdk.getApps.mockReturnValue([fakeApp])
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).not.toHaveBeenCalled()
    expect(sdk.initializeFirestore).toHaveBeenCalledWith(fakeApp, { preferRest: true })
  })

  it('is a lazy singleton: the SDK is initialised once per process', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080')
    const { getAdmin } = await loadFresh()

    expect(sdk.initializeApp).not.toHaveBeenCalled()
    const first = getAdmin()
    const second = getAdmin()

    expect(second).toBe(first)
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1)
    expect(sdk.initializeFirestore).toHaveBeenCalledTimes(1)
  })

  it('finds the default app by name instead of taking the first app', async () => {
    sdk.getApps.mockReturnValue([{ name: 'other' }, fakeApp])
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).not.toHaveBeenCalled()
    expect(sdk.initializeFirestore).toHaveBeenCalledWith(fakeApp, { preferRest: true })
  })

  it('initialises a default app when only non-default apps exist', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080')
    sdk.getApps.mockReturnValue([{ name: 'other' }])
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).toHaveBeenCalledTimes(1)
  })

  it('takes the emulator branch when only FIREBASE_AUTH_EMULATOR_HOST is set', async () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099')
    const { getAdmin } = await loadFresh()

    getAdmin()

    expect(sdk.initializeApp).toHaveBeenCalledWith({ projectId: 'demo-finflow' })
    expect(sdk.cert).not.toHaveBeenCalled()
  })

  describe('emulator hosts are refused in deployed environments', () => {
    // verifyIdToken accepts unsigned (alg none) tokens when the Auth emulator
    // host is set, so a leaked env var in production would be an auth bypass.
    it.each([
      ['VERCEL=1', 'FIREBASE_AUTH_EMULATOR_HOST', 'VERCEL', '1'],
      ['VERCEL=1', 'FIRESTORE_EMULATOR_HOST', 'VERCEL', '1'],
      ['NODE_ENV=production', 'FIREBASE_AUTH_EMULATOR_HOST', 'NODE_ENV', 'production'],
      ['NODE_ENV=production', 'FIRESTORE_EMULATOR_HOST', 'NODE_ENV', 'production'],
    ])('with %s and %s set: HttpError 500 and no initializeApp', async (_l, host, key, value) => {
      vi.stubEnv(key, value)
      vi.stubEnv(host, '127.0.0.1:9099')
      const { getAdmin, HttpError } = await loadFresh()

      let caught: unknown
      try {
        getAdmin()
      } catch (e) {
        caught = e
      }

      expect(caught).toBeInstanceOf(HttpError)
      expect(caught).toMatchObject({ status: 500, message: 'server not configured' })
      expect(sdk.initializeApp).not.toHaveBeenCalled()
    })

    it('does not refuse a production start without emulator hosts', async () => {
      vi.stubEnv('VERCEL', '1')
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', Buffer.from('{"a":1}').toString('base64'))
      const { getAdmin } = await loadFresh()

      expect(() => getAdmin()).not.toThrow()
    })
  })

  describe('malformed FIREBASE_SERVICE_ACCOUNT', () => {
    it('base64 of non-JSON: HttpError 500, no initializeApp, nothing leaked, not cached', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', 'bm90LWpzb24=') // "not-json"
      const { getAdmin, HttpError } = await loadFresh()

      let caught: unknown
      try {
        getAdmin()
      } catch (e) {
        caught = e
      }

      expect(caught).toBeInstanceOf(HttpError)
      expect(caught).toMatchObject({ status: 500, message: 'server not configured' })
      expect((caught as Error).cause).toBeUndefined()
      expect(sdk.initializeApp).not.toHaveBeenCalled()
      expect(JSON.stringify(log.mock.calls)).not.toContain('not-json')

      // The failure is not cached: a valid env on the next call works.
      const sa = { type: 'service_account', project_id: 'p' }
      vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', Buffer.from(JSON.stringify(sa)).toString('base64'))
      expect(getAdmin()).toEqual({ db: fakeDb, auth: fakeAuth })
      expect(sdk.cert).toHaveBeenCalledWith(sa)
    })

    it('cert() failure: HttpError 500, no initializeApp, secret not logged', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      sdk.cert.mockImplementation(() => {
        throw new Error('Invalid PEM: SECRET-KEY-MATERIAL')
      })
      vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', Buffer.from('{"a":1}').toString('base64'))
      const { getAdmin, HttpError } = await loadFresh()

      let caught: unknown
      try {
        getAdmin()
      } catch (e) {
        caught = e
      }

      expect(caught).toBeInstanceOf(HttpError)
      expect(caught).toMatchObject({ status: 500, message: 'server not configured' })
      expect((caught as Error).cause).toBeUndefined()
      expect(sdk.initializeApp).not.toHaveBeenCalled()
      expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET-KEY-MATERIAL')
    })
  })
})
