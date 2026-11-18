import { createStore } from 'zustand/vanilla'
import { emptyData } from '../domain/migrate'
import type { AppData, DeviceMeta } from '../domain/types'
import {
  loadData, loadDeviceMeta, saveData, saveDeviceMeta, snapshotBeforeRestore,
} from './persistence'

export interface AppState {
  data: AppData
  meta: DeviceMeta
  /** Set when stored data exists but cannot be used. Nothing is written while blocked. */
  blocked: null | { reason: 'corrupt' | 'newer'; raw: string }
  /** Set when the last change could not be written to the phone. */
  saveError: null | 'quota' | 'unavailable'

  /** Applies a pure change to the data and stores the result. */
  apply: (change: (data: AppData) => AppData) => void
  /** Replaces everything with restored data, keeping the old data as a safety copy. */
  restore: (data: AppData) => void
  /** Discards unusable stored data and starts fresh. Only reachable from the blocked screen. */
  startFresh: () => void
  setMeta: (patch: Partial<DeviceMeta>) => void
}

/** Builds the app store on top of a Storage, so tests can use an in-memory one. */
export function createAppStore(storage: Storage) {
  const loaded = loadData(storage)

  const store = createStore<AppState>()((set, get) => ({
    data: loaded.ok ? loaded.data : emptyData(),
    meta: loadDeviceMeta(storage),
    blocked: loaded.ok ? null : { reason: loaded.reason, raw: loaded.raw },
    saveError: null,

    apply: (change) => {
      if (get().blocked) return
      set({ data: change(get().data) })
    },

    restore: (data) => {
      snapshotBeforeRestore(storage)
      set({ data, blocked: null })
    },

    startFresh: () => {
      snapshotBeforeRestore(storage)
      set({ data: emptyData(), blocked: null })
    },

    setMeta: (patch) => {
      const meta = { ...get().meta, ...patch }
      saveDeviceMeta(storage, meta)
      set({ meta })
    },
  }))

  store.subscribe((state, previous) => {
    if (state.data === previous.data || state.blocked) return
    const result = saveData(storage, state.data)
    const saveError = result.ok ? null : result.reason
    if (saveError !== state.saveError) store.setState({ saveError })
  })

  return store
}
