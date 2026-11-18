import { type ChangeEvent, useRef, useState } from 'react'
import { backupFileName, buildBackup, parseBackup } from '../../domain/backup'
import type { AppData } from '../../domain/types'
import { copyText, exportFile } from '../../platform/files'
import { appStore, useApp } from '../../store'
import { Row, Section } from '../../ui/List'
import { ConfirmSheet } from '../../ui/Sheet'

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function describe(data: AppData): string {
  const habits = Object.keys(data.habits).length
  const entries = Object.keys(data.entries).length
  return `${habits} ${habits === 1 ? 'habit' : 'habits'} and ${entries} logged ${entries === 1 ? 'entry' : 'entries'}`
}

export function BackupRestore() {
  const lastBackupAt = useApp((s) => s.meta.lastBackupAt)
  const [message, setMessage] = useState<string | null>(null)
  const [offerCopy, setOfferCopy] = useState(false)
  const [pending, setPending] = useState<{ data: AppData; exportedAt: string | null } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function backupText(): string {
    return JSON.stringify(buildBackup(appStore.getState().data, Date.now(), __APP_VERSION__))
  }

  function markBackedUp() {
    appStore.getState().setMeta({ lastBackupAt: Date.now() })
  }

  // The text is built before any await: the share sheet only opens while the tap is "fresh".
  async function backUp() {
    const text = backupText()
    const outcome = await exportFile(backupFileName(Date.now()), text)
    setOfferCopy(outcome === 'unsupported')
    switch (outcome) {
      case 'shared':
        markBackedUp()
        setMessage('Backed up. Keep the file somewhere safe, such as iCloud Drive.')
        break
      case 'downloaded':
        markBackedUp()
        setMessage('Backed up. The file is in your downloads.')
        break
      case 'cancelled':
        setMessage('Backup cancelled. Nothing was saved.')
        break
      case 'retry':
        setMessage('The share sheet did not open. Tap Back up now again.')
        break
      case 'unsupported':
        setMessage('This phone cannot share the backup as a file. Copy it as text and paste it into Notes instead.')
        break
    }
  }

  async function copyBackup() {
    const copied = await copyText(backupText())
    if (copied) markBackedUp()
    setMessage(copied ? 'Backup copied. Paste it into a note to keep it.' : 'Copying failed. Try again.')
  }

  async function fileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets the same file be chosen again
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be read.')
    }
  }

  function restore() {
    if (!pending) return
    appStore.getState().restore(pending.data)
    setPending(null)
    setMessage(`Restored ${describe(pending.data)}.`)
  }

  const pendingDate = pending?.exportedAt ? DATE.format(new Date(pending.exportedAt)) : 'an unknown date'

  return (
    <>
      <Section
        title="Backup"
        footer="Your habits are stored only on this phone. A backup file is the only way to get them back after losing the phone or removing the app."
      >
        <Row
          label="Back up now"
          tone="tint"
          detail={lastBackupAt ? DATE.format(new Date(lastBackupAt)) : 'Never'}
          onClick={backUp}
        />
        {offerCopy && <Row label="Copy backup as text" tone="tint" onClick={copyBackup} />}
        <Row label="Restore from a backup" tone="tint" onClick={() => fileInput.current?.click()} />
      </Section>

      {/* No accept filter: iOS greys out .json files for some type lists, so the content is validated instead. */}
      <input ref={fileInput} type="file" hidden onChange={fileChosen} />

      <p role="status" className="mx-8 -mt-4 mb-7 text-footnote text-label empty:m-0">
        {message}
      </p>

      <ConfirmSheet
        open={pending !== null}
        title="Replace everything on this phone?"
        message={
          pending
            ? `The backup from ${pendingDate} holds ${describe(pending.data)}. It replaces what is on this phone now.`
            : ''
        }
        confirmLabel="Replace with backup"
        destructive
        onConfirm={restore}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
