import { type ReactNode, useEffect, useRef } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Read out by screen readers as the sheet's name. */
  label: string
  children: ReactNode
}

/** A bottom sheet built on <dialog>, which gives focus trapping and Escape-to-close for free. */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="sheet"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div aria-hidden className="mx-auto mt-2 h-1.25 w-9 rounded-full bg-label-3" />
          {children}
        </div>
      )}
    </dialog>
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
