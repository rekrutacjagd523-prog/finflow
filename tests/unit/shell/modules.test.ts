import { describe, expect, it } from 'vitest'
import { MODULE_TABS, activeModule } from '@/lib/shell/modules'

describe('MODULE_TABS', () => {
  it('has only the shipped modules, in order', () => {
    expect(MODULE_TABS.map((t) => [t.key, t.label, t.href('org1')])).toEqual([
      ['transactions', 'Платежі', '/org1/transactions'],
      ['analytics', 'Аналітика', '/org1/analytics/cashflow'],
    ])
  })
})

describe('activeModule', () => {
  it.each([
    ['/org1/transactions', 'transactions'],
    ['/org1/analytics', 'analytics'],
    ['/org1/analytics/cashflow', 'analytics'],
    ['/org1/analytics/pl', 'analytics'],
  ])('%s -> %s', (path, key) => {
    expect(activeModule(path, 'org1')).toBe(key)
  })

  it.each([
    '/org1/settings/banks',
    '/org1/transactionsx',
    '/org1',
    '/org1/',
    '/org2/transactions',
    '/',
    '/analytics/org1',
  ])('%s -> null', (path) => {
    expect(activeModule(path, 'org1')).toBeNull()
  })
})
