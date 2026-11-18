import { CURRENT_SCHEMA_VERSION, emptyData, migrate, NewerVersionError } from '../domain/migrate'
import type { AppData, DeviceMeta } from '../domain/types'

// Every GitHub Pages site of one account shares an origin, so all keys carry a prefix.
export const DATA_KEY = 'prometheus:data'
export const DEVICE_KEY = 'prometheus:device'
export const PRE_MIGRATION_KEY = 'prometheus:snapshot:pre-migration'
export const PRE_RESTORE_KEY = 'prometheus:snapshot:pre-restore'

export type LoadResult =
  | { ok: true; data: AppData }
  /** Stored data exists but cannot be used. It is left untouched so it can be rescued. */
  | { ok: false; reason: 'corrupt' | 'newer'; raw: string }

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' }

export function loadData(storage: Storage): LoadResult {
  let raw: string | null
  try {
    raw = storage.getItem(DATA_KEY)
  } catch {
    return { ok: true, data: emptyData() }
  }
  if (raw === null) return { ok: true, data: emptyData() }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'corrupt', raw }
  }

  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion
  if (typeof version === 'number' && version < CURRENT_SCHEMA_VERSION) {
    // Keep the pre-upgrade copy: one deployment serves everyone, so a bad migration must be recoverable.
    try {
      storage.setItem(PRE_MIGRATION_KEY, raw)
    } catch {
      // No room for the snapshot. The original stays in place until the first successful save.
    }
  }

  try {
    return { ok: true, data: migrate(parsed) }
  } catch (error) {
    return { ok: false, reason: error instanceof NewerVersionError ? 'newer' : 'corrupt', raw }
  }
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

export function saveData(storage: Storage, data: AppData): SaveResult {
  try {
    storage.setItem(DATA_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' }
  }
}

/** Copies the current stored data aside so one restore can be undone by hand. */
export function snapshotBeforeRestore(storage: Storage): void {
  try {
    const raw = storage.getItem(DATA_KEY)
    if (raw !== null) storage.setItem(PRE_RESTORE_KEY, raw)
  } catch {
    // Best effort: a failed snapshot must not block the restore the user asked for.
  }
}

const NO_META: DeviceMeta = { lastBackupAt: null, lastRecapWeek: null }

export function loadDeviceMeta(storage: Storage): DeviceMeta {
  try {
    const raw = storage.getItem(DEVICE_KEY)
    if (raw === null) return { ...NO_META }
    const parsed = JSON.parse(raw) as Partial<DeviceMeta>
    return {
      lastBackupAt: typeof parsed.lastBackupAt === 'number' ? parsed.lastBackupAt : null,
      lastRecapWeek: typeof parsed.lastRecapWeek === 'string' ? parsed.lastRecapWeek : null,
    }
  } catch {
    return { ...NO_META }
  }
}

export function saveDeviceMeta(storage: Storage, meta: DeviceMeta): void {
  try {
    storage.setItem(DEVICE_KEY, JSON.stringify(meta))
  } catch {
    // Device meta only drives nudges; losing it is harmless.
  }
}
