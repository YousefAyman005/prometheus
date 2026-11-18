import { describe, expect, it } from 'vitest'
import {
  activeHabits, archivedHabits, archiveHabit, createHabit, deleteHabit, editHabit, type HabitDraft,
  isValidPair, setRule, targetProblem, unarchiveHabit,
} from './habits'
import { emptyData } from './migrate'
import { STARTERS } from './starters'
import { dataWith, entry, habit, HOUR, MON, WED, WEEK } from './testing'

const draft = (extra: Partial<HabitDraft> = {}): HabitDraft => ({
  name: 'Study', emoji: '📚', color: 'blue', measure: 'duration', input: 'timer',
  basis: 'total', target: { op: 'atLeast', min: 12 * HOUR }, ...extra,
})

describe('isValidPair', () => {
  it('accepts the five ways a habit can be logged', () => {
    expect(isValidPair('check', 'tap')).toBe(true)
    expect(isValidPair('duration', 'timer')).toBe(true)
    expect(isValidPair('duration', 'daily')).toBe(true)
    expect(isValidPair('number', 'counter')).toBe(true)
    expect(isValidPair('number', 'daily')).toBe(true)
  })

  it('rejects combinations that make no sense', () => {
    expect(isValidPair('check', 'timer')).toBe(false)
    expect(isValidPair('number', 'timer')).toBe(false)
    expect(isValidPair('duration', 'counter')).toBe(false)
  })
})

describe('targetProblem', () => {
  it('accepts sensible goals and no goal', () => {
    expect(targetProblem(null)).toBeNull()
    expect(targetProblem({ op: 'atLeast', min: 3 })).toBeNull()
    expect(targetProblem({ op: 'atMost', max: 0 })).toBeNull()
    expect(targetProblem({ op: 'between', min: 7, max: 9 })).toBeNull()
  })

  it('explains what is wrong with a goal', () => {
    expect(targetProblem({ op: 'atLeast', min: 0 })).toMatch(/more than zero/i)
    expect(targetProblem({ op: 'atMost', max: -1 })).toMatch(/negative/i)
    expect(targetProblem({ op: 'between', min: 9, max: 7 })).toMatch(/lower.*higher|smaller/i)
    expect(targetProblem({ op: 'atLeast', min: Number.NaN })).toMatch(/number/i)
  })
})

describe('createHabit', () => {
  it('starts the habit today with its goal applying from this week', () => {
    const data = createHabit(emptyData(), draft(), WED, 'h1')
    expect(data.habits.h1).toMatchObject({
      id: 'h1', name: 'Study', measure: 'duration', input: 'timer',
      createdDay: WED, archivedDay: null,
      rules: [{ effectiveFrom: WEEK, basis: 'total', target: { op: 'atLeast', min: 12 * HOUR } }],
      membership: [{ effectiveFrom: WEEK, groupId: null }],
    })
  })

  it('places a new habit after the existing ones', () => {
    let data = createHabit(emptyData(), draft({ name: 'A' }), WED, 'a')
    data = createHabit(data, draft({ name: 'B' }), WED, 'b')
    expect(activeHabits(data).map((h) => h.name)).toEqual(['A', 'B'])
  })

  it('trims the name and refuses an empty one', () => {
    expect(createHabit(emptyData(), draft({ name: '  Gym  ' }), WED, 'h').habits.h.name).toBe('Gym')
    expect(() => createHabit(emptyData(), draft({ name: '   ' }), WED, 'h')).toThrow(/name/i)
  })

  it('refuses a measure and input that do not go together', () => {
    expect(() => createHabit(emptyData(), draft({ measure: 'check', input: 'timer' }), WED, 'h')).toThrow()
  })

  it('always judges a yes/no habit by days', () => {
    const data = createHabit(
      emptyData(),
      draft({ measure: 'check', input: 'tap', basis: 'total', target: { op: 'atLeast', min: 5 } }),
      WED, 'h',
    )
    expect(data.habits.h.rules[0].basis).toBe('days')
  })

  it('does not change the data it was given', () => {
    const before = emptyData()
    createHabit(before, draft(), WED, 'h1')
    expect(before.habits).toEqual({})
  })
})

describe('starter suggestions', () => {
  it('can all be created as they are', () => {
    let data = emptyData()
    STARTERS.forEach((starter, i) => {
      expect(targetProblem(starter.target)).toBeNull()
      data = createHabit(data, starter, WED, `s${i}`)
    })
    expect(activeHabits(data)).toHaveLength(STARTERS.length)
  })
})

