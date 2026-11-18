import { isStandalone } from './device'

export type ExportOutcome =
  /** Handed to the share sheet and the user completed it. */
  | 'shared'
  /** Saved through a browser download (browser tab only). */
  | 'downloaded'
  /** The user closed the share sheet. Not a backup. */
  | 'cancelled'
  /** iOS dropped the tap's permission; tapping again works. */
  | 'retry'
  /** No way to hand over a file here; offer copy-as-text instead. */
  | 'unsupported'

function shareableFile(name: string, text: string): File | null {
  if (!navigator.canShare) return null
  const json = new File([text], name, { type: 'application/json' })
  if (navigator.canShare({ files: [json] })) return json
  const plain = new File([text], name.replace(/\.json$/, '.txt'), { type: 'text/plain' })
  if (navigator.canShare({ files: [plain] })) return plain
  return null
}

/**
 * Gives the user a file to keep. Must be called directly from a tap handler with the
 * text already built, because the share sheet needs the tap's permission.
 *
 * In an installed iOS web app a download link opens a dead-end viewer (WebKit bug
 * 290847), so downloads are only used in a normal browser tab.
 */
export async function exportFile(name: string, text: string): Promise<ExportOutcome> {
  const file = shareableFile(name, text)
  if (file) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      const kind = error instanceof DOMException ? error.name : ''
      if (kind === 'AbortError') return 'cancelled'
      if (kind === 'NotAllowedError') return 'retry'
      // Anything else: fall through to the other methods.
    }
  }
  if (isStandalone()) return 'unsupported'

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
