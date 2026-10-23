// Persisted "sidebar collapsed" flag (S01A). Every storage access is guarded: private mode,
// blocked site data or a throwing accessor must never break the shell; the flag then lives in
// memory for the rest of the page session. Shaped for React's useSyncExternalStore.

export const SIDEBAR_COLLAPSED_KEY = 'finflow:sidebar-collapsed'

export type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readCollapsed(storage: FlagStorage | null): boolean {
  if (!storage) return false
  try {
    return storage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCollapsed(storage: FlagStorage | null, collapsed: boolean): boolean {
  if (!storage) return false
  try {
    storage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    return true
  } catch {
    return false
  }
}

export interface CollapsedStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => boolean
  /** Server render and hydration: always expanded; the client snapshot follows right after. */
  getServerSnapshot: () => boolean
  set: (collapsed: boolean) => void
}

export function createCollapsedStore(getStorage: () => FlagStorage | null): CollapsedStore {
  // The last value set on this page wins over storage, so a failed write still toggles the UI.
  let memory: boolean | null = null
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => memory ?? readCollapsed(getStorage()),
    getServerSnapshot: () => false,
    set(collapsed) {
      memory = collapsed
      writeCollapsed(getStorage(), collapsed)
      for (const listener of listeners) listener()
    },
  }
}

/** `window.localStorage`, or null outside the browser or when reading the property throws. */
export function browserLocalStorage(): FlagStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
