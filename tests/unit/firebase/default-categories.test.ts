import { describe, expect, it } from 'vitest'
import { buildDefaultCategories } from '@/lib/firebase/default-categories'

describe('buildDefaultCategories', () => {
  it('seeds exactly the income defaults (the expense defaults are defined but not seeded yet)', () => {
    const seeds = buildDefaultCategories()
    expect(seeds.map((s) => s.name)).toEqual(['Продажі', 'Послуги', 'Інвестиції', 'Інше (дохід)'])
    expect(new Set(seeds.map((s) => s.type))).toEqual(new Set(['income']))
  })

  it('gives every default a unique, deterministic, path-safe document id', () => {
    const first = buildDefaultCategories().map((s) => s.id)
    const second = buildDefaultCategories().map((s) => s.id)
    expect(first).toEqual(second)
    expect(new Set(first).size).toBe(first.length)
    for (const id of first) expect(id).toMatch(/^default-income-[a-z0-9-]+$/)
  })

  it('keeps a colour on every default', () => {
    for (const seed of buildDefaultCategories()) expect(seed.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
