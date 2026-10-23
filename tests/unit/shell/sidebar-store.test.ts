import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SIDEBAR_COLLAPSED_KEY,
  browserLocalStorage,
  createCollapsedStore,
  readCollapsed,
  writeCollapsed,
  type FlagStorage,
} from '@/lib/shell/sidebar-store'

function memoryStorage(initial: Record<string, string> = {}): FlagStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

// Private mode, blocked site data, a full quota: every call throws.
const brokenStorage: FlagStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readCollapsed', () => {
  it('is true only for the stored value "1"', () => {
    expect(readCollapsed(memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: '1' }))).toBe(true)
    expect(readCollapsed(memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: '0' }))).toBe(false)
    expect(readCollapsed(memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: 'yes' }))).toBe(false)
    expect(readCollapsed(memoryStorage())).toBe(false)
  })

  it('is false without storage or when reading throws', () => {
    expect(readCollapsed(null)).toBe(false)
    expect(readCollapsed(brokenStorage)).toBe(false)
  })
})

describe('writeCollapsed', () => {
  it('stores "1" / "0" and reports success', () => {
    const storage = memoryStorage()
    expect(writeCollapsed(storage, true)).toBe(true)
    expect(storage.data[SIDEBAR_COLLAPSED_KEY]).toBe('1')
    expect(writeCollapsed(storage, false)).toBe(true)
    expect(storage.data[SIDEBAR_COLLAPSED_KEY]).toBe('0')
  })

  it('reports failure instead of throwing', () => {
    expect(writeCollapsed(brokenStorage, true)).toBe(false)
    expect(writeCollapsed(null, true)).toBe(false)
  })
})

describe('createCollapsedStore', () => {
  it('starts from the stored value and persists every change', () => {
    const storage = memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: '1' })
    const store = createCollapsedStore(() => storage)
    expect(store.getSnapshot()).toBe(true)
    store.set(false)
    expect(store.getSnapshot()).toBe(false)
    // The next page load (a new store) reads the persisted value.
    expect(createCollapsedStore(() => storage).getSnapshot()).toBe(false)
  })

  it('keeps working in memory when storage throws', () => {
    const store = createCollapsedStore(() => brokenStorage)
    expect(store.getSnapshot()).toBe(false)
    expect(() => store.set(true)).not.toThrow()
    expect(store.getSnapshot()).toBe(true)
  })

  it('keeps working without any storage', () => {
    const store = createCollapsedStore(() => null)
    store.set(true)
    expect(store.getSnapshot()).toBe(true)
  })

  it('notifies subscribers until they unsubscribe', () => {
    const store = createCollapsedStore(() => memoryStorage())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.set(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('renders expanded on the server', () => {
    const store = createCollapsedStore(() => memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: '1' }))
    expect(store.getServerSnapshot()).toBe(false)
  })
})

describe('browserLocalStorage', () => {
  it('is null outside the browser', () => {
    expect(browserLocalStorage()).toBeNull()
  })

  it('is null when reading window.localStorage itself throws', () => {
    const blocked = {}
    Object.defineProperty(blocked, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
    vi.stubGlobal('window', blocked)
    expect(browserLocalStorage()).toBeNull()
  })
})
