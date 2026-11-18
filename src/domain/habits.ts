import { addDays, weekOf } from './dates'
import { versionAt } from './evaluate'
import type {
  AppData, Basis, DayKey, Habit, HabitId, Input, Measure, RuleVersion, Target, WeekKey,
} from './types'

/** What the habit form collects. */
export interface HabitDraft {
  name: string
  emoji: string
  color: string
  measure: Measure
  input: Input
  unit?: string
  step?: number
  timerMaxSec?: number
  basis: Basis
  target: Target | null
}

const VALID_INPUTS: Record<Measure, Input[]> = {
  check: ['tap'],
  duration: ['timer', 'daily'],
  number: ['counter', 'daily'],
}

export function isValidPair(measure: Measure, input: Input): boolean {
  return VALID_INPUTS[measure].includes(input)
}

/** Why a goal cannot be saved, in words for the form, or null when it is fine. */
export function targetProblem(target: Target | null): string | null {
  if (target === null) return null
  const numbers = target.op === 'atLeast' ? [target.min] : target.op === 'atMost' ? [target.max] : [target.min, target.max]
  if (!numbers.every(Number.isFinite)) return 'Enter a number.'
  switch (target.op) {
    case 'atLeast':
      return target.min > 0 ? null : 'The goal must be more than zero.'
    case 'atMost':
      return target.max >= 0 ? null : 'The limit cannot be negative.'
    case 'between':
      if (target.min < 0) return 'The goal cannot be negative.'
      return target.min < target.max ? null : 'The lower end must be smaller than the higher end.'
  }
}

/** A yes/no habit can only be judged by how many days it was done. */
function basisFor(measure: Measure, basis: Basis): Basis {
  return measure === 'check' ? 'days' : basis
}

function withHabit(data: AppData, id: HabitId, change: (habit: Habit) => Habit): AppData {
  const habit = data.habits[id]
  if (!habit) return data
  return { ...data, habits: { ...data.habits, [id]: change(habit) } }
}

export function createHabit(data: AppData, draft: HabitDraft, today: DayKey, id: HabitId): AppData {
  const name = draft.name.trim()
  if (!name) throw new Error('A habit needs a name.')
  if (!isValidPair(draft.measure, draft.input)) {
    throw new Error(`A ${draft.measure} habit cannot be logged by ${draft.input}.`)
  }
  const week = weekOf(today)
  const orders = Object.values(data.habits).map((h) => h.order)
  const habit: Habit = {
    id,
    name,
    emoji: draft.emoji,
    color: draft.color,
    order: orders.length ? Math.max(...orders) + 1 : 0,
    measure: draft.measure,
    input: draft.input,
    ...(draft.measure === 'number' && draft.unit?.trim() ? { unit: draft.unit.trim() } : {}),
    ...(draft.input === 'counter' ? { step: draft.step && draft.step > 0 ? draft.step : 1 } : {}),
    ...(draft.input === 'timer' && draft.timerMaxSec ? { timerMaxSec: draft.timerMaxSec } : {}),
    rules: [{ effectiveFrom: week, basis: basisFor(draft.measure, draft.basis), target: draft.target }],
    membership: [{ effectiveFrom: week, groupId: null }],
    createdDay: today,
    archivedDay: null,
  }
  return { ...data, habits: { ...data.habits, [id]: habit } }
}

export type HabitPatch = Partial<Pick<Habit, 'name' | 'emoji' | 'color' | 'unit' | 'step' | 'timerMaxSec'>>

/** Changes how a habit looks and behaves. What it measures and how it is logged never change. */
export function editHabit(data: AppData, id: HabitId, patch: HabitPatch): AppData {
  return withHabit(data, id, (habit) => {
    const next = { ...habit, ...patch }
    next.name = patch.name?.trim() || habit.name
    return next
  })
}

function sameRule(a: Pick<RuleVersion, 'basis' | 'target'>, b: Pick<RuleVersion, 'basis' | 'target'>): boolean {
  return a.basis === b.basis && JSON.stringify(a.target) === JSON.stringify(b.target)
}

/**
 * Sets the goal from `week` on. Earlier weeks keep the goal they were judged by.
 * A goal already set for that same week is replaced rather than stacked.
 */
export function setRule(
  data: AppData, id: HabitId, rule: { basis: Basis; target: Target | null }, week: WeekKey,
): AppData {
  return withHabit(data, id, (habit) => {
    const next = { basis: basisFor(habit.measure, rule.basis), target: rule.target }
    const others = habit.rules.filter((version) => version.effectiveFrom !== week)
    const inForce = versionAt(others, week)
    const rules = inForce && sameRule(inForce, next) ? others : [...others, { effectiveFrom: week, ...next }]
    rules.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    return { ...habit, rules }
  })
}

function stopTimerOn(data: AppData, id: HabitId): AppData {
  return data.runningTimer?.habitId === id ? { ...data, runningTimer: null } : data
}

/** Hides the habit from the week screen. Its history stays in past stats. */
export function archiveHabit(data: AppData, id: HabitId, today: DayKey): AppData {
  return stopTimerOn(withHabit(data, id, (habit) => ({ ...habit, archivedDay: today })), id)
}

/**
 * Brings an archived habit back. The full weeks it was away are marked paused,
 * so they neither break its streak nor show as missed.
 */
export function unarchiveHabit(data: AppData, id: HabitId, today: DayKey): AppData {
  const habit = data.habits[id]
  if (!habit || habit.archivedDay === null) return data
  const pauses = { ...data.pauses }
  const thisWeek = weekOf(today)
  for (let week = addDays(weekOf(habit.archivedDay), 7); week < thisWeek; week = addDays(week, 7)) {
    const existing = pauses[week] ?? { ids: [] }
    if (!existing.ids.includes(id)) pauses[week] = { ...existing, ids: [...existing.ids, id] }
  }
  return { ...data, pauses, habits: { ...data.habits, [id]: { ...habit, archivedDay: null } } }
}

/** Removes the habit and everything logged for it. Past group totals shrink accordingly. */
export function deleteHabit(data: AppData, id: HabitId): AppData {
  if (!data.habits[id]) return data
  const { [id]: _removed, ...habits } = data.habits
  const entries = Object.fromEntries(Object.entries(data.entries).filter(([, entry]) => entry.habitId !== id))
  return stopTimerOn({ ...data, habits, entries }, id)
}

const byOrder = (a: Habit, b: Habit) => a.order - b.order

export function activeHabits(data: AppData): Habit[] {
  return Object.values(data.habits).filter((h) => h.archivedDay === null).sort(byOrder)
}

export function archivedHabits(data: AppData): Habit[] {
  return Object.values(data.habits).filter((h) => h.archivedDay !== null).sort(byOrder)
}
