import { describe, expect, it } from 'vitest'
import { effectiveSelection, summarizeAccounts } from '@/lib/utils/accounts'

const account = (balance: number, currency: string) => ({ balance, currency })

describe('summarizeAccounts', () => {
  it('gives a zero total for no accounts', () => {
    expect(summarizeAccounts([], 'PLN')).toEqual({ currency: 'PLN', total: 0, count: 0 })
  })

  it('sums a single account in the company currency', () => {
    expect(summarizeAccounts([account(1500.5, 'PLN')], 'PLN')).toEqual({ currency: 'PLN', total: 1500.5, count: 1 })
  })

  it('counts only the accounts in the company currency', () => {
    const accounts = [account(1000, 'PLN'), account(200, 'EUR'), account(50.25, 'PLN'), account(9, 'USD')]
    expect(summarizeAccounts(accounts, 'PLN')).toEqual({ currency: 'PLN', total: 1050.25, count: 2 })
  })

  it('gives zero when no account is in the company currency', () => {
    expect(summarizeAccounts([account(10, 'EUR')], 'PLN')).toEqual({ currency: 'PLN', total: 0, count: 0 })
  })

  it('includes negative balances', () => {
    expect(summarizeAccounts([account(300, 'UAH'), account(-450.5, 'UAH')], 'UAH')).toEqual({
      currency: 'UAH',
      total: -150.5,
      count: 2,
    })
  })

  it('rounds the floating-point sum to cents and never returns -0', () => {
    expect(summarizeAccounts([account(0.1, 'PLN'), account(0.2, 'PLN')], 'PLN').total).toBe(0.3)
    expect(Object.is(summarizeAccounts([account(-0.004, 'PLN')], 'PLN').total, 0)).toBe(true)
  })

  it('compares currency codes exactly', () => {
    expect(summarizeAccounts([account(5, 'pln')], 'PLN')).toEqual({ currency: 'PLN', total: 0, count: 0 })
  })
})

describe('effectiveSelection', () => {
  const accounts = [{ id: 'a1' }, { id: 'a2' }]

  it('keeps a selection that is among the loaded accounts', () => {
    expect(effectiveSelection('a2', accounts)).toBe('a2')
  })

  it('drops a selection whose account is gone (deleted elsewhere)', () => {
    expect(effectiveSelection('gone', accounts)).toBeNull()
    expect(effectiveSelection('a1', [])).toBeNull()
  })

  it('keeps "all accounts" as null', () => {
    expect(effectiveSelection(null, accounts)).toBeNull()
  })
})
