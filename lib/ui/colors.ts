// FinFlow colour tokens as plain values, for code that takes colours as props (Recharts) or as
// inline styles. They mirror `--color-*` in app/globals.css; tests/unit/ui/colors.test.ts fails
// as soon as the two diverge. In class names use the Tailwind utilities (`text-income`) instead.
export const TOKEN_COLORS = {
  canvas: '#f4f6f5',
  surface: '#ffffff',
  line: '#e3e7e5',
  ink: '#17201d',
  inkMuted: '#5f6b66',
  inkSubtle: '#6b7671',
  brand: '#00c896',
  brandSoft: '#e6f9f3',
  brandSoftForeground: '#007a58',
  income: '#00805c',
  expense: '#d02222',
  expenseSoft: '#fdecec',
} as const

export type TokenColor = keyof typeof TOKEN_COLORS

/** `inkMuted` -> `ink-muted`: the name of the matching `--color-*` variable and utility. */
export function tokenCssName(token: TokenColor): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
