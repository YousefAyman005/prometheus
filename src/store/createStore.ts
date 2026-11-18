import { createStore } from 'zustand/vanilla'
import { dayKeyOf, weekOf } from '../domain/dates'
import { formatDuration, formatNumber } from '../domain/format'
import {
  archiveHabit, createHabit, deleteHabit, editHabit, type HabitDraft, type HabitPatch, setRule, unarchiveHabit,
} from '../domain/habits'
import { addSession, addToCounter, dayEntryId, deleteEntry, setDayValue, toggleCheck, updateEntry } from '../domain/log'
import { emptyData } from '../domain/migrate'
import { discardTimer, isOverlong, keepRunning, startTimer, stopTimer } from '../domain/timer'
import type {
  AppData, Basis, DayKey, DeviceMeta, EntryId, HabitId, Settings, Target,
} from '../domain/types'
import {
  loadData, loadDeviceMeta, saveData, saveDeviceMeta, snapshotBeforeRestore,
} from './persistence'

/** The outside world the store depends on, replaceable in tests. */
export interface StoreDeps {
  now: () => number
  newId: () => string
}

const browserDeps: StoreDeps = {
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
}

/** A brief confirmation of the last change, with the data to go back to. */
export interface Toast {
  key: number
  message: string
  undo: AppData | null
}

export interface AppState {
  data: AppData
  meta: DeviceMeta
  /** Set when stored data exists but cannot be used. Nothing is written while blocked. */
  blocked: null | { reason: 'corrupt' | 'newer'; raw: string }
  /** Set when the last change could not be written to the phone. */
  saveError: null | 'quota' | 'unavailable'
  toast: Toast | null

  /** The user's current day, by the day-end hour. */
  today: () => DayKey

  /** Applies a pure change to the data and stores the result, without a toast. */
  apply: (change: (data: AppData) => AppData) => void
  /** Replaces everything with restored data, keeping the old data as a safety copy. */
  restore: (data: AppData) => void
  /** Discards unusable stored data and starts fresh. Only reachable from the blocked screen. */
  startFresh: () => void
  setMeta: (patch: Partial<DeviceMeta>) => void
  setSettings: (patch: Partial<Settings>) => void

  createHabit: (draft: HabitDraft) => HabitId
  editHabit: (id: HabitId, patch: HabitPatch) => void
  /** Sets the goal from the current week on. */
  setRule: (id: HabitId, rule: { basis: Basis; target: Target | null }) => void
  archiveHabit: (id: HabitId) => void
  unarchiveHabit: (id: HabitId) => void
  deleteHabit: (id: HabitId) => void

  // Logging. `day` defaults to today.
  toggleCheck: (id: HabitId, day?: DayKey) => void
  bump: (id: HabitId, delta: number, day?: DayKey) => void
  setValue: (id: HabitId, value: number | null, day?: DayKey) => void
  addSession: (id: HabitId, seconds: number, day?: DayKey) => void
  updateEntry: (id: EntryId, value: number) => void
  deleteEntry: (id: EntryId) => void

  startTimer: (id: HabitId) => void
  stopTimer: () => void
  /** Ends a forgotten timer as if it had run for `seconds`. */
  stopTimerAfter: (seconds: number) => void
  keepTimerRunning: () => void
  discardTimer: () => void

  undo: () => void
  dismissToast: () => void
}

