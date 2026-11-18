import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, emptyData } from '../domain/migrate'
import {
  DATA_KEY, loadData, loadDeviceMeta, PRE_RESTORE_KEY, saveData, saveDeviceMeta, snapshotBeforeRestore,
} from './persistence'

/** In-memory stand-in for localStorage, optionally with a byte budget. */
function fakeStorage(quotaChars = Infinity): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k) },
    setItem: (k, v) => {
      let used = v.length
      for (const [key, value] of map) if (key !== k) used += value.length
      if (used > quotaChars) throw new DOMException('quota', 'QuotaExceededError')
      map.set(k, v)
    },
  }
}

describe('loadData', () => {
  it('gives fresh data when nothing is stored', () => {
    expect(loadData(fakeStorage())).toEqual({ ok: true, data: emptyData() })
  })

  it('returns what saveData stored', () => {
    const storage = fakeStorage()
    const data = emptyData()
    data.settings.dayEndHour = 2
    expect(saveData(storage, data)).toEqual({ ok: true })
    expect(loadData(storage)).toEqual({ ok: true, data })
  })

  it('reports unreadable stored data instead of replacing it', () => {
    const storage = fakeStorage()
    storage.setItem(DATA_KEY, '{ this is not json')
    const result = loadData(storage)
    expect(result).toMatchObject({ ok: false, reason: 'corrupt' })
    expect(storage.getItem(DATA_KEY)).toBe('{ this is not json')
  })

  it('reports data from a newer app version instead of replacing it', () => {
    const storage = fakeStorage()
    const raw = JSON.stringify({ ...emptyData(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    storage.setItem(DATA_KEY, raw)
    expect(loadData(storage)).toMatchObject({ ok: false, reason: 'newer' })
    expect(storage.getItem(DATA_KEY)).toBe(raw)
  })
})

describe('saveData', () => {
  it('reports a full storage and keeps the previous data', () => {
    const storage = fakeStorage(400)
    const small = emptyData()
    expect(saveData(storage, small)).toEqual({ ok: true })
    const big = emptyData()
    for (let i = 0; i < 50; i++) {
      big.entries[`e${i}`] = { id: `e${i}`, habitId: 'h', day: '2026-11-18', value: i, source: 'manual', updatedAt: 0 }
    }
    expect(saveData(storage, big)).toEqual({ ok: false, reason: 'quota' })
    expect(loadData(storage)).toEqual({ ok: true, data: small })
  })
})

describe('snapshotBeforeRestore', () => {
  it('keeps a copy of the data that a restore is about to replace', () => {
    const storage = fakeStorage()
    const data = emptyData()
    data.settings.dayEndHour = 6
    saveData(storage, data)
    snapshotBeforeRestore(storage)
    expect(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!)).toEqual(data)
  })
})

describe('device meta', () => {
  it('defaults to never backed up', () => {
    expect(loadDeviceMeta(fakeStorage())).toEqual({ lastBackupAt: null, lastRecapWeek: null })
  })

  it('round-trips and survives damaged stored meta', () => {
    const storage = fakeStorage()
    saveDeviceMeta(storage, { lastBackupAt: 123, lastRecapWeek: '2026-11-16' })
    expect(loadDeviceMeta(storage)).toEqual({ lastBackupAt: 123, lastRecapWeek: '2026-11-16' })
    storage.setItem('prometheus:device', 'garbage')
    expect(loadDeviceMeta(storage)).toEqual({ lastBackupAt: null, lastRecapWeek: null })
  })
})
