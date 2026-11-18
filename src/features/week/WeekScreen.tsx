import { useState } from 'react'
import { shouldNudgeBackup } from '../../domain/backup'
import { weekOf } from '../../domain/dates'
import { formatWeekRange } from '../../domain/format'
import { activeHabits } from '../../domain/habits'
import { useApp } from '../../store'
import { useNow, useToday } from '../../ui/hooks'
import { SettingsIcon, PlusIcon } from '../../ui/icons'
import { type FormTarget, HabitForm } from '../habit/HabitForm'
import { HabitSheet } from '../habit/HabitSheet'
import { Starters } from '../onboarding/Starters'
import { HabitRow } from './HabitRow'
import { RunningTimerBar } from './RunningTimerBar'

const DAY_MS = 86_400_000

function Notice({ children, action, onAction }: { children: string; action: string; onAction: () => void }) {
  return (
    <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-surface py-2 pl-4 pr-2">
      <p className="flex-1 text-footnote text-label-2">{children}</p>
      <button type="button" onClick={onAction} className="min-h-9 shrink-0 rounded-full bg-fill-2 px-3.5 text-subhead font-semibold text-tint active:opacity-60">
        {action}
      </button>
    </div>
  )
}

export function WeekScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const data = useApp((s) => s.data)
  const lastBackupAt = useApp((s) => s.meta.lastBackupAt)
  const saveError = useApp((s) => s.saveError)
  const today = useToday()
  const now = useNow(60_000)
  const week = weekOf(today)
  const [openHabit, setOpenHabit] = useState<string | null>(null)
  const [form, setForm] = useState<FormTarget>(null)

  const habits = activeHabits(data)
  const firstRun = Object.keys(data.habits).length === 0
  const backupAge = lastBackupAt === null ? null : Math.floor((now - lastBackupAt) / DAY_MS)

  return (
    <main className="mx-auto max-w-lg pb-[max(env(safe-area-inset-bottom),5rem)] pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-11 items-center justify-between px-2">
        <button type="button" aria-label="Settings" onClick={onOpenSettings} className="grid size-11 place-items-center text-tint active:opacity-50">
          <SettingsIcon size={23} />
        </button>
        {!firstRun && (
          <button type="button" aria-label="Add habit" onClick={() => setForm({ mode: 'new' })} className="grid size-11 place-items-center text-tint active:opacity-50">
            <PlusIcon size={25} />
          </button>
        )}
      </div>
      <header className="px-4 pb-4">
        <h1 className="text-large-title font-bold">{firstRun ? 'Prometheus' : 'This week'}</h1>
        <p className="text-subhead text-label-2">{firstRun ? 'Weekly goals for the things you want to do.' : formatWeekRange(week)}</p>
      </header>

      {saveError && (
        <Notice action="Back up" onAction={onOpenSettings}>
          {saveError === 'quota'
            ? 'This phone’s storage for Prometheus is full, so changes are not being saved.'
            : 'Changes cannot be saved on this phone right now.'}
        </Notice>
      )}
      {!saveError && shouldNudgeBackup(data, lastBackupAt, now) && (
        <Notice action="Back up" onAction={onOpenSettings}>
          {backupAge === null
            ? 'Your habits exist only on this phone, and there is no backup yet.'
            : `Your habits exist only on this phone. The last backup was ${backupAge} days ago.`}
        </Notice>
      )}

      <RunningTimerBar />

      {firstRun ? (
        <Starters onCustom={() => setForm({ mode: 'new' })} />
      ) : habits.length === 0 ? (
        <p className="px-8 pt-10 text-center text-body text-label-2">
          Every habit is archived. Add one with the plus button, or restore one in Settings.
        </p>
      ) : (
        <ul className="mx-4 overflow-hidden rounded-xl bg-surface">
          {habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} data={data} week={week} today={today} onOpen={() => setOpenHabit(habit.id)} />
          ))}
        </ul>
      )}

      <HabitSheet habitId={openHabit} onClose={() => setOpenHabit(null)} onEdit={(id) => setForm({ mode: 'edit', id })} />
      <HabitForm
        target={form}
        onClose={() => setForm(null)}
        onDeleted={() => {
          setForm(null)
          setOpenHabit(null)
        }}
      />
    </main>
  )
}
