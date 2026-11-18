import { describe, expect, it } from 'vitest'
import { dayValue, versionAt, weekFigure, weekStatus } from './evaluate'
import {
  dataWith, entry, FRI, habit, HOUR, MON, NEXT_MON, SAT, SUN, THU, TUE, WED, WEEK,
} from './testing'
import type { Habit } from './types'

const study = (extra = {}) => habit({ id: 'study', measure: 'duration', input: 'timer', ...extra })
const sleep = (extra = {}) =>
  habit({ id: 'sleep', measure: 'duration', input: 'daily', basis: 'dailyAverage', ...extra })
const counter = (extra = {}) => habit({ id: 'count', measure: 'number', input: 'counter', ...extra })

describe('versionAt', () => {
  const history = [
    { effectiveFrom: '2026-11-02', v: 'a' },
    { effectiveFrom: '2026-11-16', v: 'b' },
  ]

  it('picks the latest version that had started by that week', () => {
    expect(versionAt(history, '2026-11-09')?.v).toBe('a')
    expect(versionAt(history, '2026-11-16')?.v).toBe('b')
    expect(versionAt(history, '2026-12-07')?.v).toBe('b')
  })

  it('has no version before the first one started', () => {
    expect(versionAt(history, '2026-10-26')).toBeUndefined()
  })
})

describe('dayValue', () => {
  it('adds up the sessions of an accumulating habit', () => {
    expect(dayValue(study(), [entry('study', MON, 1800), entry('study', MON, 2700)])).toBe(4500)
  })

  it('is a real zero for an accumulating habit with nothing logged', () => {
    expect(dayValue(study(), [])).toBe(0)
  })

  it('is unknown for a typed habit with nothing logged', () => {
    expect(dayValue(sleep(), [])).toBeNull()
  })

  it('keeps a typed zero as a real value', () => {
    expect(dayValue(sleep(), [entry('sleep', MON, 0)])).toBe(0)
  })
})

describe('weekFigure', () => {
  it('totals the week and leaves future days empty', () => {
    const data = dataWith([study()], [entry('study', MON, HOUR), entry('study', WED, 1.5 * HOUR)])
    const figure = weekFigure(data.habits.study, data, WEEK, WED)
    expect(figure.perDay).toEqual([HOUR, 0, 1.5 * HOUR, null, null, null, null])
    expect(figure.total).toBe(2.5 * HOUR)
    expect(figure.value).toBe(2.5 * HOUR)
    expect(figure.doneDays).toBe(2)
    expect(figure.elapsedDays).toBe(3)
    expect(figure.activeDays).toBe(7)
  })

  it('counts days done when the goal is in days', () => {
    const gym = study({ id: 'gym', basis: 'days' })
    const data = dataWith([gym], [entry('gym', MON, HOUR), entry('gym', MON, 600), entry('gym', WED, HOUR)])
    expect(weekFigure(gym, data, WEEK, THU).value).toBe(2)
  })

  it('averages an accumulating habit over the days elapsed so far', () => {
    const water = counter({ basis: 'dailyAverage' })
    const data = dataWith([water], [entry('count', MON, 8), entry('count', TUE, 6)])
    expect(weekFigure(water, data, WEEK, WED).value).toBeCloseTo(14 / 3)
  })

  it('averages an accumulating habit over all seven days once the week is over', () => {
    const water = counter({ basis: 'dailyAverage' })
    const data = dataWith([water], [entry('count', MON, 8), entry('count', TUE, 6)])
    expect(weekFigure(water, data, WEEK, NEXT_MON).value).toBeCloseTo(2)
  })

  it('averages a typed habit over the days that were logged', () => {
    const data = dataWith([sleep()], [entry('sleep', MON, 7 * HOUR), entry('sleep', TUE, 8 * HOUR)])
    const figure = weekFigure(data.habits.sleep, data, WEEK, THU)
    expect(figure.value).toBe(7.5 * HOUR)
    expect(figure.loggedDays).toBe(2)
    expect(figure.perDay.slice(0, 4)).toEqual([7 * HOUR, 8 * HOUR, null, null])
  })

  it('has no figure for a typed habit with nothing logged', () => {
    const data = dataWith([sleep()])
    expect(weekFigure(data.habits.sleep, data, WEEK, THU).value).toBeNull()
  })

  it('only counts the days since a habit was created', () => {
    const water = counter({ basis: 'dailyAverage', createdDay: WED, from: WEEK })
    const data = dataWith([water], [entry('count', WED, 6), entry('count', THU, 10)])
    const figure = weekFigure(water, data, WEEK, THU)
    expect(figure.activeDays).toBe(5)
    expect(figure.elapsedDays).toBe(2)
    expect(figure.value).toBe(8)
    expect(figure.perDay.slice(0, 2)).toEqual([null, null])
  })

  it('judges each week by the basis in force that week', () => {
    const h: Habit = {
      ...study(),
      rules: [
        { effectiveFrom: '2026-11-02', basis: 'total', target: null },
        { effectiveFrom: WEEK, basis: 'days', target: null },
      ],
    }
    const data = dataWith([h], [entry('study', '2026-11-10', HOUR), entry('study', MON, HOUR)])
    expect(weekFigure(h, data, '2026-11-09', NEXT_MON).value).toBe(HOUR)
    expect(weekFigure(h, data, WEEK, NEXT_MON).value).toBe(1)
  })
})

