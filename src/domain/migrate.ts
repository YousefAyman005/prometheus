import type { AppData, Settings } from './types'

export const CURRENT_SCHEMA_VERSION = 1

export class NewerVersionError extends Error {
  constructor() {
    super('This data was written by a newer version of Prometheus. Update the app, then try again.')
    this.name = 'NewerVersionError'
  }
}

export class InvalidDataError extends Error {
  constructor() {
    super('This is not valid Prometheus data.')
    this.name = 'InvalidDataError'
  }
}

export function defaultSettings(): Settings {
  return { dayEndHour: 4, backupNudgeDays: 21 }
}

export function emptyData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    habits: {},
    groups: {},
    entries: {},
    runningTimer: null,
    pauses: {},
    celebrated: {},
    settings: defaultSettings(),
  }
}

type Raw = Record<string, unknown>

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Upgrades from version N to N + 1, keyed by N. Add an entry here whenever the stored
 * shape changes, and bump CURRENT_SCHEMA_VERSION. Never edit a released migration.
 */
const MIGRATIONS: Record<number, (data: Raw) => Raw> = {}

/**
 * The single path by which stored state and backup files become AppData.
 * Throws NewerVersionError or InvalidDataError; never returns partial data.
 */
export function migrate(raw: unknown): AppData {
  if (!isRecord(raw)) throw new InvalidDataError()
  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new InvalidDataError()
  if (version > CURRENT_SCHEMA_VERSION) throw new NewerVersionError()

  let data = raw
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) throw new InvalidDataError()
    data = { ...step(data), schemaVersion: v + 1 }
  }

  const collections = ['habits', 'groups', 'entries', 'pauses', 'celebrated'] as const
  for (const key of collections) if (!isRecord(data[key])) throw new InvalidDataError()
  if (data.runningTimer !== null && !isRecord(data.runningTimer)) throw new InvalidDataError()

  const settings = isRecord(data.settings) ? data.settings : {}
  return { ...(data as unknown as AppData), settings: { ...defaultSettings(), ...settings } }
}
