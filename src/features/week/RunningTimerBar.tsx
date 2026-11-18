import { formatClock } from '../../domain/format'
import { elapsedSec } from '../../domain/timer'
import { appStore, useApp } from '../../store'
import { habitStyle } from '../../ui/colors'
import { useNow } from '../../ui/hooks'

/**
 * The running timer, pinned above the list. A web app cannot put this on the lock screen,
 * so it is the first thing seen whenever the app is opened.
 */
export function RunningTimerBar() {
  const timer = useApp((s) => s.data.runningTimer)
  const habit = useApp((s) => (timer ? s.data.habits[timer.habitId] : undefined))
  const now = useNow(1000)
  if (!timer || !habit) return null

  return (
    <section
      aria-label="Running timer"
      style={habitStyle(habit.color)}
      className="mx-4 mb-4 flex items-center gap-3 rounded-2xl bg-surface py-3.5 pl-4 pr-3.5"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-footnote text-label-2">
          <span aria-hidden className="pulse size-2 rounded-full bg-habit" />
          <span className="truncate">{habit.emoji} {habit.name}</span>
        </p>
        <p role="timer" className="mt-0.5 font-rounded text-[2.5rem] font-semibold leading-none tabular-nums">
          {formatClock(elapsedSec(timer, now))}
        </p>
      </div>
      <button
        type="button"
        onClick={() => appStore.getState().stopTimer()}
        className="min-h-11 rounded-full bg-habit px-5 text-body font-semibold text-on-habit active:opacity-70"
      >
        Stop
      </button>
    </section>
  )
}
