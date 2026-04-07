export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(amount)
}
