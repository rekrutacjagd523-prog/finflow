import { describe, expect, it } from 'vitest'
import { currencySymbol, formatCurrency, splitCurrency } from '@/lib/utils/currency'

// The exact currency sign depends on the ICU data of the runtime (`грн` or `₴`), so these tests
// compare with formatCurrency instead of hard-coding it.
describe('splitCurrency', () => {
  it.each([
    [51450.4, 'UAH'],
    [-297.93, 'EUR'],
    [0, 'PLN'],
    [750.5, 'USD'],
  ])('%s %s joins back into formatCurrency, with the decimals apart', (amount, currency) => {
    const { whole, fraction, rest } = splitCurrency(amount, currency)
    expect(whole + fraction + rest).toBe(formatCurrency(amount, currency))
    expect(fraction).toMatch(/^,\d{2}$/)
    expect(whole).not.toContain(',')
  })

  it('keeps the sign and the thousands in the whole part', () => {
    const { whole, fraction } = splitCurrency(-51450.4, 'UAH')
    expect(whole.replace(/\D/g, '')).toBe('51450')
    expect(whole).toMatch(/^[-−]/)
    expect(fraction).toBe(',40')
  })

  it('has no fraction for a currency without minor units', () => {
    const { whole, fraction, rest } = splitCurrency(750, 'JPY')
    expect(fraction).toBe('')
    expect(rest).toBe('')
    expect(whole).toBe(formatCurrency(750, 'JPY'))
  })
})

describe('currencySymbol', () => {
  it.each(['UAH', 'EUR', 'PLN', 'USD'])('is the sign formatCurrency uses for %s', (currency) => {
    const symbol = currencySymbol(currency)
    expect(symbol.length).toBeGreaterThan(0)
    expect(formatCurrency(1, currency)).toContain(symbol)
  })
})
