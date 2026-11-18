import { weekOf } from './dates'
import type { AppData, DayKey, Entry, EntryId, EntrySource, Habit, HabitId } from './types'

/** The id of the single entry a tap, counter or typed habit has for a day. */
export function dayEntryId(habitId: HabitId, day: DayKey): EntryId {
  return `${habitId}:${day}`
}

/**
 * Logging a day before the habit's creation day means it existed then, so its start
 * (and the start of its first goal) moves back to cover that day.
 */
function reachBack(habit: Habit, day: DayKey): Habit {
  if (day >= habit.createdDay) return habit
  const week = weekOf(day)
  const pullBack = <T extends { effectiveFrom: string }>(history: T[]): T[] =>
    history.length && history[0].effectiveFrom > week
      ? [{ ...history[0], effectiveFrom: week }, ...history.slice(1)]
      : history
  return { ...habit, createdDay: day, rules: pullBack(habit.rules), membership: pullBack(habit.membership) }
}

/** Stores an entry (or removes the one with `id` when given null). The base of every logging action. */
export function putEntry(data: AppData, habitId: HabitId, day: DayKey, id: EntryId, entry: Entry | null): AppData {
  const habit = data.habits[habitId]
  if (!habit) return data
  const entries = { ...data.entries }
  if (entry) entries[id] = entry
  else delete entries[id]
  const reached = reachBack(habit, day)
  const habits = reached === habit ? data.habits : { ...data.habits, [habitId]: reached }
  return { ...data, habits, entries }
}

function putDayEntry(
  data: AppData, habitId: HabitId, day: DayKey, value: number | null, source: EntrySource, now: number,
): AppData {
  const id = dayEntryId(habitId, day)
  const entry = value === null ? null : { id, habitId, day, value, source, updatedAt: now }
  return putEntry(data, habitId, day, id, entry)
}

/** Ticks a yes/no habit for the day, or unticks it. */
export function toggleCheck(data: AppData, habitId: HabitId, day: DayKey, now: number): AppData {
  const ticked = dayEntryId(habitId, day) in data.entries
  return putDayEntry(data, habitId, day, ticked ? null : 1, 'tap', now)
}

/** Adds to (or with a negative delta, takes from) the day's count. Never goes below zero. */
export function addToCounter(data: AppData, habitId: HabitId, day: DayKey, delta: number, now: number): AppData {
  const current = data.entries[dayEntryId(habitId, day)]?.value ?? 0
  const value = current + delta
  return putDayEntry(data, habitId, day, value > 0 ? value : null, 'counter', now)
}

/**
 * Sets the day's single value outright; null clears the day.
 * For a typed habit zero is an answer and is kept. For a tick or a counter, zero means
 * nothing happened, so the entry is removed.
 */
export function setDayValue(data: AppData, habitId: HabitId, day: DayKey, value: number | null, now: number): AppData {
  const habit = data.habits[habitId]
  if (!habit || habit.input === 'timer') return data
  if (habit.input === 'daily') {
    return putDayEntry(data, habitId, day, value === null ? null : Math.max(0, value), 'daily', now)
  }
  const kept = value !== null && value > 0 ? (habit.measure === 'check' ? 1 : value) : null
  return putDayEntry(data, habitId, day, kept, 'manual', now)
}

/** Adds a session to a timed habit: from quick add or typed in afterwards. */
export function addSession(
  data: AppData, habitId: HabitId, day: DayKey, seconds: number, source: 'quick' | 'manual', now: number, id: EntryId,
): AppData {
  if (seconds <= 0) return data
  return putEntry(data, habitId, day, id, { id, habitId, day, value: Math.round(seconds), source, updatedAt: now })
}

/** Changes an entry's value. An accumulating entry edited down to nothing is removed. */
export function updateEntry(data: AppData, id: EntryId, value: number, now: number): AppData {
  const entry = data.entries[id]
  const habit = entry && data.habits[entry.habitId]
  if (!entry || !habit) return data
  if (value <= 0 && habit.input !== 'daily') return deleteEntry(data, id)
  return { ...data, entries: { ...data.entries, [id]: { ...entry, value: Math.max(0, value), updatedAt: now } } }
}

export function deleteEntry(data: AppData, id: EntryId): AppData {
  if (!(id in data.entries)) return data
  const { [id]: _removed, ...entries } = data.entries
  return { ...data, entries }
}
