import { describe, expect, it } from 'vitest'
import { dataWith, habit, HOUR } from './testing'
import {
  DEFAULT_TIMER_MAX_SEC, discardTimer, elapsedSec, isOverlong, keepRunning, startTimer, stopTimer,
} from './timer'

// Tests run with TZ=Europe/Berlin; the default day end is 04:00.
const at = (d: number, h: number, min = 0) => new Date(2026, 10, d, h, min).getTime()
const MIN = 60_000

function ids() {
  let n = 0
  return () => `id${++n}`
}

const start = () => dataWith([habit({ id: 'gym' }), habit({ id: 'study' })])

describe('startTimer', () => {
  it('starts a timer on the day it is, by the day-end hour', () => {
    const afternoon = startTimer(start(), 'gym', at(18, 17), ids())
    expect(afternoon.runningTimer).toEqual({ habitId: 'gym', startedAt: at(18, 17), startDay: '2026-11-18' })
    const lateNight = startTimer(start(), 'gym', at(19, 1, 30), ids())
    expect(lateNight.runningTimer?.startDay).toBe('2026-11-18')
  })

  it('changes nothing when that habit is already running', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    expect(startTimer(running, 'gym', at(18, 18), ids())).toBe(running)
  })

  it('saves the running session before starting another habit', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const switched = startTimer(running, 'study', at(18, 18, 30), ids())
    expect(switched.runningTimer).toMatchObject({ habitId: 'study', startedAt: at(18, 18, 30) })
    expect(Object.values(switched.entries)).toEqual([
      expect.objectContaining({ habitId: 'gym', value: 90 * 60, source: 'timer' }),
    ])
  })

  it('does nothing for a habit that does not exist', () => {
    const data = start()
    expect(startTimer(data, 'nope', at(18, 17), ids())).toBe(data)
  })
})

describe('stopTimer', () => {
  it('saves the session on the day it started', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const stopped = stopTimer(running, at(18, 17, 45), ids())
    expect(stopped.runningTimer).toBeNull()
    expect(Object.values(stopped.entries)).toEqual([{
      id: 'id1', habitId: 'gym', day: '2026-11-18', value: 45 * 60, source: 'timer',
      startedAt: at(18, 17), endedAt: at(18, 17, 45), updatedAt: at(18, 17, 45),
    }])
  })

  it('keeps a session that runs past the day end on the day it started', () => {
    // Sunday 22 November, 23:30 to Monday 05:00: still Sunday's, and still that week's.
    const running = startTimer(start(), 'study', at(22, 23, 30), ids())
    const stopped = stopTimer(running, at(23, 5), ids())
    expect(Object.values(stopped.entries)[0]).toMatchObject({ day: '2026-11-22', value: 5.5 * HOUR })
  })

  it('discards a session shorter than a minute as an accidental tap', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const stopped = stopTimer(running, at(18, 17) + 59_000, ids())
    expect(stopped.runningTimer).toBeNull()
    expect(stopped.entries).toEqual({})
  })

  it('can end the session at an earlier moment than now', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const stopped = stopTimer(running, at(19, 9), ids(), at(18, 18, 30))
    expect(Object.values(stopped.entries)[0]).toMatchObject({ value: 90 * 60, endedAt: at(18, 18, 30) })
  })

  it('never ends a session before it started or after now', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    expect(stopTimer(running, at(18, 18), ids(), at(18, 16)).entries).toEqual({})
    const capped = stopTimer(running, at(18, 18), ids(), at(18, 23))
    expect(Object.values(capped.entries)[0]).toMatchObject({ value: HOUR, endedAt: at(18, 18) })
  })

  it('saves nothing if the clock went backwards', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    expect(stopTimer(running, at(18, 16), ids()).entries).toEqual({})
  })

  it('changes nothing when no timer is running', () => {
    const data = start()
    expect(stopTimer(data, at(18, 17), ids())).toBe(data)
  })
})

describe('elapsedSec', () => {
  it('counts whole seconds and never goes below zero', () => {
    const timer = { habitId: 'gym', startedAt: at(18, 17), startDay: '2026-11-18' }
    expect(elapsedSec(timer, at(18, 17) + 61_900)).toBe(61)
    expect(elapsedSec(timer, at(18, 16))).toBe(0)
  })
})

describe('forgotten timers', () => {
  it('is overlong once past four hours by default', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    expect(DEFAULT_TIMER_MAX_SEC).toBe(4 * HOUR)
    expect(isOverlong(running, at(18, 21) - MIN)).toBe(false)
    expect(isOverlong(running, at(18, 21) + MIN)).toBe(true)
  })

  it('uses the limit set on the habit', () => {
    const data = dataWith([habit({ id: 'gym', timerMaxSec: 2 * HOUR })])
    const running = startTimer(data, 'gym', at(18, 17), ids())
    expect(isOverlong(running, at(18, 19) + MIN)).toBe(true)
  })

  it('is never overlong with no timer running', () => {
    expect(isOverlong(start(), at(18, 17))).toBe(false)
  })

  it('stops asking for another limit-length after "still going"', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const kept = keepRunning(running, at(18, 22))
    expect(isOverlong(kept, at(18, 23))).toBe(false)
    expect(isOverlong(kept, at(19, 2) + MIN)).toBe(true)
    expect(kept.runningTimer?.startedAt).toBe(at(18, 17))
  })

  it('can throw the running timer away', () => {
    const running = startTimer(start(), 'gym', at(18, 17), ids())
    const discarded = discardTimer(running)
    expect(discarded.runningTimer).toBeNull()
    expect(discarded.entries).toEqual({})
  })
})
