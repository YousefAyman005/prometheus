import { isWeekComplete, weekDays, weekOf } from './dates'
import type { AppData, Basis, DayKey, Entry, Habit, HabitId, Target, WeekKey } from './types'

/**
 * A typed daily average needs this many logged days to count as hit (fewer in a week the
 * habit only partly existed). Otherwise one good night would hit a sleep goal.
 */
export const MIN_LOGGED_DAYS_FOR_AVERAGE = 4

// Averages are sums divided by small integers; this absorbs the rounding.
const EPSILON = 1e-9

// ---- Entry lookup -------------------------------------------------------------------

interface EntryIndex {
  byHabitDay: Map<string, Entry[]>
  days: Set<DayKey>
}

// Entries are replaced, never mutated, so the entries object identifies its own index.
const indexCache = new WeakMap<AppData['entries'], EntryIndex>()

function indexOf(data: AppData): EntryIndex {
  let index = indexCache.get(data.entries)
  if (!index) {
    index = { byHabitDay: new Map(), days: new Set() }
    for (const entry of Object.values(data.entries)) {
      const key = `${entry.habitId}|${entry.day}`
      const list = index.byHabitDay.get(key)
      if (list) list.push(entry)
      else index.byHabitDay.set(key, [entry])
      index.days.add(entry.day)
    }
    indexCache.set(data.entries, index)
  }
  return index
}

const NONE: Entry[] = []

/** A habit's entries on one day. */
export function entriesOn(data: AppData, habitId: HabitId, day: DayKey): Entry[] {
  return indexOf(data).byHabitDay.get(`${habitId}|${day}`) ?? NONE
}

/** Whether anything at all was logged in the app that week. */
export function usedInWeek(data: AppData, week: WeekKey): boolean {
  const { days } = indexOf(data)
  return weekDays(week).some((day) => days.has(day))
}

// ---- Values -------------------------------------------------------------------------

/** The latest version that had started by `week`, or undefined before the first. */
export function versionAt<T extends { effectiveFrom: WeekKey }>(history: readonly T[], week: WeekKey): T | undefined {
  let found: T | undefined
  for (const version of history) {
    if (version.effectiveFrom <= week && (!found || version.effectiveFrom >= found.effectiveFrom)) found = version
  }
  return found
}

/** Accumulating habits treat a day without entries as zero; typed ('daily') habits treat it as unknown. */
export function isAccumulating(habit: Pick<Habit, 'input'>): boolean {
  return habit.input !== 'daily'
}

export function dayValue(habit: Pick<Habit, 'input'>, entries: readonly Entry[]): number | null {
  if (entries.length === 0) return isAccumulating(habit) ? 0 : null
  return entries.reduce((sum, entry) => sum + entry.value, 0)
}

export interface WeekFigure {
  /** Monday to Sunday. null where there is nothing to show: future days, days the habit did not exist, unlogged typed days. */
  perDay: (number | null)[]
  total: number
  /** Days with at least one entry. */
  loggedDays: number
  /** Days with a value above zero. */
  doneDays: number
  /** Days of this week on which the habit existed. */
  activeDays: number
  /** Active days up to and including today. */
  elapsedDays: number
  basis: Basis
  /** The goal in force that week, or null when the habit is just tracked. */
  target: Target | null
  /** The figure the goal is judged against, or null when there is no data to judge. */
  value: number | null
}

export function weekFigure(habit: Habit, data: AppData, week: WeekKey, today: DayKey): WeekFigure {
  const rule = versionAt(habit.rules, week)
  const basis = rule?.basis ?? 'total'
  const accumulating = isAccumulating(habit)
  const perDay: (number | null)[] = []
  let total = 0
  let loggedDays = 0
  let doneDays = 0
  let activeDays = 0
  let elapsedDays = 0

  for (const day of weekDays(week)) {
    const active = day >= habit.createdDay && (habit.archivedDay === null || day <= habit.archivedDay)
    const elapsed = active && day <= today
    if (active) activeDays++
    if (elapsed) elapsedDays++

    const entries = entriesOn(data, habit.id, day)
    let value: number | null = null
    if (entries.length > 0) {
      value = entries.reduce((sum, entry) => sum + entry.value, 0)
      total += value
      loggedDays++
    } else if (elapsed && accumulating) {
      value = 0
    }
    if (value !== null && value > 0) doneDays++
    perDay.push(value)
  }

  let value: number | null
  if (!accumulating && loggedDays === 0) value = null
  else if (basis === 'total') value = total
  else if (basis === 'days') value = doneDays
  else if (accumulating) value = elapsedDays > 0 ? total / elapsedDays : null
  else value = total / loggedDays

  return { perDay, total, loggedDays, doneDays, activeDays, elapsedDays, basis, target: rule?.target ?? null, value }
}

// ---- Verdicts -----------------------------------------------------------------------

