import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
}

function svg(children: ReactNode, filled = false) {
  return function Icon({ size = 20, className }: IconProps) {
    return (
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    )
  }
}

export const PlayIcon = svg(<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" />, true)
export const StopIcon = svg(<rect x="6" y="6" width="12" height="12" rx="2.5" />, true)
export const PlusIcon = svg(<path d="M12 5v14M5 12h14" />)
export const MinusIcon = svg(<path d="M5 12h14" />)
export const CheckIcon = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />)
export const ChevronLeftIcon = svg(<path d="M15 5l-7 7 7 7" />)
export const ChevronRightIcon = svg(<path d="M9 5l7 7-7 7" />)
export const TrashIcon = svg(
  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
)
export const SettingsIcon = svg(
  <>
    <path d="M4 7h8M18 7h2M4 12h2M12 12h8M4 17h10M20 17h0" />
    <circle cx="15" cy="7" r="2.4" />
    <circle cx="9" cy="12" r="2.4" />
    <circle cx="17" cy="17" r="2.4" />
  </>,
)
