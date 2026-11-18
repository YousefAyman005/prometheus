import { useState } from 'react'
import { formatCompact, formatDayLong, formatDuration, formatTimeOfDay } from '../../domain/format'
import { elapsedSec, isOverlong } from '../../domain/timer'
import { appStore, useApp } from '../../store'
import { habitStyle } from '../../ui/colors'
import { DurationField } from '../../ui/fields'
import { useNow, useToday } from '../../ui/hooks'
import { Sheet } from '../../ui/Sheet'

const LENGTHS = [30 * 60, 45 * 60, 3600, 90 * 60, 2 * 3600]

/**
 * Appears when a timer has run longer than is plausible. It has to be answered, because
 * saving the session as it stands would put a bogus figure into the week.
 */
export function OverlongTimerPrompt() {
  const data = useApp((s) => s.data)
  const now = useNow(15_000)
  const today = useToday()
  const [length, setLength] = useState<number | null>(null)

  const timer = data.runningTimer
  const habit = timer ? data.habits[timer.habitId] : undefined
  const open = timer !== null && habit !== undefined && isOverlong(data, now)
  const actions = appStore.getState()

  return (
    <Sheet open={open} onClose={() => {}} dismissable={false} label="Timer left running">
      {timer && habit && (
        <div style={habitStyle(habit.color)} className="px-4 pt-4">
          <h2 className="text-center text-title font-bold">Still doing {habit.name}?</h2>
          <p className="mt-1 text-center text-subhead text-label-2">
            The timer has been running for {formatDuration(elapsedSec(timer, now))}, since{' '}
            {formatTimeOfDay(timer.startedAt)}
            {timer.startDay === today ? '' : ` on ${formatDayLong(timer.startDay)}`}.
          </p>

          <h3 className="mb-1.5 mt-5 px-1 text-footnote text-label-2">It actually lasted</h3>
          <div className="flex gap-2">
            {LENGTHS.map((seconds) => (
              <button key={seconds} type="button" onClick={() => actions.stopTimerAfter(seconds)} className="min-h-11 flex-1 whitespace-nowrap rounded-[10px] bg-surface font-rounded text-body active:opacity-70">
                {formatCompact(habit, seconds)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">
              <DurationField label="Another length" value={length} onChange={setLength} />
            </div>
            <button
              type="button"
              disabled={!length}
              onClick={() => { if (length) actions.stopTimerAfter(length); setLength(null) }}
              className="min-h-11 rounded-[10px] bg-habit px-4 text-body font-semibold text-on-habit active:opacity-70 disabled:opacity-30"
            >
              Save
            </button>
          </div>

          <button type="button" onClick={() => actions.keepTimerRunning()} className="mt-5 min-h-12.5 w-full rounded-xl bg-fill text-body font-semibold text-label active:opacity-70">
            Still going
          </button>
          <button type="button" onClick={() => actions.discardTimer()} className="mt-1 min-h-11 w-full text-body text-bad active:opacity-50">
            Discard this session
          </button>
        </div>
      )}
    </Sheet>
  )
}