export type WeekStatus =
  /** The habit did not exist that week, or the week has not started. */
  | { state: 'inactive' }
  /** No goal that week. */
  | { state: 'tracking' }
  | { state: 'paused' }
  /** The current week, still undecided. */
  | { state: 'open'; onTrack: boolean }
  /** final: false means the goal is already secured before the week ended. */
  | { state: 'hit'; final: boolean }
  | { state: 'missed'; final: boolean; reason: 'below' | 'above' | 'noData' }
  /** Missed in the week the habit was created or archived: shown neutrally and skipped by streaks. */
  | { state: 'grace' }

type Side = 'ok' | 'below' | 'above'

export function compare(value: number, target: Target): Side {
  switch (target.op) {
    case 'atLeast':
      return value >= target.min - EPSILON ? 'ok' : 'below'
    case 'atMost':
      return value <= target.max + EPSILON ? 'ok' : 'above'
    case 'between':
      if (value < target.min - EPSILON) return 'below'
      return value > target.max + EPSILON ? 'above' : 'ok'
  }
}

export interface JudgeInput {
  figure: WeekFigure
  target: Target
  accumulating: boolean
  complete: boolean
  /** Whether anything was logged in the app that week (see the at-most-at-zero rule). */
  used: boolean
}

/** The verdict for one subject and week. Shared by habits and groups. */
export function judge({ figure, target, accumulating, complete, used }: JudgeInput): WeekStatus {
  const { value, total, basis, loggedDays, activeDays, elapsedDays } = figure

  if (complete) {
    if (value === null) return { state: 'missed', final: true, reason: 'noData' }
    const typedAverage = !accumulating && basis === 'dailyAverage'
    if (typedAverage && loggedDays < Math.min(MIN_LOGGED_DAYS_FOR_AVERAGE, activeDays)) {
      return { state: 'missed', final: true, reason: 'noData' }
    }
    const side = compare(value, target)
    if (side !== 'ok') return { state: 'missed', final: true, reason: side }
    // Only reachable when zero satisfies the goal ("at most"): an abandoned app must not grow streaks.
    if (accumulating && total === 0 && !used) return { state: 'missed', final: true, reason: 'noData' }
    return { state: 'hit', final: true }
  }

  // A typed value can move the average either way, so nothing is decided before the week ends.
  if (!accumulating) return { state: 'open', onTrack: value !== null && compare(value, target) === 'ok' }

  // Accumulating figures only grow as the week goes on. `secured` is where the week ends
  // if nothing more is logged; `running` is how it looks so far.
  const running = value ?? 0
  const average = basis === 'dailyAverage'
  const secured = average ? (activeDays > 0 ? total / activeDays : 0) : running
  const share = activeDays > 0 ? elapsedDays / activeDays : 0
  const onPace = (min: number) => running >= (average ? min : min * share) - EPSILON

  switch (target.op) {
    case 'atLeast':
      if (secured >= target.min - EPSILON) return { state: 'hit', final: false }
      return { state: 'open', onTrack: onPace(target.min) }
    case 'atMost':
      if (secured > target.max + EPSILON) return { state: 'missed', final: false, reason: 'above' }
      return { state: 'open', onTrack: running <= target.max + EPSILON }
    case 'between':
      if (secured > target.max + EPSILON) return { state: 'missed', final: false, reason: 'above' }
      return { state: 'open', onTrack: running <= target.max + EPSILON && onPace(target.min) }
  }
}

/** Paused directly, through "pause everything", or through the group it belonged to that week. */
export function isPaused(data: AppData, week: WeekKey, id: string, groupId: string | null = null): boolean {
  const pauses = data.pauses[week]
  if (!pauses) return false
  return pauses.all === true || pauses.ids.includes(id) || (groupId !== null && pauses.ids.includes(groupId))
}

export function weekStatus(habit: Habit, data: AppData, week: WeekKey, today: DayKey): WeekStatus {
  if (week > weekOf(today)) return { state: 'inactive' }
  const firstWeek = weekOf(habit.createdDay)
  const lastWeek = habit.archivedDay === null ? null : weekOf(habit.archivedDay)
  if (week < firstWeek || (lastWeek !== null && week > lastWeek)) return { state: 'inactive' }

  const rule = versionAt(habit.rules, week)
  if (!rule?.target) return { state: 'tracking' }

  const groupId = versionAt(habit.membership, week)?.groupId ?? null
  if (isPaused(data, week, habit.id, groupId)) return { state: 'paused' }

  const status = judge({
    figure: weekFigure(habit, data, week, today),
    target: rule.target,
    accumulating: isAccumulating(habit),
    complete: isWeekComplete(week, today),
    used: usedInWeek(data, week),
  })

  const partialWeek = week === firstWeek || week === lastWeek
  if (status.state === 'missed' && status.final && partialWeek) return { state: 'grace' }
  return status
}
