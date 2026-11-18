import type { ReactNode } from 'react'

interface SectionProps {
  title?: string
  footer?: ReactNode
  children: ReactNode
}

/** An iOS inset grouped list section. */
export function Section({ title, footer, children }: SectionProps) {
  return (
    <section className="mx-4 mb-7">
      {title && <h2 className="px-4 pb-1.5 text-footnote text-label-2">{title}</h2>}
      <div className="overflow-hidden rounded-xl bg-surface">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-footnote text-label-2">{footer}</p>}
    </section>
  )
}

const ROW =
  'relative flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-body ' +
  // Hairline separator, inset to the text like a system list. Hidden on the last row.
  'after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:origin-bottom ' +
  'after:scale-y-50 after:bg-separator last:after:hidden'

interface RowProps {
  label: ReactNode
  /** Secondary value shown on the right. */
  detail?: ReactNode
  tone?: 'default' | 'tint' | 'destructive'
  onClick?: () => void
  disabled?: boolean
}

const TONE = { default: 'text-label', tint: 'text-tint', destructive: 'text-bad' }

export function Row({ label, detail, tone = 'default', onClick, disabled }: RowProps) {
  const content = (
    <>
      <span className={`min-w-0 flex-1 ${TONE[tone]}`}>{label}</span>
      {detail !== undefined && <span className="shrink-0 text-label-2">{detail}</span>}
    </>
  )
  if (!onClick) return <div className={ROW}>{content}</div>
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${ROW} active:bg-fill-2 disabled:opacity-40`}>
      {content}
    </button>
  )
}