describe('editHabit', () => {
  it('changes how a habit looks without touching how it is measured', () => {
    const data = dataWith([habit({ id: 'h', name: 'Old' })])
    const edited = editHabit(data, 'h', { name: 'New', emoji: '🚀', color: 'green' }).habits.h
    expect(edited).toMatchObject({ name: 'New', emoji: '🚀', color: 'green', measure: 'duration', input: 'timer' })
  })

  it('keeps the old name when the new one is blank', () => {
    const data = dataWith([habit({ id: 'h', name: 'Old' })])
    expect(editHabit(data, 'h', { name: '  ' }).habits.h.name).toBe('Old')
  })
})

describe('setRule', () => {
  const start = () => dataWith([habit({ id: 'h', from: '2026-11-02', target: { op: 'atLeast', min: 5 * HOUR } })])

  it('adds a new goal from the given week and leaves earlier weeks alone', () => {
    const data = setRule(start(), 'h', { basis: 'total', target: { op: 'atLeast', min: 12 * HOUR } }, WEEK)
    expect(data.habits.h.rules).toEqual([
      { effectiveFrom: '2026-11-02', basis: 'total', target: { op: 'atLeast', min: 5 * HOUR } },
      { effectiveFrom: WEEK, basis: 'total', target: { op: 'atLeast', min: 12 * HOUR } },
    ])
  })

  it('replaces a goal already set for the same week', () => {
    let data = setRule(start(), 'h', { basis: 'total', target: { op: 'atLeast', min: 12 * HOUR } }, WEEK)
    data = setRule(data, 'h', { basis: 'days', target: { op: 'atLeast', min: 4 } }, WEEK)
    expect(data.habits.h.rules).toHaveLength(2)
    expect(data.habits.h.rules[1]).toEqual({ effectiveFrom: WEEK, basis: 'days', target: { op: 'atLeast', min: 4 } })
  })

  it('adds nothing when the goal has not changed', () => {
    const data = setRule(start(), 'h', { basis: 'total', target: { op: 'atLeast', min: 5 * HOUR } }, WEEK)
    expect(data.habits.h.rules).toHaveLength(1)
  })

  it('can remove the goal from this week on', () => {
    const data = setRule(start(), 'h', { basis: 'total', target: null }, WEEK)
    expect(data.habits.h.rules[1]).toEqual({ effectiveFrom: WEEK, basis: 'total', target: null })
  })
})

describe('archiving and deleting', () => {
  const start = () => dataWith(
    [habit({ id: 'keep', order: 0 }), habit({ id: 'gone', order: 1 })],
    [entry('keep', MON, HOUR), entry('gone', MON, HOUR, { id: 'x' })],
  )

  it('hides an archived habit but keeps what was logged', () => {
    const data = archiveHabit(start(), 'gone', WED)
    expect(activeHabits(data).map((h) => h.id)).toEqual(['keep'])
    expect(archivedHabits(data).map((h) => h.id)).toEqual(['gone'])
    expect(data.habits.gone.archivedDay).toBe(WED)
    expect(data.entries.x).toBeDefined()
  })

  it('brings an archived habit back', () => {
    const data = unarchiveHabit(archiveHabit(start(), 'gone', WED), 'gone', WED)
    expect(activeHabits(data).map((h) => h.id)).toEqual(['keep', 'gone'])
    expect(data.pauses).toEqual({})
  })

  it('marks the weeks a habit spent archived as paused, so they do not count as missed', () => {
    // Archived on Wednesday 18 Nov, brought back on Wednesday 9 Dec: two full weeks away.
    const data = unarchiveHabit(archiveHabit(start(), 'gone', WED), 'gone', '2026-12-09')
    expect(data.pauses).toEqual({
      '2026-11-23': { ids: ['gone'] },
      '2026-11-30': { ids: ['gone'] },
    })
  })

  it('removes a deleted habit together with its entries', () => {
    const data = deleteHabit(start(), 'gone')
    expect(data.habits.gone).toBeUndefined()
    expect(data.entries.x).toBeUndefined()
    expect(Object.values(data.entries)).toHaveLength(1)
  })

  it('stops a timer that was running on an archived or deleted habit', () => {
    const running = { ...start(), runningTimer: { habitId: 'gone', startedAt: 0, startDay: MON } }
    expect(deleteHabit(running, 'gone').runningTimer).toBeNull()
    expect(archiveHabit(running, 'gone', WED).runningTimer).toBeNull()
    expect(deleteHabit(running, 'keep').runningTimer).not.toBeNull()
  })
})
