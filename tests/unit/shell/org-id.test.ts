import { describe, expect, it } from 'vitest'
import { isValidOrgId } from '@/lib/shell/org-id'

describe('isValidOrgId', () => {
  it.each(['abc', 'Org_1-x', 'a'.repeat(20), 'a'.repeat(128), '_', '-', '_a_', '__a', 'a__', '__', '___'])('accepts %s', (id) => {
    expect(isValidOrgId(id)).toBe(true)
  })

  it.each([
    '',
    'a'.repeat(129),
    'a/b',
    'a.b',
    '.',
    '..',
    'a b',
    'a%2Fb',
    'org?x=1',
    'орг',
    '__reserved__',
    '____',
  ])('refuses %j', (id) => {
    expect(isValidOrgId(id)).toBe(false)
  })

  it('refuses values that are not strings', () => {
    expect(isValidOrgId(undefined)).toBe(false)
    expect(isValidOrgId(null)).toBe(false)
    expect(isValidOrgId(42)).toBe(false)
    expect(isValidOrgId({})).toBe(false)
  })
})