/** Builds the app store on top of a Storage, so tests can use an in-memory one. */
export function createAppStore(storage: Storage, deps: StoreDeps = browserDeps) {
  const loaded = loadData(storage)
  let toastKey = 0

  const store = createStore<AppState>()((set, get) => {
    const today = () => dayKeyOf(deps.now(), get().data.settings.dayEndHour)

    /** A change the user sees confirmed and can undo. Does nothing if the data did not change. */
    function commit(change: (data: AppData) => AppData, message: (next: AppData, previous: AppData) => string) {
      const state = get()
      if (state.blocked) return
      const previous = state.data
      const next = change(previous)
      if (next === previous) return
      set({ data: next, toast: { key: ++toastKey, message: message(next, previous), undo: previous } })
    }

    const nameOf = (data: AppData, id: HabitId) => data.habits[id]?.name ?? 'Habit'

    /** Describes what stopping a timer did, by looking for the session it added. */
    function stoppedMessage(next: AppData, previous: AppData): string {
      const session = Object.values(next.entries).find((entry) => !(entry.id in previous.entries))
      if (!session) return 'Under a minute, not saved'
      return `Saved ${formatDuration(session.value)} of ${nameOf(next, session.habitId)}`
    }

    return {
      data: loaded.ok ? loaded.data : emptyData(),
      meta: loadDeviceMeta(storage),
      blocked: loaded.ok ? null : { reason: loaded.reason, raw: loaded.raw },
      saveError: null,
      toast: null,

      today,

      apply: (change) => {
        if (get().blocked) return
        set({ data: change(get().data) })
      },
      restore: (data) => {
        snapshotBeforeRestore(storage)
        set({ data, blocked: null, toast: null })
      },
      startFresh: () => {
        snapshotBeforeRestore(storage)
        set({ data: emptyData(), blocked: null, toast: null })
      },
      setMeta: (patch) => {
        const meta = { ...get().meta, ...patch }
        saveDeviceMeta(storage, meta)
        set({ meta })
      },
      setSettings: (patch) => get().apply((data) => ({ ...data, settings: { ...data.settings, ...patch } })),

      createHabit: (draft) => {
        const id = deps.newId()
        get().apply((data) => createHabit(data, draft, today(), id))
        return id
      },
      editHabit: (id, patch) => get().apply((data) => editHabit(data, id, patch)),
      setRule: (id, rule) => get().apply((data) => setRule(data, id, rule, weekOf(today()))),
      archiveHabit: (id) =>
        commit((data) => archiveHabit(data, id, today()), (next) => `${nameOf(next, id)} archived`),
      unarchiveHabit: (id) => get().apply((data) => unarchiveHabit(data, id, today())),
      deleteHabit: (id) =>
        commit((data) => deleteHabit(data, id), (_next, previous) => `${nameOf(previous, id)} deleted`),

      toggleCheck: (id, day = today()) =>
        commit(
          (data) => toggleCheck(data, id, day, deps.now()),
          (next) => `${nameOf(next, id)} ${dayEntryId(id, day) in next.entries ? 'done' : 'not done'}`,
        ),
      bump: (id, delta, day = today()) =>
        commit(
          (data) => addToCounter(data, id, day, delta, deps.now()),
          (next) => {
            const value = next.entries[dayEntryId(id, day)]?.value ?? 0
            const unit = next.habits[id]?.unit
            return `${nameOf(next, id)}: ${formatNumber(value)}${unit ? ` ${unit}` : ''}`
          },
        ),
      setValue: (id, value, day = today()) =>
        commit(
          (data) => setDayValue(data, id, day, value, deps.now()),
          (next) => `${nameOf(next, id)} ${dayEntryId(id, day) in next.entries ? 'saved' : 'cleared'}`,
        ),
      addSession: (id, seconds, day = today()) =>
        commit(
          (data) => addSession(data, id, day, seconds, 'quick', deps.now(), deps.newId()),
          (next) => `Added ${formatDuration(seconds)} to ${nameOf(next, id)}`,
        ),
      updateEntry: (id, value) =>
        commit((data) => updateEntry(data, id, value, deps.now()), () => 'Entry changed'),
      deleteEntry: (id) => commit((data) => deleteEntry(data, id), () => 'Entry deleted'),

      startTimer: (id) => {
        const { data } = get()
        // A forgotten timer has to be resolved first, or its bogus length would be saved by the switch.
        if (isOverlong(data, deps.now())) return
        if (data.runningTimer && data.runningTimer.habitId !== id) {
          commit((d) => startTimer(d, id, deps.now(), deps.newId), stoppedMessage)
        } else {
          get().apply((d) => startTimer(d, id, deps.now(), deps.newId))
        }
      },
      stopTimer: () => commit((data) => stopTimer(data, deps.now(), deps.newId), stoppedMessage),
      stopTimerAfter: (seconds) =>
        commit((data) => {
          const timer = data.runningTimer
          return timer ? stopTimer(data, deps.now(), deps.newId, timer.startedAt + seconds * 1000) : data
        }, stoppedMessage),
      keepTimerRunning: () => get().apply((data) => keepRunning(data, deps.now())),
      discardTimer: () => commit(discardTimer, () => 'Timer discarded'),

      undo: () => {
        const previous = get().toast?.undo
        if (previous && !get().blocked) set({ data: previous, toast: null })
      },
      dismissToast: () => set({ toast: null }),
    }
  })

  store.subscribe((state, previous) => {
    if (state.data === previous.data || state.blocked) return
    const result = saveData(storage, state.data)
    const saveError = result.ok ? null : result.reason
    if (saveError !== state.saveError) store.setState({ saveError })
  })

  return store
}
