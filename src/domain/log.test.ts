import { describe, expect, it } from 'vitest'
import { addSession, addToCounter, deleteEntry, setDayValue, toggleCheck, updateEntry } from './log'
import { dataWith, habit, HOUR, MON, TUE, WED, WEEK } from './testing'

const NOW = 1_800_000_000_000

const check = () => habit({ id: 'vit', measure: 'check', input: 'tap', basis: 'days' })
const water = () => habit({ id: 'water', measure: 'number', input: 'counter', step: 1 })
const sleep = () => habit({ id: 'sleep', measure: 'duration', input: 'daily', basis: 'dailyAverage' })
const study = () => habit({ id: 'study' })

describe('toggleCheck', () => {
  it('ticks the day', () => {
    const data = toggleCheck(dataWith([check()]), 'vit', WED, NOW)
    expect(data.entries['vit:2026-11-18']).toEqual({
      id: 'vit:2026-11-18', habitId: 'vit', day: WED, value: 1, source: 'tap', updatedAt: NOW,
    })
  })

  it('unticks a day that was ticked', () => {
    const once = toggleCheck(dataWith([check()]), 'vit', WED, NOW)
    expect(toggleCheck(once, 'vit', WED, NOW).entries).toEqual({})
  })
})

describe('addToCounter', () => {
  it('keeps one running total per day', () => {
    let data = addToCounter(dataWith([water()]), 'water', WED, 1, NOW)
    data = addToCounter(data, 'water', WED, 2, NOW + 1)
    expect(Object.keys(data.entries)).toEqual(['water:2026-11-18'])
    expect(data.entries['water:2026-11-18']).toMatchObject({ value: 3, source: 'counter', updatedAt: NOW + 1 })
  })

  it('removes the entry when the count is taken back to zero, and never goes negative', () => {
    let data = addToCounter(dataWith([water()]), 'water', WED, 2, NOW)
    data = addToCounter(data, 'water', WED, -5, NOW)
    expect(data.entries).toEqual({})
  })
})

describe('setDayValue', () => {
  it('stores one typed value per day and replaces it on a second entry', () => {
    let data = setDayValue(dataWith([sleep()]), 'sleep', WED, 7 * HOUR, NOW)
    data = setDayValue(data, 'sleep', WED, 8 * HOUR, NOW)
    expect(Object.values(data.entries)).toHaveLength(1)
    expect(data.entries['sleep:2026-11-18']).toMatchObject({ value: 8 * HOUR, source: 'daily' })
  })

  it('keeps a typed zero, because zero is an answer', () => {
    const data = setDayValue(dataWith([sleep()]), 'sleep', WED, 0, NOW)
    expect(data.entries['sleep:2026-11-18'].value).toBe(0)
  })

  it('clears the day when given nothing', () => {
    const set = setDayValue(dataWith([sleep()]), 'sleep', WED, 7 * HOUR, NOW)
    expect(setDayValue(set, 'sleep', WED, null, NOW).entries).toEqual({})
  })

  it('corrects a counter total directly, dropping it at zero', () => {
    let data = setDayValue(dataWith([water()]), 'water', WED, 6, NOW)
    expect(data.entries['water:2026-11-18']).toMatchObject({ value: 6, source: 'manual' })
    data = setDayValue(data, 'water', WED, 0, NOW)
    expect(data.entries).toEqual({})
  })
})

describe('sessions', () => {
  it('adds each session as its own entry', () => {
    let data = addSession(dataWith([study()]), 'study', WED, 1800, 'quick', NOW, 'a')
    data = addSession(data, 'study', WED, 2700, 'quick', NOW, 'b')
    expect(data.entries.a).toEqual({ id: 'a', habitId: 'study', day: WED, value: 1800, source: 'quick', updatedAt: NOW })
    expect(Object.values(data.entries).map((e) => e.value)).toEqual([1800, 2700])
  })

  it('ignores a session of no length', () => {
    expect(addSession(dataWith([study()]), 'study', WED, 0, 'quick', NOW, 'a').entries).toEqual({})
  })

  it('changes the length of a session', () => {
    const data = addSession(dataWith([study()]), 'study', WED, 1800, 'quick', NOW, 'a')
    expect(updateEntry(data, 'a', 3600, NOW + 5).entries.a).toMatchObject({ value: 3600, updatedAt: NOW + 5 })
  })

  it('removes a session edited down to nothing', () => {
    const data = addSession(dataWith([study()]), 'study', WED, 1800, 'quick', NOW, 'a')
    expect(updateEntry(data, 'a', 0, NOW).entries).toEqual({})
  })

  it('deletes an entry', () => {
    const data = addSession(dataWith([study()]), 'study', WED, 1800, 'quick', NOW, 'a')
    expect(deleteEntry(data, 'a').entries).toEqual({})
  })
})

describe('logging in general', () => {
  it('does nothing for a habit that does not exist', () => {
    const data = dataWith([study()])
    expect(toggleCheck(data, 'nope', WED, NOW)).toBe(data)
    expect(addSession(data, 'nope', WED, 60, 'quick', NOW, 'a')).toBe(data)
  })

  it('does not change the data it was given', () => {
    const before = dataWith([water()])
    addToCounter(before, 'water', WED, 1, NOW)
    expect(before.entries).toEqual({})
  })

  it('treats a habit as having existed on any earlier day that gets logged', () => {
    const late = habit({ id: 'study', createdDay: WED, from: WEEK })
    const data = addSession(dataWith([late]), 'study', MON, 1800, 'manual', NOW, 'a')
    expect(data.habits.study.createdDay).toBe(MON)
  })

  it('extends the goal back when an earlier week gets logged', () => {
    const late = habit({ id: 'study', createdDay: WED, from: WEEK, target: { op: 'atLeast', min: HOUR } })
    const data = addSession(dataWith([late]), 'study', '2026-11-10', 1800, 'manual', NOW, 'a')
    expect(data.habits.study.createdDay).toBe('2026-11-10')
    expect(data.habits.study.rules[0].effectiveFrom).toBe('2026-11-09')
    expect(data.habits.study.membership[0].effectiveFrom).toBe('2026-11-09')
  })

  it('leaves the creation day alone when logging a later day', () => {
    const data = addSession(dataWith([habit({ id: 'study', createdDay: MON, from: WEEK })]), 'study', TUE, 60, 'quick', NOW, 'a')
    expect(data.habits.study.createdDay).toBe(MON)
  })
})