describe('weekStatus: when a habit is not judged', () => {
  it('is inactive before the week it was created', () => {
    const h = study({ createdDay: WED, from: WEEK, target: { op: 'atLeast', min: HOUR } })
    expect(weekStatus(h, dataWith([h]), '2026-11-09', WED)).toEqual({ state: 'inactive' })
  })

  it('is inactive for a week that has not started', () => {
    const h = study({ target: { op: 'atLeast', min: HOUR } })
    expect(weekStatus(h, dataWith([h]), NEXT_MON, WED)).toEqual({ state: 'inactive' })
  })

  it('is inactive after the week it was archived', () => {
    const h = study({ archivedDay: '2026-11-11', target: { op: 'atLeast', min: HOUR } })
    expect(weekStatus(h, dataWith([h]), WEEK, WED)).toEqual({ state: 'inactive' })
  })

  it('is just tracking when there is no goal', () => {
    const h = study()
    expect(weekStatus(h, dataWith([h]), WEEK, WED)).toEqual({ state: 'tracking' })
  })

  it('is paused when the habit is paused that week', () => {
    const h = study({ target: { op: 'atLeast', min: HOUR } })
    const data = dataWith([h])
    data.pauses[WEEK] = { ids: ['study'] }
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'paused' })
    expect(weekStatus(h, data, '2026-11-09', WED).state).not.toBe('paused')
  })

  it('is paused when everything is paused that week', () => {
    const h = study({ target: { op: 'atLeast', min: HOUR } })
    const data = dataWith([h])
    data.pauses[WEEK] = { all: true, ids: [] }
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'paused' })
  })
})

describe('weekStatus: at least', () => {
  const goal = { target: { op: 'atLeast', min: 12 * HOUR } as const }

  it('is hit the moment the total is reached, before the week ends', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 7 * HOUR), entry('study', TUE, 5 * HOUR)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'hit', final: false })
  })

  it('is a final hit once the week is over', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 12 * HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('is missed when the week ends short', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 11 * HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'below' })
  })

  it('is open and on pace when ahead of an even spread', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 6 * HOUR)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'open', onTrack: true })
  })

  it('is open and behind when short of an even spread', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 2 * HOUR)])
    expect(weekStatus(h, data, WEEK, FRI)).toEqual({ state: 'open', onTrack: false })
  })

  it('counts days for a days goal', () => {
    const gym = study({ id: 'gym', basis: 'days', target: { op: 'atLeast', min: 3 } })
    const data = dataWith([gym], [entry('gym', MON, HOUR), entry('gym', WED, HOUR), entry('gym', FRI, HOUR)])
    expect(weekStatus(gym, data, WEEK, FRI)).toEqual({ state: 'hit', final: false })
  })

  it('needs the full week of an average before calling it hit', () => {
    const water = counter({ basis: 'dailyAverage', target: { op: 'atLeast', min: 8 } })
    const early = dataWith([water], [entry('count', MON, 10)])
    expect(weekStatus(water, early, WEEK, MON)).toEqual({ state: 'open', onTrack: true })
    const secured = dataWith([water], [entry('count', MON, 30), entry('count', TUE, 26)])
    expect(weekStatus(water, secured, WEEK, THU)).toEqual({ state: 'hit', final: false })
  })
})

