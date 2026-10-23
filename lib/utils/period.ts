/**
 * The report period filter (S01A, Finmap ergonomics): presets, their inclusive date ranges, the
 * labels of the menu and the pill, and a slug for file names. Pure, unit-tested.
 *
 * Calendar maths run in UTC, like the app's day grouping (lib/utils/date.ts `toDateKey`): a range
 * starts at 00:00:00.000 UTC of its first day and ends at 23:59:59.999 UTC of its last day, and
 * "today" is the UTC day of `now`. Weeks start on Monday (Poland). Europe/Warsaw handling arrives
 * with S03 (the company time zone).
 */
import {
  addDaysUtc,
  dayKeyUtc,
  daysInMonthUtc,
  endOfDayUtc,
  formatDateUtc,
  startOfDayUtc,
  startOfWeekUtc,
  utcDay,
} from './calendar-grid'

export type PeriodPreset =
  | 'currentYear'
  | 'prevYear'
  | 'currentWeek'
  | 'prevWeek'
  | 'currentMonth'
  | 'prevMonth'
  | 'allTime'
  | 'custom'

export interface PeriodSelection {
  preset: PeriodPreset
  /** Only for `custom`: any time of the first day. */
  start?: Date
  /** Only for `custom`: any time of the last day. */
  end?: Date
}

/** Inclusive range; `null` means unbounded (only `allTime`). */
export interface PeriodRange {
  start: Date | null
  end: Date | null
}

/** The order of the reports menu (Cash Flow, P&L). `allTime` is for the journal (S08). */
export const REPORT_PERIOD_PRESETS: readonly PeriodPreset[] = [
  'currentYear',
  'prevYear',
  'currentWeek',
  'prevWeek',
  'currentMonth',
  'prevMonth',
  'custom',
]

export const DEFAULT_REPORT_PERIOD: PeriodSelection = { preset: 'currentYear' }

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  currentYear: 'На поточний рік',
  prevYear: 'За попередній рік',
  currentWeek: 'За поточний тиждень',
  prevWeek: 'За останній тиждень',
  currentMonth: 'За поточний місяць',
  prevMonth: 'За останній місяць',
  allTime: 'Весь час',
  custom: 'Обрати дати',
}

/** Header of the period menu. */
export const PERIOD_MENU_HEADER = 'ЗА ДАТОЮ ОПЕРАЦІЇ'

function inclusive(firstDay: Date, lastDay: Date): { start: Date; end: Date } {
  return { start: startOfDayUtc(firstDay), end: endOfDayUtc(lastDay) }
}

/**
 * The inclusive range of a selection at `now`. `custom` needs both `start` and `end` (it throws
 * otherwise) and swaps them when `start` is after `end`.
 */
export function resolvePeriod(selection: PeriodSelection, now: Date): PeriodRange {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  switch (selection.preset) {
    case 'currentYear':
      return inclusive(utcDay(y, 0, 1), utcDay(y, 11, 31))
    case 'prevYear':
      return inclusive(utcDay(y - 1, 0, 1), utcDay(y - 1, 11, 31))
    case 'currentWeek': {
      const monday = startOfWeekUtc(now)
      return inclusive(monday, addDaysUtc(monday, 6))
    }
    case 'prevWeek': {
      const monday = addDaysUtc(startOfWeekUtc(now), -7)
      return inclusive(monday, addDaysUtc(monday, 6))
    }
    case 'currentMonth':
      return inclusive(utcDay(y, m, 1), utcDay(y, m, daysInMonthUtc(y, m)))
    case 'prevMonth':
      // utcDay normalises month -1 to December of the previous year.
      return inclusive(utcDay(y, m - 1, 1), utcDay(y, m - 1, daysInMonthUtc(y, m - 1)))
    case 'allTime':
      return { start: null, end: null }
    case 'custom': {
      const { start, end } = selection
      if (!start || !end) throw new RangeError('A custom period needs both start and end')
      return start.getTime() <= end.getTime() ? inclusive(start, end) : inclusive(end, start)
    }
  }
}

/** The pill label: the preset label, or «12.03.2026 – 18.04.2026» for a custom range. */
export function formatPeriodLabel(selection: PeriodSelection): string {
  if (selection.preset === 'custom' && selection.start && selection.end) {
    const range = resolvePeriod(selection, selection.start)
    return `${formatDateUtc(range.start!)} – ${formatDateUtc(range.end!)}`
  }
  return PERIOD_LABELS[selection.preset]
}

const PRESET_SLUGS: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  currentYear: 'current-year',
  prevYear: 'prev-year',
  currentWeek: 'current-week',
  prevWeek: 'prev-week',
  currentMonth: 'current-month',
  prevMonth: 'prev-month',
  allTime: 'all-time',
}

/** File-name part: 'current-year', or '2026-03-12_2026-04-18' for a custom range. */
export function periodSlug(selection: PeriodSelection): string {
  if (selection.preset === 'custom') {
    if (!selection.start || !selection.end) return 'custom'
    const range = resolvePeriod(selection, selection.start)
    return `${dayKeyUtc(range.start!)}_${dayKeyUtc(range.end!)}`
  }
  return PRESET_SLUGS[selection.preset]
}
