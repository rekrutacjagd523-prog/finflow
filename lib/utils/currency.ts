export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(amount)
}

/**
 * `formatCurrency` cut around its decimals, so a big total can show them smaller:
 * `whole` + `fraction` + `rest` is exactly the formatted string (`51 450` + `,40` + ` грн`).
 * `fraction` is empty for a currency without minor units.
 */
export function splitCurrency(amount: number, currency: string): { whole: string; fraction: string; rest: string } {
  const parts = new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).formatToParts(amount)
  const decimal = parts.findIndex((part) => part.type === 'decimal')
  if (decimal === -1) return { whole: parts.map((p) => p.value).join(''), fraction: '', rest: '' }
  const fractionEnd = parts[decimal + 1]?.type === 'fraction' ? decimal + 2 : decimal + 1
  const join = (from: number, to?: number) => parts.slice(from, to).map((p) => p.value).join('')
  return { whole: join(0, decimal), fraction: join(decimal, fractionEnd), rest: join(fractionEnd) }
}

/** The sign `formatCurrency` uses for a currency (`€`, `грн.`, `zł`), e.g. as an input suffix. */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('uk-UA', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  )
}
