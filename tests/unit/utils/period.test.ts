import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REPORT_PERIOD,
  PERIOD_LABELS,
  PERIOD_MENU_HEADER,
  REPORT_PERIOD_PRESETS,
  formatPeriodLabel,
  periodSlug,
  resolvePeriod,
  type PeriodSelection,
} from '@/lib/utils/period'

const at = (iso: string) => new Date(iso)
/** The range as ISO strings, to compare exact boundaries. */
function iso(selection: PeriodSelection, now: Date) {
  const { start, end } = resolvePeriod(selection, now)
  return { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null }
}

describe('resolvePeriod', () => {
  it('current year: 1 Jan 00:00:00.000 to 31 Dec 23:59:59.999 UTC', () => {
    expect(iso({ preset: 'currentYear' }, at('2026-10-23T12:00:00Z'))).toEqual({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-12-31T23:59:59.999Z',
    })
  })

  it('year change: on 1 Jan 2026 the current year is 2026 and the previous one 2025', () => {
    const now = at('2026-01-01T00:00:00Z')
    expect(iso({ preset: 'currentYear' }, now).start).toBe('2026-01-01T00:00:00.000Z')
    expect(iso({ preset: 'prevYear' }, now)).toEqual({
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-12-31T23:59:59.999Z',
    })
  })

  it('the last millisecond of a year still belongs to it', () => {
    expect(iso({ preset: 'currentYear' }, at('2025-12-31T23:59:59.999Z')).start).toBe('2025-01-01T00:00:00.000Z')
  })

  it('weeks start on Monday: on Monday 19 Oct 2026 the week is 19-25 Oct', () => {
    expect(iso({ preset: 'currentWeek' }, at('2026-10-19T00:00:00Z'))).toEqual({
      start: '2026-10-19T00:00:00.000Z',
      end: '2026-10-25T23:59:59.999Z',
    })
    expect(iso({ preset: 'prevWeek' }, at('2026-10-19T00:00:00Z'))).toEqual({
      start: '2026-10-12T00:00:00.000Z',
      end: '2026-10-18T23:59:59.999Z',
    })
  })

  it('on Sunday 25 Oct 2026 the current week is still 19-25 Oct (not the week starting that Sunday)', () => {
    const sunday = at('2026-10-25T23:30:00Z')
    expect(iso({ preset: 'currentWeek' }, sunday)).toEqual({
      start: '2026-10-19T00:00:00.000Z',
      end: '2026-10-25T23:59:59.999Z',
    })
    expect(iso({ preset: 'prevWeek' }, sunday).start).toBe('2026-10-12T00:00:00.000Z')
  })

  it('a week across the new year', () => {
    // Thursday 1 Jan 2026: the week is Mon 29 Dec 2025 - Sun 4 Jan 2026.
    expect(iso({ preset: 'currentWeek' }, at('2026-01-01T10:00:00Z'))).toEqual({
      start: '2025-12-29T00:00:00.000Z',
      end: '2026-01-04T23:59:59.999Z',
    })
    expect(iso({ preset: 'prevWeek' }, at('2026-01-01T10:00:00Z'))).toEqual({
      start: '2025-12-22T00:00:00.000Z',
      end: '2025-12-28T23:59:59.999Z',
    })
  })

  it('current month ends on its last day', () => {
    expect(iso({ preset: 'currentMonth' }, at('2026-04-15T08:00:00Z'))).toEqual({
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-04-30T23:59:59.999Z',
    })
  })

  it('on 31 Jan the previous month is December of the previous year', () => {
    expect(iso({ preset: 'prevMonth' }, at('2026-01-31T12:00:00Z'))).toEqual({
      start: '2025-12-01T00:00:00.000Z',
      end: '2025-12-31T23:59:59.999Z',
    })
  })

  it('on 1 Mar the previous month is February: 28 days in 2026, 29 in the leap year 2028', () => {
    expect(iso({ preset: 'prevMonth' }, at('2026-03-01T00:00:00Z'))).toEqual({
      start: '2026-02-01T00:00:00.000Z',
      end: '2026-02-28T23:59:59.999Z',
    })
    expect(iso({ preset: 'prevMonth' }, at('2028-03-01T00:00:00Z'))).toEqual({
      start: '2028-02-01T00:00:00.000Z',
      end: '2028-02-29T23:59:59.999Z',
    })
  })

  it('all time is unbounded', () => {
    expect(resolvePeriod({ preset: 'allTime' }, at('2026-10-23T00:00:00Z'))).toEqual({ start: null, end: null })
  })

  it('custom: whole days, any time of day in the input', () => {
    const selection = { preset: 'custom' as const, start: at('2026-03-12T15:00:00Z'), end: at('2026-04-18T01:00:00Z') }
    expect(iso(selection, at('2026-10-23T00:00:00Z'))).toEqual({
      start: '2026-03-12T00:00:00.000Z',
      end: '2026-04-18T23:59:59.999Z',
    })
  })

  it('custom: swaps start and end when start is after end', () => {
    const selection = { preset: 'custom' as const, start: at('2026-04-18T00:00:00Z'), end: at('2026-03-12T00:00:00Z') }
    expect(iso(selection, at('2026-10-23T00:00:00Z'))).toEqual({
      start: '2026-03-12T00:00:00.000Z',
      end: '2026-04-18T23:59:59.999Z',
    })
  })

  it('custom: one day is a valid range', () => {
    const day = at('2026-05-05T10:00:00Z')
    expect(iso({ preset: 'custom', start: day, end: day }, at('2026-10-23T00:00:00Z'))).toEqual({
      start: '2026-05-05T00:00:00.000Z',
      end: '2026-05-05T23:59:59.999Z',
    })
  })

  it('custom: requires both start and end', () => {
    expect(() => resolvePeriod({ preset: 'custom', start: at('2026-03-12T00:00:00Z') }, at('2026-10-23T00:00:00Z'))).toThrow(RangeError)
    expect(() => resolvePeriod({ preset: 'custom' }, at('2026-10-23T00:00:00Z'))).toThrow(RangeError)
  })
})

