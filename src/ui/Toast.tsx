import { useEffect } from 'react'
import { appStore, useApp } from '../store'

const VISIBLE_MS = 4500

/**
 * The "Saved, Undo" message. One host sits at the app root and one inside every sheet;
 * only the top-most one is active, so Undo is always tappable.
 */
export function ToastHost({ active }: { active: boolean }) {
  const toast = useApp((s) => s.toast)
  const visible = toast !== null && active

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => appStore.getState().dismissToast(), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [visible, toast?.key])

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 flex justify-center px-4"
    >
      {visible && (
        <div
          key={toast.key}
          className="toast pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-label py-2 pl-4 pr-2 text-subhead text-bg shadow-lg"
        >
          <span className="truncate">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => appStore.getState().undo()}
              className="min-h-8 shrink-0 rounded-full bg-bg/20 px-3 font-semibold active:opacity-60"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
