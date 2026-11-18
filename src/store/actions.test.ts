import { describe, expect, it } from 'vitest'
import { STARTERS } from '../domain/starters'
import { createAppStore } from './createStore'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k) },
    setItem: (k, v) => { map.set(k, v) },
  }
}

// Tests run with TZ=Europe/Berlin; the default day end is 04:00.
const at = (d: number, h: number, min = 0) => new Date(2026, 10, d, h, min).getTime()

/** A store with a clock the test controls and predictable ids. */
function setup(start = at(18, 17)) {
  const clock = { now: start }
  let n = 0
  const store = createAppStore(memoryStorage(), { now: () => clock.now, newId: () => `id${++n}` })
  const s = () => store.getState()
  const [gym, , sleep, water] = STARTERS
  const add = (draft: (typeof STARTERS)[number]) => s().createHabit(draft)
  return { store, s, clock, add, gym, sleep, water }
}

describe('creating habits', () => {
  it('adds a habit under a generated id and returns the id', () => {
    const { s, add, gym } = setup()
    const id = add(gym)
    expect(id).toBe('id1')
    expect(s().data.habits.id1).toMatchObject({ name: 'Gym', createdDay: '2026-11-18' })
  })
})

describe('logging', () => {
  it('logs to today, where the small hours still belong to yesterday', () => {
    const { s, add, water, clock } = setup()
    const id = add(water)
    clock.now = at(19, 1)
    s().bump(id, 1)
    expect(Object.values(s().data.entries)[0]).toMatchObject({ day: '2026-11-18', value: 1 })
  })

  it('logs to another day when one is given', () => {
    const { s, add, sleep } = setup()
    const id = add(sleep)
    s().setValue(id, 7 * 3600, '2026-11-16')
    expect(Object.values(s().data.entries)[0]).toMatchObject({ day: '2026-11-16', value: 7 * 3600 })
  })

  it('announces what was saved and can undo it', () => {
    const { s, add, water } = setup()
    const id = add(water)
    s().bump(id, 1)
    s().bump(id, 1)
    expect(s().toast?.message).toBe('Water: 2 glasses')
    s().undo()
    expect(Object.values(s().data.entries)[0].value).toBe(1)
    expect(s().toast).toBeNull()
  })

  it('says nothing when an action changed nothing', () => {
    const { s } = setup()
    s().bump('missing', 1)
    expect(s().toast).toBeNull()
  })
})

describe('the timer', () => {
  it('saves a session on stop and reports its length', () => {
    const { s, add, gym, clock } = setup()
    const id = add(gym)
    s().startTimer(id)
    expect(s().data.runningTimer?.habitId).toBe(id)
    clock.now = at(18, 18, 12)
    s().stopTimer()
    expect(s().data.runningTimer).toBeNull()
    expect(Object.values(s().data.entries)[0]).toMatchObject({ value: 72 * 60, day: '2026-11-18' })
    expect(s().toast?.message).toBe('Saved 1h 12m of Gym')
  })

  it('says so when a session was too short to save, and undo resumes it', () => {
    const { s, add, gym, clock } = setup()
    const id = add(gym)
    s().startTimer(id)
    clock.now += 20_000
    s().stopTimer()
    expect(s().data.entries).toEqual({})
    expect(s().toast?.message).toBe('Under a minute, not saved')
    s().undo()
    expect(s().data.runningTimer?.habitId).toBe(id)
  })

  it('will not start another timer while a forgotten one is waiting for an answer', () => {
    const { s, add, gym, clock } = setup()
    const first = add(gym)
    const second = add({ ...gym, name: 'Run' })
    s().startTimer(first)
    clock.now = at(18, 23)
    s().startTimer(second)
    expect(s().data.runningTimer?.habitId).toBe(first)
  })

  it('ends a forgotten timer at the length the user gives', () => {
    const { s, add, gym, clock } = setup()
    const id = add(gym)
    s().startTimer(id)
    clock.now = at(19, 9)
    s().stopTimerAfter(90 * 60)
    expect(Object.values(s().data.entries)[0]).toMatchObject({ value: 90 * 60, day: '2026-11-18' })
  })
})

describe('habit changes', () => {
  it('applies a changed goal from the current week', () => {
    const { s, add, gym, clock } = setup()
    const id = add(gym)
    clock.now = at(25, 12)
    s().setRule(id, { basis: 'days', target: { op: 'atLeast', min: 4 } })
    expect(s().data.habits[id].rules.map((r) => r.effectiveFrom)).toEqual(['2026-11-16', '2026-11-23'])
  })

  it('can undo deleting a habit', () => {
    const { s, add, water } = setup()
    const id = add(water)
    s().bump(id, 3)
    s().deleteHabit(id)
    expect(s().data.habits[id]).toBeUndefined()
    s().undo()
    expect(s().data.habits[id].name).toBe('Water')
    expect(Object.values(s().data.entries)).toHaveLength(1)
  })

  it('changes the day-end hour', () => {
    const { s } = setup()
    s().setSettings({ dayEndHour: 2 })
    expect(s().data.settings.dayEndHour).toBe(2)
  })
})
