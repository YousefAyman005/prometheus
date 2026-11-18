import { describe, expect, it } from 'vitest'
import { weekFigure, weekStatus } from './evaluate'
import { describeWeek, formatClock, formatDuration, formatNumber } from './format'
import { dataWith, entry, FRI, habit, HOUR, MON, NEXT_MON, THU, TUE, WED, WEEK } from './testing'
import type { Entry, Habit } from './types'

describe('formatDuration', () => {
  it('writes hours and minutes the short way', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(45 * 60)).toBe('45m')
    expect(formatDuration(HOUR)).toBe('1h')
    expect(formatDuration(7.5 * HOUR)).toBe('7h 30m')
  })

  it('rounds to the nearest minute, carrying into the hour', () => {
    expect(formatDuration(7 * HOUR + 10 * 60 + 29)).toBe('7h 10m')
    expect(formatDuration(HOUR - 20)).toBe('1h')
  })

  it('shows a short but real amount as under a minute, not as nothing', () => {
    expect(formatDuration(20)).toBe('<1m')
  })
})

describe('formatClock', () => {
  it('shows a running timer as a clock', () => {
    expect(formatClock(7)).toBe('0:07')
    expect(formatClock(12 * 60 + 34)).toBe('12:34')
    expect(formatClock(HOUR + 2 * 60 + 3)).toBe('1:02:03')
  })
})

describe('formatNumber', () => {
  it('shows whole numbers plainly and others to one decimal', () => {
    expect(formatNumber(31)).toBe('31')
    expect(formatNumber(14 / 3)).toBe('4.7')
    expect(formatNumber(8.04)).toBe('8')
  })
})

describe('describeWeek', () => {
  function view(h: Habit, entries: Entry[], today = WED) {
    const data = dataWith([h], entries)
    return describeWeek(h, weekFigure(h, data, WEEK, today), weekStatus(h, data, WEEK, today))
  }

  it('shows time against a total goal', () => {
    const h = habit({ id: 'study', target: { op: 'atLeast', min: 12 * HOUR } })
    const v = view(h, [entry('study', MON, 7.5 * HOUR)])
    expect(v.text).toBe('7h 30m of 12h')
    expect(v.fraction).toBeCloseTo(0.625)
    expect(v.tone).toBe('neutral')
  })

  it('shows days done, and the time spent on them, for a days goal on a timed habit', () => {
    const h = habit({ id: 'gym', basis: 'days', target: { op: 'atLeast', min: 3 } })
    const v = view(h, [entry('gym', MON, HOUR), entry('gym', TUE, 1.5 * HOUR)])
    expect(v.text).toBe('2 of 3 days')
    expect(v.extra).toBe('2h 30m')
  })

  it('names the unit of a counted goal', () => {
    const h = habit({ id: 'read', measure: 'number', input: 'counter', unit: 'pages', target: { op: 'atLeast', min: 50 } })
    expect(view(h, [entry('read', MON, 31)]).text).toBe('31 of 50 pages')
  })

  it('turns good and fills the bar when the goal is hit', () => {
    const h = habit({ id: 'study', target: { op: 'atLeast', min: 2 * HOUR } })
    const v = view(h, [entry('study', MON, 3 * HOUR)])
    expect(v.tone).toBe('good')
    expect(v.fraction).toBe(1)
  })

  it('shows an average against a window, with where the window starts on the bar', () => {
    const h = habit({
      id: 'sleep', input: 'daily', basis: 'dailyAverage',
      target: { op: 'between', min: 7 * HOUR, max: 9 * HOUR },
    })
    const v = view(h, [entry('sleep', MON, 7 * HOUR), entry('sleep', TUE, 7.5 * HOUR)], THU)
    expect(v.text).toBe('7h 15m average, aim 7h to 9h')
    expect(v.windowStart).toBeCloseTo(7 / 9)
    expect(v.tone).toBe('neutral')
  })

  it('shows a limit and turns bad once over it', () => {
    const h = habit({
      id: 'screen', input: 'daily', basis: 'dailyAverage', target: { op: 'atMost', max: 3 * HOUR },
    })
    const under = view(h, [entry('screen', MON, 2 * HOUR)], THU)
    expect(under.text).toBe('2h average, limit 3h')
    expect(under.tone).toBe('neutral')
    const over = view(h, [entry('screen', MON, 4 * HOUR)], THU)
    expect(over.tone).toBe('bad')
    expect(over.fraction).toBe(1)
  })

  it('says so when a typed habit has nothing logged yet', () => {
    const h = habit({
      id: 'sleep', input: 'daily', basis: 'dailyAverage',
      target: { op: 'between', min: 7 * HOUR, max: 9 * HOUR },
    })
    const v = view(h, [])
    expect(v.text).toBe('Nothing logged, aim 7h to 9h')
    expect(v.fraction).toBe(0)
  })

  it('shows just the amount when there is no goal', () => {
    const h = habit({ id: 'study' })
    const v = view(h, [entry('study', MON, 4.25 * HOUR)])
    expect(v.text).toBe('4h 15m')
    expect(v.fraction).toBeNull()
  })

  it('says when the week is paused', () => {
    const h = habit({ id: 'study', target: { op: 'atLeast', min: 12 * HOUR } })
    const data = dataWith([h], [entry('study', MON, HOUR)])
    data.pauses[WEEK] = { ids: ['study'] }
    const v = describeWeek(h, weekFigure(h, data, WEEK, FRI), weekStatus(h, data, WEEK, FRI))
    expect(v.text).toBe('1h, paused this week')
    expect(v.tone).toBe('muted')
  })

  it('counts ticks for a yes/no habit', () => {
    const h = habit({ id: 'vit', measure: 'check', input: 'tap', basis: 'days', target: { op: 'atLeast', min: 7 } })
    const v = view(h, [entry('vit', MON, 1), entry('vit', TUE, 1)])
    expect(v.text).toBe('2 of 7 days')
    expect(v.extra).toBeNull()
  })

  it('uses the singular for a goal of one day', () => {
    const h = habit({ id: 'vit', measure: 'check', input: 'tap', basis: 'days', target: { op: 'atLeast', min: 1 } })
    expect(view(h, []).text).toBe('0 of 1 day')
  })

  it('turns bad for a finished week that was missed', () => {
    const h = habit({ id: 'study', target: { op: 'atLeast', min: 12 * HOUR } })
    const data = dataWith([h], [entry('study', MON, HOUR)])
    const v = describeWeek(h, weekFigure(h, data, WEEK, NEXT_MON), weekStatus(h, data, WEEK, NEXT_MON))
    expect(v.tone).toBe('bad')
  })
})
