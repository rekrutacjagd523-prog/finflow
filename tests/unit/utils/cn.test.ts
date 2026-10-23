import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn with the FinFlow tokens', () => {
  it('lets a token radius replace a default radius', () => {
    expect(cn('rounded-lg px-2', 'rounded-control')).toBe('px-2 rounded-control')
    expect(cn('rounded-xl', 'rounded-panel')).toBe('rounded-panel')
  })

  it('lets a token shadow replace a default shadow', () => {
    expect(cn('shadow-md', 'shadow-pop')).toBe('shadow-pop')
  })

  it('treats token colours as colours, not as sizes', () => {
    expect(cn('text-sm text-foreground', 'text-ink')).toBe('text-sm text-ink')
    expect(cn('bg-primary', 'bg-brand-soft')).toBe('bg-brand-soft')
    expect(cn('border-input', 'border-line')).toBe('border-line')
    expect(cn('ring-1 ring-foreground/10', 'ring-line')).toBe('ring-1 ring-line')
  })
})
