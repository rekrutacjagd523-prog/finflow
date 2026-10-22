import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', undefined)
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', undefined)
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
})
