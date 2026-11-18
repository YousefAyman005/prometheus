import { dayKeyOf } from './dates'
import { putEntry } from './log'
import type { AppData, HabitId, RunningTimer } from './types'

/** A timer running longer than this (unless the habit says otherwise) was probably forgotten. */
export const DEFAULT_TIMER_MAX_SEC = 4 * 3600
/** Shorter sessions are treated as accidental taps and not saved. */
export const MIN_SESSION_SEC = 60

/** Whole seconds since the timer started. Zero if the phone's clock was moved backwards. */
export function elapsedSec(timer: RunningTimer, now: number): number {
  return Math.max(0, Math.floor((now - timer.startedAt) / 1000))
}

/**
 * Starts timing a habit. Only one timer runs at a time: a timer on another habit is
 * stopped and saved first.
 */
export function startTimer(data: AppData, habitId: HabitId, now: number, newId: () => string): AppData {
  if (!data.habits[habitId] || data.runningTimer?.habitId === habitId) return data
  const stopped = stopTimer(data, now, newId)
  return {
    ...stopped,
    runningTimer: { habitId, startedAt: now, startDay: dayKeyOf(now, data.settings.dayEndHour) },
  }
}

/**
 * Stops the timer and saves the session on the day it started, even if it ran past the
 * day end. `endedAt` lets a forgotten timer be ended at the moment the activity really
 * stopped; it is kept between the start and now.
 */
export function stopTimer(data: AppData, now: number, newId: () => string, endedAt: number = now): AppData {
  const timer = data.runningTimer
  if (!timer) return data
  const cleared = { ...data, runningTimer: null }

  const latest = Math.max(now, timer.startedAt)
  const end = Math.min(Math.max(endedAt, timer.startedAt), latest)
  const seconds = Math.floor((end - timer.startedAt) / 1000)
  if (seconds < MIN_SESSION_SEC) return cleared

  const id = newId()
  return putEntry(cleared, timer.habitId, timer.startDay, id, {
    id,
    habitId: timer.habitId,
    day: timer.startDay,
    value: seconds,
    source: 'timer',
    startedAt: timer.startedAt,
    endedAt: end,
    updatedAt: now,
  })
}

export function discardTimer(data: AppData): AppData {
  return data.runningTimer ? { ...data, runningTimer: null } : data
}

function maxMs(data: AppData, timer: RunningTimer): number {
  return (data.habits[timer.habitId]?.timerMaxSec ?? DEFAULT_TIMER_MAX_SEC) * 1000
}

/** Whether to ask the user when the running session really ended. */
export function isOverlong(data: AppData, now: number): boolean {
  const timer = data.runningTimer
  if (!timer) return false
  if (timer.askAgainAt !== undefined) return now >= timer.askAgainAt
  return now - timer.startedAt > maxMs(data, timer)
}

/** The answer "still going": do not ask again until another full limit has passed. */
export function keepRunning(data: AppData, now: number): AppData {
  const timer = data.runningTimer
  if (!timer) return data
  return { ...data, runningTimer: { ...timer, askAgainAt: now + maxMs(data, timer) } }
}