describe('weekStatus: at most', () => {
  const takeaway = () => counter({ id: 'take', target: { op: 'atMost', max: 2 } })

  it('is open and on track while under the cap', () => {
    const h = takeaway()
    const data = dataWith([h], [entry('take', MON, 1)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'open', onTrack: true })
  })

  it('is missed as soon as the cap is passed', () => {
    const h = takeaway()
    const data = dataWith([h], [entry('take', MON, 3)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'missed', final: false, reason: 'above' })
  })

  it('is hit when the week ends at or under the cap', () => {
    const h = takeaway()
    const data = dataWith([h], [entry('take', MON, 2)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('is hit at zero when the app was used that week', () => {
    const h = takeaway()
    const other = study()
    const data = dataWith([h, other], [entry('study', TUE, HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('is not hit at zero when nothing at all was logged that week', () => {
    const h = takeaway()
    expect(weekStatus(h, dataWith([h]), WEEK, NEXT_MON)).toEqual({
      state: 'missed', final: true, reason: 'noData',
    })
  })

  it('lets an average recover while the week is running', () => {
    const coffee = counter({ basis: 'dailyAverage', target: { op: 'atMost', max: 3 } })
    const data = dataWith([coffee], [entry('count', MON, 5)])
    expect(weekStatus(coffee, data, WEEK, MON)).toEqual({ state: 'open', onTrack: false })
  })

  it('is missed once an average can no longer come back under the cap', () => {
    const coffee = counter({ basis: 'dailyAverage', target: { op: 'atMost', max: 3 } })
    const data = dataWith([coffee], [entry('count', MON, 12), entry('count', TUE, 10)])
    expect(weekStatus(coffee, data, WEEK, WED)).toEqual({ state: 'missed', final: false, reason: 'above' })
  })
})

describe('weekStatus: between', () => {
  const goal = { target: { op: 'between', min: 10 * HOUR, max: 14 * HOUR } as const }

  it('is hit when the week ends inside the window', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 12 * HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('is missed below and above the window', () => {
    const h = study(goal)
    const low = dataWith([h], [entry('study', MON, 8 * HOUR)])
    const high = dataWith([h], [entry('study', MON, 15 * HOUR)])
    expect(weekStatus(h, low, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'below' })
    expect(weekStatus(h, high, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'above' })
  })

  it('is never hit early, even inside the window', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 12 * HOUR)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'open', onTrack: true })
  })

  it('is missed early once the top of the window is passed', () => {
    const h = study(goal)
    const data = dataWith([h], [entry('study', MON, 15 * HOUR)])
    expect(weekStatus(h, data, WEEK, WED)).toEqual({ state: 'missed', final: false, reason: 'above' })
  })
})

describe('weekStatus: typed averages', () => {
  const goal = { target: { op: 'between', min: 7 * HOUR, max: 9 * HOUR } as const }
  const nights = (days: string[], hours: number) => days.map((d) => entry('sleep', d, hours * HOUR))

  it('is hit with enough logged days inside the window', () => {
    const h = sleep(goal)
    const data = dataWith([h], nights([MON, TUE, WED, THU, FRI], 8))
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('is not enough data with fewer than four logged days', () => {
    const h = sleep(goal)
    const data = dataWith([h], nights([MON, TUE, WED], 8))
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'noData' })
  })

  it('is missed when the average lands outside the window', () => {
    const h = sleep(goal)
    const data = dataWith([h], nights([MON, TUE, WED, THU], 6))
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'below' })
  })

  it('never gets a verdict before the week ends, because one night can move the average', () => {
    const h = sleep(goal)
    const inside = dataWith([h], nights([MON, TUE, WED, THU, FRI, SAT], 8))
    const outside = dataWith([h], nights([MON, TUE], 5))
    expect(weekStatus(h, inside, WEEK, SUN)).toEqual({ state: 'open', onTrack: true })
    expect(weekStatus(h, outside, WEEK, WED)).toEqual({ state: 'open', onTrack: false })
  })

  it('is open and not on track with nothing logged yet', () => {
    const h = sleep(goal)
    expect(weekStatus(h, dataWith([h]), WEEK, WED)).toEqual({ state: 'open', onTrack: false })
  })

  it('judges an at-most average the same way', () => {
    const screen = sleep({ id: 'screen', target: { op: 'atMost', max: 3 * HOUR } })
    const under = dataWith([screen], [MON, TUE, WED, THU].map((d) => entry('screen', d, 2.5 * HOUR)))
    const over = dataWith([screen], [MON, TUE, WED, THU].map((d) => entry('screen', d, 3.5 * HOUR)))
    expect(weekStatus(screen, under, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
    expect(weekStatus(screen, over, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'above' })
  })

  it('asks for fewer logged days in a week the habit only partly existed', () => {
    const h = sleep({ ...goal, createdDay: FRI, from: WEEK })
    const data = dataWith([h], nights([FRI, SAT, SUN], 8))
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })
})

describe('weekStatus: first and last weeks, and changed goals', () => {
  it('ignores a missed week if the habit was created during it', () => {
    const h = study({ createdDay: FRI, from: WEEK, target: { op: 'atLeast', min: 12 * HOUR } })
    const data = dataWith([h], [entry('study', FRI, HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'grace' })
  })

  it('still counts the creation week when it was hit', () => {
    const h = study({ createdDay: FRI, from: WEEK, target: { op: 'atLeast', min: HOUR } })
    const data = dataWith([h], [entry('study', FRI, HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'hit', final: true })
  })

  it('ignores a missed week if the habit was archived during it', () => {
    const h = study({ archivedDay: WED, target: { op: 'atLeast', min: 12 * HOUR } })
    const data = dataWith([h], [entry('study', MON, HOUR)])
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'grace' })
  })

  it('judges an earlier week by the goal it had then', () => {
    const h: Habit = {
      ...study(),
      rules: [
        { effectiveFrom: '2026-11-02', basis: 'total', target: { op: 'atLeast', min: 5 * HOUR } },
        { effectiveFrom: WEEK, basis: 'total', target: { op: 'atLeast', min: 12 * HOUR } },
      ],
    }
    const data = dataWith([h], [entry('study', '2026-11-10', 6 * HOUR), entry('study', MON, 6 * HOUR)])
    expect(weekStatus(h, data, '2026-11-09', NEXT_MON)).toEqual({ state: 'hit', final: true })
    expect(weekStatus(h, data, WEEK, NEXT_MON)).toEqual({ state: 'missed', final: true, reason: 'below' })
  })
})
