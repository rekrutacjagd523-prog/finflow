/**
 * Pure UTC calendar helpers for the report period filter (`lib/utils/period.ts`) and the date
 * range picker (`components/ui/date-range-picker.tsx`).
 *
 * Every date here is a UTC calendar day: the app groups transactions by their UTC day
 * (`toDateKey` in lib/utils/date.ts), so the picker and the period maths read the same day the
 * journal shows. Europe/Warsaw handling arrives with S03. Weeks start on Monday (Poland).
 * Month and weekday names are constants, not `Intl`, so the output does not depend on the ICU
 * data of the browser or of Node.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

/** Nominative month names (calendar title: «Жовтень 2026»). */
export const UA_MONTHS_NOMINATIVE = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
] as const

/** Genitive month names (a day: «9 жовтня 2026»). */
export const UA_MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const

/** Short weekday names, Monday first. */
export const UA_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const

/** Full weekday names, Monday first. */
export const UA_WEEKDAYS_FULL = [
  'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя',
] as const

export interface YearMonth {
  year: number
  /** 0-11 */
  month: number
}

/** 00:00:00.000 UTC of the given UTC calendar day. */
export function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

/** 00:00:00.000 UTC of the UTC day `date` falls on. */
export function startOfDayUtc(date: Date): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** 23:59:59.999 UTC of the UTC day `date` falls on. */
export function endOfDayUtc(date: Date): Date {
  return new Date(startOfDayUtc(date).getTime() + DAY_MS - 1)
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(startOfDayUtc(date).getTime() + days * DAY_MS)
}

/** The same day `months` later, clamped to the last day of the target month (31 Jan + 1 = 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + months
  const lastDay = daysInMonthUtc(y, m)
  return utcDay(y, m, Math.min(date.getUTCDate(), lastDay))
}

/** Number of days of a month; `month` may overflow (13 = February of the next year). */
export function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMonFirst(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

/** Monday of the week `date` falls in. */
export function startOfWeekUtc(date: Date): Date {
  return addDaysUtc(date, -weekdayMonFirst(date))
}

export function isSameDayUtc(a: Date, b: Date): boolean {
  return startOfDayUtc(a).getTime() === startOfDayUtc(b).getTime()
}

export function isSameMonthUtc(date: Date, ym: YearMonth): boolean {
  return date.getUTCFullYear() === ym.year && date.getUTCMonth() === ym.month
}

/** Shifts a year-month by `delta` months. */
export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(Date.UTC(ym.year, ym.month + delta, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}

/** Whether the UTC day of `date` lies between the days of `a` and `b` inclusive (in any order). */
export function isDayBetweenUtc(date: Date, a: Date, b: Date): boolean {
  const t = startOfDayUtc(date).getTime()
  const lo = Math.min(startOfDayUtc(a).getTime(), startOfDayUtc(b).getTime())
  const hi = Math.max(startOfDayUtc(a).getTime(), startOfDayUtc(b).getTime())
  return t >= lo && t <= hi
}

/** `YYYY-MM-DD` of the UTC day (the journal's group key). */
export function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** `dd.mm.yyyy` of the UTC day. */
export function formatDateUtc(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${d}.${m}.${date.getUTCFullYear()}`
}

/** «9 жовтня 2026» (the accessible name of a day in the picker). */
export function formatDayLongUtc(date: Date): string {
  return `${date.getUTCDate()} ${UA_MONTHS_GENITIVE[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** «Жовтень 2026». */
export function formatMonthTitle(ym: YearMonth): string {
  return `${UA_MONTHS_NOMINATIVE[ym.month]} ${ym.year}`
}

export interface MonthGridCell {
  /** 00:00 UTC of the day. */
  date: Date
  /** False for the days of the previous and the next month that fill the first and last week. */
  inMonth: boolean
}

/**
 * The weeks of a month, Monday first: 4 to 6 rows of 7 cells. The first row starts on the Monday
 * on or before the 1st, the last row ends on the Sunday on or after the last day.
 */
export function buildMonthGrid(ym: YearMonth): MonthGridCell[][] {
  const first = utcDay(ym.year, ym.month, 1)
  const last = utcDay(ym.year, ym.month, daysInMonthUtc(ym.year, ym.month))
  const gridStart = startOfWeekUtc(first)
  const gridEnd = addDaysUtc(startOfWeekUtc(last), 6)
  const weeks: MonthGridCell[][] = []
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = addDaysUtc(d, 7)) {
    const week: MonthGridCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDaysUtc(d, i)
      week.push({ date, inMonth: isSameMonthUtc(date, ym) })
    }
    weeks.push(week)
  }
  return weeks
}
