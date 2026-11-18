import type { CSSProperties } from 'react'

export const HABIT_COLORS = [
  'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'blue', 'indigo', 'purple', 'pink',
] as const

// White glyphs disappear on these; they get black ones.
const LIGHT_COLORS = new Set(['yellow', 'mint'])

/** Sets --habit and --on-habit for everything inside, so `bg-habit` and `text-on-habit` just work. */
export function habitStyle(color: string): CSSProperties {
  return {
    '--habit': `var(--c-${color}, var(--tint))`,
    '--on-habit': LIGHT_COLORS.has(color) ? '#000' : '#fff',
  } as CSSProperties
}
