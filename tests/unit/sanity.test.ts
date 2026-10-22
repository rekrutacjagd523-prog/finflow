import 'server-only'
import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

// If the `server-only` alias in vitest.config.ts were missing, the import
// above would throw and this whole file would fail to load.
describe('vitest harness', () => {
  it('resolves the @/ alias to the repo root', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })

  it('runs in the node environment', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof process.versions.node).toBe('string')
  })
})
