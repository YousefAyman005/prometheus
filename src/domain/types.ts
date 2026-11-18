/** 'YYYY-MM-DD'. The user's day after applying the day-end hour. Stamped once when logged, never recomputed. */
export type DayKey = string
/** The Monday (as a DayKey) of a Monday-to-Sunday week. */
export type WeekKey = DayKey

export type HabitId = string
export type GroupId = string
export type EntryId = string

/** What a habit measures. Durations are whole seconds. */
export type Measure = 'check' | 'duration' | 'number'

/**
 * How a habit is logged. Valid pairs: check+tap, duration+timer, duration+daily,
 * number+counter, number+daily.
 * 'daily' is one typed value per day, and a day without one is unknown.
 * Every other input accumulates, and a day without entries is a real zero.
 */
export type Input = 'tap' | 'timer' | 'counter' | 'daily'

export type Target =
  | { op: 'atLeast'; min: number }
  | { op: 'atMost'; max: number }
  | { op: 'between'; min: number; max: number }

/** The weekly figure a target is judged against. */
export type Basis = 'total' | 'dailyAverage' | 'days'

/** One entry in a goal history. Sorted by effectiveFrom, at most one per week. */
export interface RuleVersion {
  effectiveFrom: WeekKey
  basis: Basis
  /** null means "just track": no goal. */
  target: Target | null
}

export interface MembershipVersion {
  effectiveFrom: WeekKey
  groupId: GroupId | null
}

export interface Habit {
  id: HabitId
  name: string
  emoji: string
  color: string
  order: number
  /** measure and input are fixed after creation. */
  measure: Measure
  input: Input
  /** Label for number habits, e.g. "pages". */
  unit?: string
  /** Counter increment per tap. */
  step?: number
  /** Timer length after which the app asks when the session really ended. */
  timerMaxSec?: number
  rules: RuleVersion[]
  membership: MembershipVersion[]
  createdDay: DayKey
  archivedDay: DayKey | null
}

export interface Group {
  id: GroupId
  name: string
  emoji: string
  color: string
  order: number
  collapsed: boolean
  /** Member habits must share this measure. */
  measure: Measure
  /** Group goals use basis 'total' or 'days'. */
  rules: RuleVersion[]
  createdDay: DayKey
  archivedDay: DayKey | null
}

export type EntrySource = 'tap' | 'counter' | 'daily' | 'timer' | 'quick' | 'manual'

export interface Entry {
  /** tap/counter/daily entries: `${habitId}:${day}` (one per habit per day). Sessions: random. */
  id: EntryId
  habitId: HabitId
  day: DayKey
  /** 1 for a tick, seconds for durations, units for numbers. Never negative. */
  value: number
  source: EntrySource
  /** Epoch ms, timer sessions only. Informational: `day` and `value` are authoritative. */
  startedAt?: number
  endedAt?: number
  updatedAt: number
}

/** A single nullable slot, so "only one timer runs" holds by construction. */
export interface RunningTimer {
  habitId: HabitId
  startedAt: number
  startDay: DayKey
  /** Set when the user answers "still going" to the overlong prompt. */
  askAgainAt?: number
}

export interface WeekPauses {
  all?: true
  /** HabitId or GroupId. */
  ids: string[]
}

export interface Settings {
  /** Hour (0 to 12) before which a moment still counts as the previous day. */
  dayEndHour: number
  backupNudgeDays: number
}

/** Everything that is backed up and restored. */
export interface AppData {
  schemaVersion: number
  habits: Record<HabitId, Habit>
  groups: Record<GroupId, Group>
  entries: Record<EntryId, Entry>
  runningTimer: RunningTimer | null
  pauses: Record<WeekKey, WeekPauses>
  /** `${week}|${subjectId}` or `${week}|*` (perfect week) -> epoch ms it was celebrated. */
  celebrated: Record<string, number>
  settings: Settings
}

/** Facts about this device only. Never exported or restored. */
export interface DeviceMeta {
  lastBackupAt: number | null
  lastRecapWeek: WeekKey | null
}

export interface BackupFile {
  format: 'prometheus-backup'
  schemaVersion: number
  exportedAt: string
  appVersion: string
  data: AppData
}
