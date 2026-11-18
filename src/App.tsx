import { useEffect, useState } from 'react'
import { OverlongTimerPrompt } from './features/habit/OverlongTimerPrompt'
import { InstallFirst } from './features/onboarding/InstallFirst'
import { BackupRestore } from './features/settings/BackupRestore'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { WeekScreen } from './features/week/WeekScreen'
import { isStandalone, requestPersistentStorage } from './platform/device'
import { appStore, useApp } from './store'
import { Row, Section } from './ui/List'
import { useAnySheetOpen } from './ui/hooks'
import { ToastHost } from './ui/Toast'

const BROWSER_OK_KEY = 'prometheus:browser-ok'

function readBrowserOk(): boolean {
  try {
    return sessionStorage.getItem(BROWSER_OK_KEY) === '1'
  } catch {
    return false
  }
}

/** Stored data exists but cannot be used. Nothing is overwritten until the user chooses. */
function Blocked({ reason }: { reason: 'corrupt' | 'newer' }) {
  return (
    <main className="mx-auto max-w-lg pb-8 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="px-4 pb-2 pt-6 text-large-title font-bold">Your data cannot be opened</h1>
      <p className="px-4 pb-6 text-body text-label-2">
        {reason === 'newer'
          ? 'It was saved by a newer version of Prometheus. Close the app completely and open it again to update. Nothing has been changed.'
          : 'What is stored on this phone is damaged. Nothing has been changed. You can restore a backup, or start again.'}
      </p>
      <BackupRestore />
      <Section footer="The damaged data is kept aside on this phone in case it can be rescued.">
        <Row label="Start again with no data" tone="destructive" onClick={() => appStore.getState().startFresh()} />
      </Section>
    </main>
  )
}

export default function App() {
  const blocked = useApp((s) => s.blocked)
  const hasHabits = useApp((s) => Object.keys(s.data.habits).length > 0)
  const [screen, setScreen] = useState<'week' | 'settings'>('week')
  const [browserOk, setBrowserOk] = useState(readBrowserOk)
  const sheetOpen = useAnySheetOpen()

  // Ask the browser to protect the data once there is something worth protecting.
  useEffect(() => {
    if (hasHabits) void requestPersistentStorage()
  }, [hasHabits])

  if (blocked) return <Blocked reason={blocked.reason} />

  if (!hasHabits && !browserOk && !isStandalone()) {
    return (
      <InstallFirst
        onContinue={() => {
          try {
            sessionStorage.setItem(BROWSER_OK_KEY, '1')
          } catch {
            // Without session storage the page simply shows again next time.
          }
          setBrowserOk(true)
        }}
      />
    )
  }

  return (
    <>
      {screen === 'week'
        ? <WeekScreen onOpenSettings={() => setScreen('settings')} />
        : <SettingsScreen onBack={() => setScreen('week')} />}
      <OverlongTimerPrompt />
      <ToastHost active={!sheetOpen} />
    </>
  )
}
