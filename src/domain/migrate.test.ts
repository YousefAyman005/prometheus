import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, emptyData, migrate, NewerVersionError } from './migrate'

describe('emptyData', () => {
  it('starts at the current schema version with a 4am day end', () => {
    const data = emptyData()
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(data.settings.dayEndHour).toBe(4)
    expect(data.habits).toEqual({})
    expect(data.runningTimer).toBeNull()
  })
})

describe('migrate', () => {
  it('returns current-version data unchanged', () => {
    const data = emptyData()
    data.habits.h1 = {
      id: 'h1', name: 'Gym', emoji: '🏋️', color: 'orange', order: 0,
      measure: 'duration', input: 'timer',
      rules: [{ effectiveFrom: '2026-11-16', basis: 'days', target: { op: 'atLeast', min: 3 } }],
      membership: [{ effectiveFrom: '2026-11-16', groupId: null }],
      createdDay: '2026-11-18', archivedDay: null,
    }
    expect(migrate(structuredClone(data))).toEqual(data)
  })

  it('refuses data written by a newer version of the app', () => {
    const newer = { ...emptyData(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }
    expect(() => migrate(newer)).toThrow(NewerVersionError)
  })

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['an object without a version', { habits: {} }],
    ['a non-numeric version', { schemaVersion: 'one' }],
    ['a version below 1', { schemaVersion: 0 }],
  ])('rejects %s as not Prometheus data', (_label, raw) => {
    expect(() => migrate(raw)).toThrow(/not valid Prometheus data/i)
  })

  it('rejects current-version data whose collections are missing', () => {
    const broken = { ...emptyData(), entries: undefined }
    expect(() => migrate(broken)).toThrow(/not valid Prometheus data/i)
  })

  it('fills in settings added after the data was written', () => {
    const old = { ...emptyData(), settings: {} }
    expect(migrate(old).settings).toEqual(emptyData().settings)
  })
})
