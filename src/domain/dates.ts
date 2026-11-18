import type { DayKey, WeekKey } from './types'

const DAY_MS = 86_400_000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fromUtc(utcMs: number): DayKey {
  const d = new Date(utcMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// Day keys are treated as UTC midnights for arithmetic, so no daylight-saving change
// can make a day 23 or 25 hours long and shift a week.
function toUtc(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/**
 * The user's day for a moment in time. Before `dayEndHour` on the wall clock, the moment
 * still belongs to the previous calendar day (01:00 on Monday is "Sunday night").
 * Reads the wall clock rather than subtracting hours, which would be an hour off on
 * the two days a year the clocks change.
 */
export function dayKeyOf(ms: number, dayEndHour: number): DayKey {
  const d = new Date(ms)
  const calendarDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return d.getHours() < dayEndHour ? addDays(calendarDay, -1) : calendarDay
}

export function addDays(day: DayKey, n: number): DayKey {
  return fromUtc(toUtc(day) + n * DAY_MS)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** The Monday of the day's week. */
export function weekOf(day: DayKey): WeekKey {
  const weekday = new Date(toUtc(day)).getUTCDay() // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7))
}

/** Monday to Sunday. */
export function weekDays(week: WeekKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i))
}

/** A week is complete once today is past its Sunday. */
export function isWeekComplete(week: WeekKey, today: DayKey): boolean {
  return today > addDays(week, 6)
}
