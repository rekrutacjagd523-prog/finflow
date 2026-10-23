import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOKEN_COLORS, tokenCssName, type TokenColor } from '@/lib/ui/colors'

// Recharts takes colours as props, so lib/ui/colors.ts repeats the token values; this keeps it
// in sync with the source of truth, the `--color-*` tokens in app/globals.css.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function cssToken(name: string): string | undefined {
  return css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]?.toLowerCase()
}

describe('TOKEN_COLORS', () => {
  it.each(Object.keys(TOKEN_COLORS) as TokenColor[])('%s equals its --color-* token in app/globals.css', (token) => {
    expect(cssToken(tokenCssName(token))).toBe(TOKEN_COLORS[token])
  })

  it('maps camelCase names to the CSS names', () => {
    expect(tokenCssName('brandSoftForeground')).toBe('brand-soft-foreground')
    expect(tokenCssName('income')).toBe('income')
  })
})
