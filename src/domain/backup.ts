import { CURRENT_SCHEMA_VERSION, migrate } from './migrate'
import type { AppData, BackupFile } from './types'

export class NotABackupError extends Error {
  constructor() {
    super('This file is not a Prometheus backup.')
    this.name = 'NotABackupError'
  }
}

export function buildBackup(data: AppData, now: number, appVersion: string): BackupFile {
  return {
    format: 'prometheus-backup',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    appVersion,
    data,
  }
}

/**
 * Reads backup text into current-version data.
 * Throws NotABackupError, NewerVersionError or InvalidDataError; the caller shows the message.
 */
export function parseBackup(text: string): { data: AppData; exportedAt: string | null } {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    throw new NotABackupError()
  }
  if (typeof file !== 'object' || file === null || (file as BackupFile).format !== 'prometheus-backup') {
    throw new NotABackupError()
  }
  const backup = file as BackupFile
  return {
    data: migrate(backup.data),
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : null,
  }
}

export function backupFileName(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `prometheus-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

const DAY_MS = 86_400_000
/** A new user is not asked to back up until they have a week of data worth keeping. */
const FIRST_NUDGE_DAYS = 7

/** Whether to remind the user that their only copy of the data is on this phone. */
export function shouldNudgeBackup(data: AppData, lastBackupAt: number | null, now: number): boolean {
  const entries = Object.values(data.entries)
  if (entries.length === 0) return false
  if (lastBackupAt !== null) return now - lastBackupAt > data.settings.backupNudgeDays * DAY_MS
  const oldest = Math.min(...entries.map((entry) => entry.updatedAt))
  return now - oldest > FIRST_NUDGE_DAYS * DAY_MS
}