describe('labels', () => {
  it('reports menu: six presets plus custom, no all-time; the default is the current year', () => {
    expect(REPORT_PERIOD_PRESETS.map((p) => PERIOD_LABELS[p])).toEqual([
      'На поточний рік',
      'За попередній рік',
      'За поточний тиждень',
      'За останній тиждень',
      'За поточний місяць',
      'За останній місяць',
      'Обрати дати',
    ])
    expect(REPORT_PERIOD_PRESETS).not.toContain('allTime')
    expect(PERIOD_LABELS.allTime).toBe('Весь час')
    expect(PERIOD_MENU_HEADER).toBe('ЗА ДАТОЮ ОПЕРАЦІЇ')
    expect(DEFAULT_REPORT_PERIOD).toEqual({ preset: 'currentYear' })
  })

  it('a preset shows its label', () => {
    expect(formatPeriodLabel({ preset: 'currentYear' })).toBe('На поточний рік')
    expect(formatPeriodLabel({ preset: 'prevMonth' })).toBe('За останній місяць')
  })

  it('a custom range shows its UTC days, ordered', () => {
    expect(
      formatPeriodLabel({ preset: 'custom', start: at('2026-04-18T23:30:00Z'), end: at('2026-03-12T00:00:00Z') }),
    ).toBe('12.03.2026 – 18.04.2026')
  })
})

describe('periodSlug', () => {
  it('presets', () => {
    expect(periodSlug({ preset: 'currentYear' })).toBe('current-year')
    expect(periodSlug({ preset: 'prevWeek' })).toBe('prev-week')
    expect(periodSlug({ preset: 'allTime' })).toBe('all-time')
  })

  it('custom range', () => {
    expect(periodSlug({ preset: 'custom', start: at('2026-03-12T10:00:00Z'), end: at('2026-04-18T10:00:00Z') })).toBe(
      '2026-03-12_2026-04-18',
    )
    expect(periodSlug({ preset: 'custom' })).toBe('custom')
  })
})
