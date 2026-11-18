import { compare, type WeekFigure, type WeekStatus } from './evaluate'
import type { Basis, Habit } from './types'

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
