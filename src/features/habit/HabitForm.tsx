import { useState } from 'react'
import { weekOf } from '../../domain/dates'
import { versionAt } from '../../domain/evaluate'
import { targetProblem } from '../../domain/habits'
import { DEFAULT_TIMER_MAX_SEC } from '../../domain/timer'
import type { Basis, Habit, Input, Measure, Target } from '../../domain/types'
import { appStore, useApp } from '../../store'
import { HABIT_COLORS, habitStyle } from '../../ui/colors'
import { DurationField, NumberField, Segmented, TextField } from '../../ui/fields'
import { CheckIcon } from '../../ui/icons'
import { ConfirmSheet, Sheet, SheetHeader, TextButton } from '../../ui/Sheet'

type Kind = 'timer' | 'tap' | 'counter' | 'typedTime' | 'typedNumber'
type Op = 'none' | Target['op']

const KINDS: { kind: Kind; label: string; hint: string; measure: Measure; input: Input; basis: Basis }[] = [
  { kind: 'timer', label: 'Timer', hint: 'Start and stop, or add time afterwards', measure: 'duration', input: 'timer', basis: 'total' },
  { kind: 'tap', label: 'Yes or no', hint: 'Tick it off each day', measure: 'check', input: 'tap', basis: 'days' },
  { kind: 'counter', label: 'Count', hint: 'Tap to add, like glasses of water', measure: 'number', input: 'counter', basis: 'total' },
  { kind: 'typedTime', label: 'Time, typed in', hint: 'One amount a day, like hours slept', measure: 'duration', input: 'daily', basis: 'dailyAverage' },
  { kind: 'typedNumber', label: 'Number, typed in', hint: 'One number a day, like calories', measure: 'number', input: 'daily', basis: 'dailyAverage' },
]

const EMOJI = ['🔥', '🏋️', '📚', '😴', '💧', '📖', '📱', '🏃', '🧘', '🥗', '💊', '🎸']

const OPS = [
  { value: 'none', label: 'No goal' },
  { value: 'atLeast', label: 'At least' },
  { value: 'atMost', label: 'At most' },
  { value: 'between', label: 'Between' },
] as const

const BASES = [
  { value: 'total', label: 'Week total' },
  { value: 'dailyAverage', label: 'Daily average' },
  { value: 'days', label: 'Days done' },
] as const

interface Form {
  name: string
  emoji: string
  color: string
  kind: Kind
  unit: string
  step: number | null
  op: Op
  basis: Basis
  low: number | null
  high: number | null
  maxHours: number | null
}

function blank(): Form {
  return {
    name: '', emoji: '🔥', color: 'orange', kind: 'timer', unit: '', step: 1,
    op: 'atLeast', basis: 'total', low: null, high: null, maxHours: DEFAULT_TIMER_MAX_SEC / 3600,
  }
}

function fromHabit(habit: Habit, week: string): Form {
  const rule = versionAt(habit.rules, week) ?? habit.rules[habit.rules.length - 1]
  const target = rule.target
  return {
    name: habit.name,
    emoji: habit.emoji,
    color: habit.color,
    kind: KINDS.find((k) => k.measure === habit.measure && k.input === habit.input)!.kind,
    unit: habit.unit ?? '',
    step: habit.step ?? 1,
    op: target?.op ?? 'none',
    basis: rule.basis,
    low: target && target.op !== 'atMost' ? target.min : null,
    high: target && target.op !== 'atLeast' ? target.max : null,
    maxHours: (habit.timerMaxSec ?? DEFAULT_TIMER_MAX_SEC) / 3600,
  }
}

/** The goal the form describes, or a sentence saying what is still missing or wrong. */
function readGoal(form: Form, measure: Measure): { target: Target | null } | { problem: string } {
  let target: Target | null = null
  if (form.op === 'atLeast') {
    if (form.low === null) return { problem: 'Enter the goal.' }
    target = { op: 'atLeast', min: form.low }
  } else if (form.op === 'atMost') {
    if (form.high === null) return { problem: 'Enter the limit.' }
    target = { op: 'atMost', max: form.high }
  } else if (form.op === 'between') {
    if (form.low === null || form.high === null) return { problem: 'Enter both ends of the range.' }
    target = { op: 'between', min: form.low, max: form.high }
  }
  const problem = targetProblem(target)
  if (problem) return { problem }
  const largest = Math.max(form.low ?? 0, form.high ?? 0)
  if (target && form.basis === 'days' && largest > 7) return { problem: 'A week has 7 days.' }
  if (target && form.basis === 'dailyAverage' && measure === 'duration' && largest > 24 * 3600) {
    return { problem: 'A day has 24 hours.' }
  }
  return { target }
}

