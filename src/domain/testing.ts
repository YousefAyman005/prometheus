// Builders for domain tests. Not imported by the app.
import { emptyData } from './migrate'
import type { AppData, Basis, DayKey, Entry, Habit, Target, WeekKey } from './types'

/** The week every test uses unless it says otherwise: Monday 16 to Sunday 22 November 2026. */
export const WEEK: WeekKey = '2026-11-16'
export const MON = '2026-11-16'
export const TUE = '2026-11-17'
export const WED = '2026-11-18'
export const THU = '2026-11-19'
export const FRI = '2026-11-20'
export const SAT = '2026-11-21'
export const SUN = '2026-11-22'
/** The Monday after WEEK: the first day on which WEEK is complete. */
export const NEXT_MON = '2026-11-23'

export const HOUR = 3600

interface HabitSpec extends Partial<Omit<Habit, 'rules'>> {
  basis?: Basis
  target?: Target | null
  /** Week the goal applies from. Defaults to long before WEEK. */
  from?: WeekKey
}

export function habit(spec: HabitSpec = {}): Habit {
  const { basis = 'total', target = null, from = '2026-01-05', ...rest } = spec
  return {
    id: 'h',
    name: 'Habit',
    emoji: '🔥',
    color: 'orange',
    order: 0,
    measure: 'duration',
    input: 'timer',
    rules: [{ effectiveFrom: from, basis, target }],
    membership: [{ effectiveFrom: from, groupId: null }],
    createdDay: from,
    archivedDay: null,
    ...rest,
  }
}

/** A session-style entry; give `id` to control it, otherwise ids are unique per call. */
let counter = 0
export function entry(habitId: string, day: DayKey, value: number, extra: Partial<Entry> = {}): Entry {
  return { id: `e${++counter}`, habitId, day, value, source: 'manual', updatedAt: 0, ...extra }
}

export function dataWith(habits: Habit[], entries: Entry[] = []): AppData {
  const data = emptyData()
  for (const h of habits) data.habits[h.id] = h
  for (const e of entries) data.entries[e.id] = e
  return data
}
