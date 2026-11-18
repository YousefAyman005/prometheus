import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { dayKeyOf } from '../domain/dates'
import type { DayKey } from '../domain/types'
import { useApp } from '../store'

/**
 * The current time, refreshed every `intervalMs` and whenever the app returns to the
 * foreground (an installed web app can sit suspended for hours).
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('pageshow', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('pageshow', tick)
    }
  }, [intervalMs])
  return now
}

/** The user's current day by the day-end hour; rolls over on its own while the app is open. */
export function useToday(): DayKey {
  const dayEndHour = useApp((s) => s.data.settings.dayEndHour)
  return dayKeyOf(useNow(30_000), dayEndHour)
}

// ---- Open sheets ----------------------------------------------------------------------
// A modal dialog makes everything outside it unclickable, including a toast. So the toast is
// rendered inside the top-most open sheet, and this tiny store tracks which sheets are open.

const openSheets: string[] = []
const listeners = new Set<() => void>()

function notify() {
  document.documentElement.classList.toggle('sheet-open', openSheets.length > 0)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAnySheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => openSheets.length > 0)
}

/** Registers a sheet while it is open, and says whether it is the top-most one. */
export function useIsTopSheet(open: boolean): boolean {
  const id = useId()
  useEffect(() => {
    if (!open) return
    openSheets.push(id)
    notify()
    return () => {
      openSheets.splice(openSheets.indexOf(id), 1)
      notify()
    }
  }, [open, id])
  return useSyncExternalStore(subscribe, () => openSheets[openSheets.length - 1] === id)
}
