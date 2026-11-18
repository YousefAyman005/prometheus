import { useState } from 'react'
import { emptyData } from './domain/migrate'
import type { AppData } from './domain/types'
import { About } from './features/settings/About'
import { BackupRestore } from './features/settings/BackupRestore'
import { appStore, useApp } from './store'
import { Row, Section } from './ui/List'
import { ConfirmSheet } from './ui/Sheet'

// Stage 1, step 1: a walking skeleton whose only job is to prove on a real iPhone that
// installing, storing, backing up and restoring work. The tracker itself replaces this screen.

function withSampleHabit(data: AppData): AppData {
  const n = Object.keys(data.habits).length + 1
  const id = crypto.randomUUID()
  const day = '2026-11-18'
  return {
    ...data,
    habits: {
      ...data.habits,
      [id]: {
        id, name: `Sample habit ${n}`, emoji: '🔥', color: 'orange', order: n,
        measure: 'number', input: 'counter', step: 1,
        rules: [{ effectiveFrom: '2026-11-16', basis: 'total', target: null }],
        membership: [{ effectiveFrom: '2026-11-16', groupId: null }],
        createdDay: day, archivedDay: null,
      },
    },
    entries: {
      ...data.entries,
      [`${id}:${day}`]: { id: `${id}:${day}`, habitId: id, day, value: n, source: 'counter', updatedAt: Date.now() },
    },
  }
}

export default function App() {
  const habits = useApp((s) => s.data.habits)
  const blocked = useApp((s) => s.blocked)
  const [confirmErase, setConfirmErase] = useState(false)
  const names = Object.values(habits).map((h) => h.name)

  return (
    <main className="mx-auto max-w-lg pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="px-4 pb-1 pt-6 text-large-title font-bold">Prometheus</h1>
      <p className="px-4 pb-6 text-subhead text-label-2">
        Setup check. The tracker itself comes next; this screen confirms that saving and backing up work on your iPhone.
      </p>

      {blocked && (
        <Section
          title="Stored data cannot be opened"
          footer={
            blocked.reason === 'newer'
              ? 'It was saved by a newer version of Prometheus. Close and reopen the app to update.'
              : 'It is damaged. Restore from a backup below, or start again.'
          }
        >
          <Row label="Start again with no data" tone="destructive" onClick={() => appStore.getState().startFresh()} />
        </Section>
      )}

      <Section
        title="Sample data"
        footer={names.length ? names.join(', ') : 'Nothing stored yet. Add a sample habit, then try a backup.'}
      >
        <Row label="Add a sample habit" tone="tint" onClick={() => appStore.getState().apply(withSampleHabit)} />
        <Row label="Erase all data" tone="destructive" onClick={() => setConfirmErase(true)} disabled={!names.length} />
      </Section>

      <BackupRestore />
      <About />

      <ConfirmSheet
        open={confirmErase}
        title="Erase all data?"
        message="This removes every habit and entry from this phone. A backup file is not affected."
        confirmLabel="Erase"
        destructive
        onConfirm={() => {
          appStore.getState().apply(() => emptyData())
          setConfirmErase(false)
        }}
        onCancel={() => setConfirmErase(false)}
      />
    </main>
  )
}
