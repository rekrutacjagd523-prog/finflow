export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(amount)
}

/** The sign `formatCurrency` uses for a currency (`€`, `грн.`, `zł`), e.g. as an input suffix. */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('uk-UA', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  )
}
