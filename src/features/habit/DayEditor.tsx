import { useState } from 'react'
import { entriesOn } from '../../domain/evaluate'
import { formatCompact, formatDuration, formatTimeOfDay } from '../../domain/format'
import type { DayKey, Entry, Habit } from '../../domain/types'
import { appStore, useApp } from '../../store'
import { DurationField, NumberField } from '../../ui/fields'
import { CheckIcon, MinusIcon, PlusIcon, TrashIcon } from '../../ui/icons'

const PRESETS = [30 * 60, 45 * 60, 3600, 90 * 60]

const PRIMARY = 'min-h-11 rounded-[10px] bg-habit px-4 text-body font-semibold text-on-habit active:opacity-70 disabled:opacity-30'
const QUIET = 'min-h-11 rounded-[10px] bg-fill-2 px-4 text-body text-label active:opacity-70 disabled:opacity-30'

function TapEditor({ habit, day, entries }: EditorProps) {
  const done = entries.length > 0
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => appStore.getState().toggleCheck(habit.id, day)}
      className={`flex w-full items-center justify-center gap-2 ${done ? PRIMARY : QUIET}`}
    >
      {done && <CheckIcon size={18} />}
      {done ? 'Done' : 'Mark as done'}
    </button>
  )
}

function CounterEditor({ habit, day, entries }: EditorProps) {
  const step = habit.step ?? 1
  const value = entries[0]?.value ?? 0
  const [exact, setExact] = useState<number | null>(null)
  const actions = appStore.getState()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label={`Take ${step} off`} disabled={value <= 0} onClick={() => actions.bump(habit.id, -step, day)} className={`${QUIET} grid w-14 place-items-center px-0`}>
          <MinusIcon />
        </button>
        <p className="font-rounded text-[2rem] font-semibold tabular-nums">
          {value}
          {habit.unit && <span className="ml-1.5 text-body font-normal text-label-2">{habit.unit}</span>}
        </p>
        <button type="button" aria-label={`Add ${step}`} onClick={() => actions.bump(habit.id, step, day)} className={`${PRIMARY} grid w-14 place-items-center px-0`}>
          <PlusIcon />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <NumberField label="Exact number" value={exact} onChange={setExact} suffix={habit.unit} />
        </div>
        <button type="button" disabled={exact === null} onClick={() => { actions.setValue(habit.id, exact, day); setExact(null) }} className={QUIET}>
          Set
        </button>
      </div>
    </div>
  )
}

function TypedEditor({ habit, day, entries }: EditorProps) {
  const saved = entries[0]?.value ?? null
  const [value, setValue] = useState<number | null>(saved)
  const actions = appStore.getState()
  return (
    <div className="space-y-3">
      {habit.measure === 'duration'
        ? <DurationField label={habit.name} value={value} onChange={setValue} autoFocus={saved === null} />
        : <NumberField label={habit.name} value={value} onChange={setValue} suffix={habit.unit} autoFocus={saved === null} />}
      <div className="flex gap-2">
        <button type="button" disabled={value === null || value === saved} onClick={() => actions.setValue(habit.id, value, day)} className={`${PRIMARY} flex-1`}>
          Save
        </button>
        {saved !== null && (
          <button type="button" onClick={() => { actions.setValue(habit.id, null, day); setValue(null) }} className={QUIET}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function sessionTimes(entry: Entry): string | null {
  if (entry.startedAt === undefined || entry.endedAt === undefined) return null
  return `${formatTimeOfDay(entry.startedAt)} to ${formatTimeOfDay(entry.endedAt)}`
}

function TimerEditor({ habit, day, entries }: EditorProps) {
  const [custom, setCustom] = useState(false)
  const [length, setLength] = useState<number | null>(null)
  const actions = appStore.getState()
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {PRESETS.map((seconds) => (
          <button key={seconds} type="button" onClick={() => actions.addSession(habit.id, seconds, day)} className={`${QUIET} flex-1 whitespace-nowrap px-0 font-rounded`}>
            {formatCompact(habit, seconds)}
          </button>
        ))}
        <button type="button" aria-expanded={custom} onClick={() => setCustom(!custom)} className={`${QUIET} flex-1 px-0`}>
          Other
        </button>
      </div>
      {custom && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DurationField label="Time to add" value={length} onChange={setLength} autoFocus />
          </div>
          <button
            type="button"
            disabled={!length}
            onClick={() => { if (length) actions.addSession(habit.id, length, day); setCustom(false); setLength(null) }}
            className={PRIMARY}
          >
            Add
          </button>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="overflow-hidden rounded-xl bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="relative flex min-h-11 items-center gap-3 pl-4 pr-1 after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden">
              <span className="font-rounded text-body tabular-nums">{formatDuration(entry.value)}</span>
              <span className="flex-1 text-footnote text-label-2">{sessionTimes(entry)}</span>
              <button type="button" aria-label={`Delete ${formatDuration(entry.value)} session`} onClick={() => actions.deleteEntry(entry.id)} className="grid size-11 place-items-center text-bad active:opacity-50">
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface EditorProps {
  habit: Habit
  day: DayKey
  entries: Entry[]
}

/** Everything logged for one habit on one day, with the controls to add, change and remove it. */
export function DayEditor({ habit, day }: { habit: Habit; day: DayKey }) {
  const entries = useApp((s) => entriesOn(s.data, habit.id, day))
  const props = { habit, day, entries }
  switch (habit.input) {
    case 'tap':
      return <TapEditor {...props} />
    case 'counter':
      return <CounterEditor {...props} />
    case 'daily':
      return <TypedEditor {...props} />
    case 'timer':
      return <TimerEditor {...props} />
  }
}
