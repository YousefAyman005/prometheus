import { describe, expect, it } from 'vitest'
import { backupFileName, buildBackup, parseBackup, shouldNudgeBackup } from './backup'
import { CURRENT_SCHEMA_VERSION, emptyData } from './migrate'
import type { AppData } from './types'

const NOW = Date.UTC(2026, 10, 18, 21, 5, 0)

function sample(): AppData {
  const data = emptyData()
  data.habits.h1 = {
    id: 'h1', name: 'Water', emoji: '💧', color: 'blue', order: 0,
    measure: 'number', input: 'counter', unit: 'glasses', step: 1,
    rules: [{ effectiveFrom: '2026-11-16', basis: 'total', target: { op: 'atLeast', min: 56 } }],
    membership: [{ effectiveFrom: '2026-11-16', groupId: null }],
    createdDay: '2026-11-16', archivedDay: null,
  }
  data.entries['h1:2026-11-18'] = {
    id: 'h1:2026-11-18', habitId: 'h1', day: '2026-11-18', value: 4, source: 'counter', updatedAt: NOW,
  }
  return data
}

describe('buildBackup', () => {
  it('wraps the data with format, version and export time', () => {
    const backup = buildBackup(sample(), NOW, '0.1.0')
    expect(backup.format).toBe('prometheus-backup')
    expect(backup.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(backup.exportedAt).toBe('2026-11-18T21:05:00.000Z')
    expect(backup.appVersion).toBe('0.1.0')
    expect(backup.data).toEqual(sample())
  })
})

describe('parseBackup', () => {
  it('round-trips a backup back to the same data', () => {
    const text = JSON.stringify(buildBackup(sample(), NOW, '0.1.0'))
    const parsed = parseBackup(text)
    expect(parsed.data).toEqual(sample())
    expect(parsed.exportedAt).toBe('2026-11-18T21:05:00.000Z')
  })

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json at all')).toThrow(/not a Prometheus backup/i)
  })

  it('rejects JSON that is some other file', () => {
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(/not a Prometheus backup/i)
  })

  it('rejects a backup made by a newer version of the app', () => {
    const backup = buildBackup(sample(), NOW, '9.9.9')
    backup.schemaVersion = CURRENT_SCHEMA_VERSION + 1
    backup.data.schemaVersion = CURRENT_SCHEMA_VERSION + 1
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/newer version/i)
  })

  it('rejects a backup whose data is damaged', () => {
    const backup = buildBackup(sample(), NOW, '0.1.0') as unknown as { data: Record<string, unknown> }
    delete backup.data.entries
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/not valid Prometheus data/i)
  })
})

describe('backupFileName', () => {
  it('names the file by local date so backups sort by age', () => {
    expect(backupFileName(new Date(2026, 10, 18, 22, 5).getTime())).toBe('prometheus-backup-2026-11-18.json')
  })
})

describe('shouldNudgeBackup', () => {
  const DAY = 86_400_000
  const loggedAt = (ms: number) => {
    const data = sample()
    data.entries['h1:2026-11-18'].updatedAt = ms
    return data
  }

  it('never nudges when nothing has been logged', () => {
    expect(shouldNudgeBackup(emptyData(), null, NOW)).toBe(false)
  })

  it('leaves a new user alone for the first week, then nudges until a backup exists', () => {
    expect(shouldNudgeBackup(loggedAt(NOW - 3 * DAY), null, NOW)).toBe(false)
    expect(shouldNudgeBackup(loggedAt(NOW - 8 * DAY), null, NOW)).toBe(true)
  })

  it('nudges again once the last backup is older than the setting', () => {
    const data = loggedAt(NOW - 60 * DAY)
    expect(shouldNudgeBackup(data, NOW - 10 * DAY, NOW)).toBe(false)
    expect(shouldNudgeBackup(data, NOW - 22 * DAY, NOW)).toBe(true)
  })
})
