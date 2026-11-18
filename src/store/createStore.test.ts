import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, emptyData } from '../domain/migrate'
import { createAppStore } from './createStore'
import { DATA_KEY, PRE_RESTORE_KEY } from './persistence'

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

describe('app store', () => {
  it('writes every applied change to storage', () => {
    const storage = memoryStorage()
    const store = createAppStore(storage)
    store.getState().apply((d) => ({ ...d, settings: { ...d.settings, dayEndHour: 2 } }))
    expect(JSON.parse(storage.getItem(DATA_KEY)!).settings.dayEndHour).toBe(2)
  })

  it('starts from what an earlier session stored', () => {
    const storage = memoryStorage()
    createAppStore(storage).getState().apply((d) => ({ ...d, settings: { ...d.settings, dayEndHour: 6 } }))
    expect(createAppStore(storage).getState().data.settings.dayEndHour).toBe(6)
  })

  it('blocks and writes nothing when stored data is from a newer app version', () => {
    const storage = memoryStorage()
    const newer = JSON.stringify({ ...emptyData(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    storage.setItem(DATA_KEY, newer)
    const store = createAppStore(storage)
    expect(store.getState().blocked?.reason).toBe('newer')
    store.getState().apply((d) => ({ ...d, settings: { ...d.settings, dayEndHour: 1 } }))
    expect(storage.getItem(DATA_KEY)).toBe(newer)
  })

  it('keeps the replaced data as a safety copy when restoring', () => {
    const storage = memoryStorage()
    const store = createAppStore(storage)
    store.getState().apply((d) => ({ ...d, settings: { ...d.settings, dayEndHour: 5 } }))
    const restored = emptyData()
    restored.settings.dayEndHour = 9
    store.getState().restore(restored)
    expect(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).settings.dayEndHour).toBe(5)
    expect(JSON.parse(storage.getItem(DATA_KEY)!).settings.dayEndHour).toBe(9)
  })

  it('remembers device meta separately from the data', () => {
    const storage = memoryStorage()
    createAppStore(storage).getState().setMeta({ lastBackupAt: 42 })
    expect(createAppStore(storage).getState().meta.lastBackupAt).toBe(42)
    expect(storage.getItem(DATA_KEY)).toBeNull()
  })
})