function lastEmoji(text: string): string {
  const pieces = [...new Intl.Segmenter().segment(text.trim())]
  return pieces.length ? pieces[pieces.length - 1].segment : ''
}

const LABEL = 'mb-1.5 mt-5 px-1 text-footnote text-label-2'

function Body({ habit, onClose, onDeleted }: { habit: Habit | undefined; onClose: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<Form>(() => (habit ? fromHabit(habit, weekOf(appStore.getState().today())) : blank()))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  const kind = KINDS.find((k) => k.kind === form.kind)!
  const goal = readGoal(form, kind.measure)
  const problem = !form.name.trim() ? 'Give the habit a name.' : 'problem' in goal ? goal.problem : null

  function save() {
    if (problem || 'problem' in goal) return
    const store = appStore.getState()
    const timerMaxSec = kind.input === 'timer' && form.maxHours ? Math.round(form.maxHours * 3600) : undefined
    const shared = { name: form.name, emoji: form.emoji || '🔥', color: form.color, unit: form.unit, step: form.step ?? 1, timerMaxSec }
    if (habit) {
      store.editHabit(habit.id, shared)
      store.setRule(habit.id, { basis: form.basis, target: goal.target })
    } else {
      store.createHabit({ ...shared, measure: kind.measure, input: kind.input, basis: form.basis, target: goal.target })
    }
    onClose()
  }

  // Keyed by everything that changes a goal field's unit, so stale text never survives a switch.
  const fieldKey = `${form.kind}-${form.basis}-${form.op}`
  const goalField = (which: 'low' | 'high', label: string) =>
    form.basis === 'days' ? (
      <NumberField key={`${fieldKey}-${which}`} label={label} decimals={false} suffix="days" value={form[which]} onChange={(v) => set({ [which]: v })} />
    ) : kind.measure === 'duration' ? (
      <DurationField key={`${fieldKey}-${which}`} label={label} value={form[which]} onChange={(v) => set({ [which]: v })} />
    ) : (
      <NumberField key={`${fieldKey}-${which}`} label={label} suffix={form.unit.trim() || undefined} value={form[which]} onChange={(v) => set({ [which]: v })} />
    )

  return (
    <div style={habitStyle(form.color)}>
      <SheetHeader
        title={habit ? 'Edit habit' : 'New habit'}
        left={<TextButton onClick={onClose}>Cancel</TextButton>}
        right={<TextButton strong disabled={problem !== null} onClick={save}>Save</TextButton>}
      />
      <div className="px-4">
        <div className="flex gap-2">
          <div className="w-16 shrink-0 text-center [&_input]:text-center">
            <TextField label="Emoji" value={form.emoji} onChange={(text) => set({ emoji: lastEmoji(text) })} />
          </div>
          <div className="flex-1">
            <TextField label="Name" placeholder="Name, like Gym" value={form.name} maxLength={40} autoFocus={!habit} onChange={(name) => set({ name })} />
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {EMOJI.map((emoji) => (
            <button key={emoji} type="button" aria-label={`Use ${emoji}`} onClick={() => set({ emoji })} className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[1.375rem] active:bg-fill-2">
              {emoji}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Colour" className="mt-2 flex justify-between">
          {HABIT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === form.color}
              aria-label={color}
              onClick={() => set({ color })}
              style={habitStyle(color)}
              className={`size-7 rounded-full bg-habit ${color === form.color ? 'ring-2 ring-label ring-offset-2 ring-offset-bg' : ''}`}
            />
          ))}
        </div>

        <h3 className={LABEL}>How you log it</h3>
        {habit ? (
          <p className="rounded-xl bg-surface px-4 py-3 text-body">
            {kind.label}
            <span className="block text-footnote text-label-2">This cannot be changed once a habit exists.</span>
          </p>
        ) : (
          <div role="radiogroup" aria-label="How you log it" className="overflow-hidden rounded-xl bg-surface">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={k.kind === form.kind}
                onClick={() => set({ kind: k.kind, basis: k.basis, low: null, high: null })}
                className="relative flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden active:bg-fill-2"
              >
                <span className="flex-1">
                  <span className="block text-body">{k.label}</span>
                  <span className="block text-footnote text-label-2">{k.hint}</span>
                </span>
                {k.kind === form.kind && <CheckIcon className="text-tint" />}
              </button>
            ))}
          </div>
        )}

        {kind.measure === 'number' && (
          <>
            <h3 className={LABEL}>{kind.input === 'counter' ? 'What you count' : 'Unit'}</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextField label="Unit" placeholder="Unit, like pages (optional)" value={form.unit} maxLength={16} onChange={(unit) => set({ unit })} />
              </div>
              {kind.input === 'counter' && (
                <div className="w-28">
                  <NumberField label="Each tap adds" value={form.step} onChange={(step) => set({ step })} suffix="a tap" />
                </div>
              )}
            </div>
          </>
        )}

        <h3 className={LABEL}>Weekly goal</h3>
        <Segmented label="Goal" value={form.op} options={OPS} onChange={(op) => set({ op, low: null, high: null })} />
        {form.op !== 'none' && (
          <div className="mt-2 space-y-2">
            {form.op === 'between' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">{goalField('low', 'From')}</div>
                <span className="text-body text-label-2">to</span>
                <div className="flex-1">{goalField('high', 'To')}</div>
              </div>
            ) : (
              goalField(form.op === 'atLeast' ? 'low' : 'high', form.op === 'atLeast' ? 'At least' : 'At most')
            )}
            {kind.measure !== 'check' && (
              <Segmented
                label="Measured as"
                value={form.basis}
                options={BASES}
                onChange={(basis) => set(basis === 'days' || form.basis === 'days' ? { basis, low: null, high: null } : { basis })}
              />
            )}
          </div>
        )}
        {form.op === 'none' && kind.measure !== 'check' && (
          <div className="mt-2">
            <Segmented label="Shown as" value={form.basis} options={BASES} onChange={(basis) => set({ basis })} />
          </div>
        )}

        {kind.input === 'timer' && (
          <>
            <h3 className={LABEL}>Ask if the timer is still running after</h3>
            <NumberField label="Hours before asking" value={form.maxHours} onChange={(maxHours) => set({ maxHours })} suffix="hours" />
          </>
        )}

        <p role="status" className="mt-4 min-h-5 text-center text-footnote text-label-2">{problem}</p>

        {habit && (
          <div className="flex justify-center">
            <TextButton tone="destructive" onClick={() => setConfirmDelete(true)}>Delete habit</TextButton>
          </div>
        )}
      </div>

      {habit && (
        <ConfirmSheet
          open={confirmDelete}
          title={`Delete ${habit.name}?`}
          message="This removes the habit and everything logged for it. Archive it instead to keep its history."
          confirmLabel="Delete habit"
          destructive
          onConfirm={() => {
            appStore.getState().deleteHabit(habit.id)
            setConfirmDelete(false)
            onDeleted()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

export type FormTarget = null | { mode: 'new' } | { mode: 'edit'; id: string }

interface HabitFormProps {
  target: FormTarget
  onClose: () => void
  /** Called instead of onClose after the habit was deleted from the form. */
  onDeleted: () => void
}

export function HabitForm({ target, onClose, onDeleted }: HabitFormProps) {
  const habit = useApp((s) => (target?.mode === 'edit' ? s.data.habits[target.id] : undefined))
  const open = target !== null && (target.mode === 'new' || habit !== undefined)
  return (
    <Sheet open={open} onClose={onClose} label={habit ? 'Edit habit' : 'New habit'}>
      {open && <Body key={habit?.id ?? 'new'} habit={habit} onClose={onClose} onDeleted={onDeleted} />}
    </Sheet>
  )
}
