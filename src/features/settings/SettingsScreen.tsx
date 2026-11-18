import { useState } from 'react'
import { archivedHabits } from '../../domain/habits'
import { emptyData } from '../../domain/migrate'
import { appStore, useApp } from '../../store'
import { ChevronLeftIcon, MinusIcon, PlusIcon } from '../../ui/icons'
import { Row, Section } from '../../ui/List'
import { ConfirmSheet } from '../../ui/Sheet'
import { About } from './About'
import { BackupRestore } from './BackupRestore'

const STEP = 'grid size-9 place-items-center rounded-full bg-fill-2 text-label active:opacity-60 disabled:opacity-30'

function DayEnd() {
  const hour = useApp((s) => s.data.settings.dayEndHour)
  const set = (dayEndHour: number) => appStore.getState().setSettings({ dayEndHour })
  return (
    <Section
      title="Day"
      footer="Anything you log before this time counts for the day before, so a late night still belongs to the day it started. Changing it never moves what is already logged."
    >
      <Row
        label="Day ends at"
        detail={
          <span className="flex items-center gap-3">
            <button type="button" aria-label="Earlier" disabled={hour <= 0} onClick={() => set(hour - 1)} className={STEP}>
              <MinusIcon size={16} />
            </button>
            <span className="w-13 text-center font-rounded tabular-nums text-label">{String(hour).padStart(2, '0')}:00</span>
            <button type="button" aria-label="Later" disabled={hour >= 12} onClick={() => set(hour + 1)} className={STEP}>
              <PlusIcon size={16} />
            </button>
          </span>
        }
      />
    </Section>
  )
}

function Reminders() {
  return (
    <section className="mx-4 mb-7">
      <h2 className="px-4 pb-1.5 text-footnote text-label-2">Reminders</h2>
      <div className="rounded-xl bg-surface px-4 py-3 text-subhead">
        <p>Prometheus cannot send reminders itself. Your iPhone can open it for you at a set time:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-label-2">
          <li>Open the Shortcuts app and go to Automation.</li>
          <li>Add a new automation and choose Time of Day.</li>
          <li>Pick a time, such as 21:00 every day.</li>
          <li>Add the action Open App and choose Prometheus.</li>
        </ol>
        <p className="mt-2 text-label-2">A repeating reminder in the Reminders app works too.</p>
      </div>
    </section>
  )
}

function Archived() {
  const data = useApp((s) => s.data)
  const [deleting, setDeleting] = useState<string | null>(null)
  const habits = archivedHabits(data)
  if (habits.length === 0) return null
  const target = deleting ? data.habits[deleting] : undefined
  return (
    <>
      <Section title="Archived habits" footer="Archived habits keep their history. Deleting one removes everything logged for it.">
        {habits.map((habit) => (
          <Row
            key={habit.id}
            label={`${habit.emoji} ${habit.name}`}
            detail={
              <span className="flex gap-4">
                <button type="button" onClick={() => appStore.getState().unarchiveHabit(habit.id)} className="min-h-9 text-tint active:opacity-50">
                  Restore
                </button>
                <button type="button" onClick={() => setDeleting(habit.id)} className="min-h-9 text-bad active:opacity-50">
                  Delete
                </button>
              </span>
            }
          />
        ))}
      </Section>
      <ConfirmSheet
        open={target !== undefined}
        title={`Delete ${target?.name ?? 'habit'}?`}
        message="This removes the habit and everything logged for it."
        confirmLabel="Delete habit"
        destructive
        onConfirm={() => {
          if (deleting) appStore.getState().deleteHabit(deleting)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function EraseAll() {
  const [confirming, setConfirming] = useState(false)
  const empty = useApp((s) => Object.keys(s.data.habits).length === 0)
  return (
    <>
      <Section>
        <Row label="Erase all data" tone="destructive" disabled={empty} onClick={() => setConfirming(true)} />
      </Section>
      <ConfirmSheet
        open={confirming}
        title="Erase all data?"
        message="This removes every habit and entry from this phone. A backup file is not affected."
        confirmLabel="Erase"
        destructive
        onConfirm={() => {
          appStore.getState().apply(() => emptyData())
          setConfirming(false)
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto max-w-lg pb-[max(env(safe-area-inset-bottom),2rem)] pt-[env(safe-area-inset-top)]">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-0.5 pl-2 pr-4 text-body text-tint active:opacity-50">
        <ChevronLeftIcon />
        Week
      </button>
      <h1 className="px-4 pb-4 text-large-title font-bold">Settings</h1>
      <BackupRestore />
      <DayEnd />
      <Reminders />
      <Archived />
      <About />
      <EraseAll />
    </main>
  )
}
