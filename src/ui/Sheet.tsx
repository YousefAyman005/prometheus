import { type ReactNode, useEffect, useRef } from 'react'
import { useIsTopSheet } from './hooks'
import { ToastHost } from './Toast'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Read out by screen readers as the sheet's name. */
  label: string
  /** false for a question that must be answered: no backdrop tap or Escape to close. */
  dismissable?: boolean
  children: ReactNode
}

/** A bottom sheet built on <dialog>, which gives focus trapping and Escape-to-close for free. */
export function Sheet({ open, onClose, label, dismissable = true, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const isTop = useIsTopSheet(open)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first control, which is usually a header button. A sheet that
      // exists to take typed input should start with the cursor in its field instead.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="sheet"
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault()
      }}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (dismissable && event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div aria-hidden className="mx-auto mt-2 h-1.25 w-9 rounded-full bg-label-3" />
          {children}
          <ToastHost active={isTop} />
        </div>
      )}
    </dialog>
  )
}

/** The title row of a sheet: an optional action on each side, iOS navigation-bar style. */
export function SheetHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-3">
      <div className="justify-self-start">{left}</div>
      <h2 className="truncate text-body font-semibold">{title}</h2>
      <div className="justify-self-end">{right}</div>
    </div>
  )
}

export function TextButton(
  { children, onClick, strong, disabled, tone = 'tint' }:
  { children: ReactNode; onClick: () => void; strong?: boolean; disabled?: boolean; tone?: 'tint' | 'destructive' },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-1 text-body active:opacity-50 disabled:opacity-30 ${strong ? 'font-semibold' : ''} ${
        tone === 'tint' ? 'text-tint' : 'text-bad'
      }`}
    >
      {children}
    </button>
  )
}

interface ConfirmSheetProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** The iOS action-sheet pattern for a decision that cannot be undone. */
export function ConfirmSheet({
  open, title, message, confirmLabel, destructive = false, onConfirm, onCancel,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} label={title}>
      <div className="px-4 pt-4">
        <h2 className="text-center text-body font-semibold">{title}</h2>
        <p className="mt-1 text-center text-subhead text-label-2">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-5 min-h-12.5 w-full rounded-xl text-body font-semibold active:opacity-70 ${
            destructive ? 'bg-bad text-white' : 'bg-tint text-on-tint'
          }`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 min-h-12.5 w-full rounded-xl bg-fill text-body font-semibold text-label active:opacity-70"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
