import { compare, type WeekFigure, type WeekStatus } from './evaluate'
import type { Basis, Habit, Target } from './types'

/** "7h 30m", "45m", "1h". Rounded to the minute; a real amount under a minute reads "<1m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes === 0) return seconds > 0 ? '<1m' : '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** A running timer: "12:34", or "1:02:03" past the hour. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const two = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

/** Whole numbers plainly, anything else to one decimal. */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** A value of this habit in the given basis, without its unit. */
export function formatAmount(habit: Pick<Habit, 'measure'>, basis: Basis, value: number): string {
  return basis !== 'days' && habit.measure === 'duration' ? formatDuration(value) : formatNumber(value)
}

/** The word that follows an amount: " days", " pages", or nothing for durations. */
export function unitSuffix(habit: Pick<Habit, 'measure' | 'unit'>, basis: Basis, amount: number): string {
  if (basis === 'days') return amount === 1 ? ' day' : ' days'
  return habit.measure === 'number' && habit.unit ? ` ${habit.unit}` : ''
}

export interface WeekView {
  /** One line: where the week stands against the goal. */
  text: string
  /** Time spent, for a timed habit whose goal counts days. */
  extra: string | null
  /** How full the bar is, 0 to 1; null when there is no goal and so no bar. */
  fraction: number | null
  /** For a "between" goal: where on the bar the window begins, 0 to 1. */
  windowStart: number | null
  tone: 'neutral' | 'good' | 'bad' | 'muted'
}

/** Everything a habit row needs to show a week. */
export function describeWeek(habit: Habit, figure: WeekFigure, status: WeekStatus): WeekView {
  const { basis, target, value, total } = figure
  const fmt = (n: number) => formatAmount(habit, basis, n)
  const unit = (n: number) => unitSuffix(habit, basis, n)
  const average = basis === 'dailyAverage' ? ' average' : ''

  let text: string
  if (status.state === 'paused' || target === null) {
    const amount = value === null ? 'Nothing logged' : `${fmt(value)}${unit(value)}${average}`
    text = status.state === 'paused' ? `${amount}, paused this week` : amount
  } else {
    const amount = value === null ? 'Nothing logged' : `${fmt(value)}${average}`
    switch (target.op) {
      case 'atLeast':
        text = average || value === null
          ? `${amount}, aim ${fmt(target.min)}${unit(target.min)} or more`
          : `${amount} of ${fmt(target.min)}${unit(target.min)}`
        break
      case 'atMost':
        text = `${amount}, limit ${fmt(target.max)}${unit(target.max)}`
        break
      case 'between':
        text = `${amount}, aim ${fmt(target.min)} to ${fmt(target.max)}${unit(target.max)}`
        break
    }
  }

  let fraction: number | null = null
  let windowStart: number | null = null
  if (target !== null) {
    const full = target.op === 'atLeast' ? target.min : target.max
    const amount = value ?? 0
    fraction = full > 0 ? Math.min(1, amount / full) : amount > 0 ? 1 : 0
    if (target.op === 'between' && target.max > 0) windowStart = target.min / target.max
  }

  let tone: WeekView['tone'] = 'neutral'
  if (status.state === 'hit') tone = 'good'
  else if (status.state === 'missed') tone = 'bad'
  else if (status.state === 'paused' || status.state === 'inactive') tone = 'muted'
  else if (status.state === 'open' && target !== null && value !== null && compare(value, target) === 'above') tone = 'bad'

  const extra = habit.measure === 'duration' && basis === 'days' && total > 0 ? formatDuration(total) : null
  return { text, extra, fraction, windowStart, tone }
}

// ---- Dates as text ------------------------------------------------------------------
// Day keys are calendar dates with no time zone, so they are formatted as UTC.

function utcDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const part = (options: Intl.DateTimeFormatOptions) => {
  const format = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })
  return (day: string) => format.format(utcDate(day))
}

const dayNumber = part({ day: 'numeric' })
const monthLong = part({ month: 'long' })
const monthShort = part({ month: 'short' })
const weekdayLong = part({ weekday: 'long' })

/** "16 – 22 November", or "30 Nov – 6 Dec" when the week spans two months. */
export function formatWeekRange(week: string): string {
  const sunday = new Date(utcDate(week).getTime() + 6 * 86_400_000).toISOString().slice(0, 10)
  if (week.slice(0, 7) === sunday.slice(0, 7)) return `${dayNumber(week)} – ${dayNumber(sunday)} ${monthLong(week)}`
  return `${dayNumber(week)} ${monthShort(week)} – ${dayNumber(sunday)} ${monthShort(sunday)}`
}

/** "Wednesday 18 November". */
export function formatDayLong(day: string): string {
  return `${weekdayLong(day)} ${dayNumber(day)} ${monthLong(day)}`
}

/** "07:05", in the phone's own time zone. */
export function formatTimeOfDay(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A day's value squeezed into a narrow cell: "45m", "1.5h", "31", or a tick. */
export function formatCompact(habit: Pick<Habit, 'measure'>, value: number): string {
  if (habit.measure === 'check') return value > 0 ? '✓' : ''
  if (habit.measure === 'number') return formatNumber(value)
  return value < 3600 ? `${Math.round(value / 60)}m` : `${formatNumber(value / 3600)}h`
}

/** A goal in a sentence: "At least 3 days a week", "7h to 9h a day on average". */
export function describeRule(
  habit: Pick<Habit, 'measure' | 'unit'>, rule: { basis: Basis; target: Target | null },
): string {
  const { basis, target } = rule
  if (target === null) return 'No goal, just tracking'
  const amount = (n: number) => `${formatAmount(habit, basis, n)}${unitSuffix(habit, basis, n)}`
  const period = basis === 'dailyAverage' ? 'a day on average' : 'a week'
  switch (target.op) {
    case 'atLeast':
      return `At least ${amount(target.min)} ${period}`
    case 'atMost':
      return `Up to ${amount(target.max)} ${period}`
    case 'between':
      return `${formatAmount(habit, basis, target.min)} to ${amount(target.max)} ${period}`
  }
}
