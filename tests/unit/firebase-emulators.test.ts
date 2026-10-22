import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ kind: 'auth' })),
  connectAuthEmulator: sdk.connectAuthEmulator,
}))
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ kind: 'firestore' })),
  connectFirestoreEmulator: sdk.connectFirestoreEmulator,
}))
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({ kind: 'storage' })),
}))

const FLAG = '__finflowFirebaseEmulatorsConnected'

beforeEach(() => {
  vi.resetModules()
  sdk.connectAuthEmulator.mockClear()
  sdk.connectFirestoreEmulator.mockClear()
  delete (globalThis as Record<string, unknown>)[FLAG]
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('lib/firebase/firebase emulator wiring', () => {
  it('does not connect to emulators when NEXT_PUBLIC_USE_EMULATORS is not "1"', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', '')
    await import('@/lib/firebase/firebase')
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled()
    expect(sdk.connectFirestoreEmulator).not.toHaveBeenCalled()
  })

  it('connects Auth (127.0.0.1:9099) and Firestore (127.0.0.1:8080) when NEXT_PUBLIC_USE_EMULATORS=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', '1')
    const mod = await import('@/lib/firebase/firebase')
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1)
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(mod.auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1)
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(mod.db, '127.0.0.1', 8080)
  })

  it('connects only once when the module is evaluated again (Next.js HMR)', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', '1')
    await import('@/lib/firebase/firebase')
    vi.resetModules()
    await import('@/lib/firebase/firebase')
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1)
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1)
  })
})
