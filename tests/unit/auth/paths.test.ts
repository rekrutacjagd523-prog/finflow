import { describe, expect, it } from 'vitest'
import { isAppPath, isAuthPath, isPublicPath, safeRedirectPath } from '@/lib/auth/paths'

describe('isPublicPath', () => {
  it.each(['/login', '/register', '/forgot-password', '/login/extra'])('is true for %s', (p) => {
    expect(isPublicPath(p)).toBe(true)
  })
  it.each([
    '/',
    '/pricing',
    '/org1/transactions',
    '/login-foo',
    '/loginx/transactions',
    '/registerx',
    '/forgot-password2',
  ])('is false for %s', (p) => {
    expect(isPublicPath(p)).toBe(false)
  })
})

describe('isAuthPath', () => {
  it.each(['/login', '/register'])('is true for %s', (p) => expect(isAuthPath(p)).toBe(true))
  it.each(['/forgot-password', '/', '/org1/settings', '/login-foo', '/registerx'])('is false for %s', (p) => {
    expect(isAuthPath(p)).toBe(false)
  })
})

describe('isAppPath', () => {
  it.each([
    '/org1/transactions',
    '/Ab_c-9/settings',
    '/org1/analytics/cashflow',
    '/loginabc/transactions',
    '/register1/settings',
  ])('is true for %s', (p) => {
    expect(isAppPath(p)).toBe(true)
  })
  it.each(['/', '/login', '/login/x', '/register', '/forgot-password', '/pricing', '/org1', '//evil/x'])(
    'is false for %s',
    (p) => expect(isAppPath(p)).toBe(false),
  )
})

describe('safeRedirectPath', () => {
  it.each(['/org1/settings', '/org1/transactions?month=2026-10', '/'])('accepts %s', (p) => {
    expect(safeRedirectPath(p)).toBe(p)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['relative without slash', 'org1/x'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['absolute URL', 'https://evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['newline', '/a\nb'],
    ['NUL', '/a\u0000b'],
    ['API path', '/api/enablebanking/x'],
    ['bare /api', '/api'],
    ['too long', '/' + 'a'.repeat(600)],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value as string | null | undefined)).toBeNull()
  })
})
