import { entriesOn, weekFigure, weekStatus } from '../../domain/evaluate'
import { describeWeek } from '../../domain/format'
import type { AppData, DayKey, Habit, WeekKey } from '../../domain/types'
import { appStore } from '../../store'
import { habitStyle } from '../../ui/colors'
import { ProgressBar } from '../../ui/fields'
import { CheckIcon, PlayIcon, PlusIcon, StopIcon } from '../../ui/icons'

const TONE = { neutral: 'text-label-2', good: 'text-ok', bad: 'text-bad', muted: 'text-label-3' }

const ROUND = 'grid size-11 shrink-0 place-items-center rounded-full active:scale-90 transition-transform'
const IDLE = `${ROUND} bg-fill-2 text-habit`
const ACTIVE = `${ROUND} bg-habit text-on-habit`

/** The one-tap action for today, which differs by how the habit is logged. */
function LogButton({ habit, loggedToday, running, onType }: {
  habit: Habit
  loggedToday: boolean
  running: boolean
  onType: () => void
}) {
  const actions = appStore.getState()
  switch (habit.input) {
    case 'tap':
      return (
        <button
          type="button"
          aria-pressed={loggedToday}
          aria-label={`${habit.name} done today`}
          onClick={() => actions.toggleCheck(habit.id)}
          className={loggedToday ? ACTIVE : `${ROUND} border-2 border-habit text-transparent`}
        >
          <CheckIcon />
        </button>
      )
    case 'timer':
      return (
        <button
          type="button"
          aria-label={running ? `Stop ${habit.name} timer` : `Start ${habit.name} timer`}
          onClick={() => (running ? actions.stopTimer() : actions.startTimer(habit.id))}
          className={running ? ACTIVE : IDLE}
        >
          {running ? <StopIcon /> : <PlayIcon />}
        </button>
      )
    case 'counter': {
      const step = habit.step ?? 1
      return (
        <button
          type="button"
          aria-label={`Add ${step} to ${habit.name}`}
          onClick={() => actions.bump(habit.id, step)}
          className={`${IDLE} font-rounded text-subhead font-semibold`}
        >
          +{step}
        </button>
      )
    }
    case 'daily':
      return (
        <button
          type="button"
          aria-label={loggedToday ? `Change today's ${habit.name}` : `Log today's ${habit.name}`}
          onClick={onType}
          className={loggedToday ? ACTIVE : IDLE}
        >
          {loggedToday ? <CheckIcon /> : <PlusIcon />}
        </button>
      )
  }
}

interface HabitRowProps {
  habit: Habit
  data: AppData
  week: WeekKey
  today: DayKey
  onOpen: () => void
}

export function HabitRow({ habit, data, week, today, onOpen }: HabitRowProps) {
  const view = describeWeek(habit, weekFigure(habit, data, week, today), weekStatus(habit, data, week, today))
  const loggedToday = entriesOn(data, habit.id, today).length > 0
  const running = data.runningTimer?.habitId === habit.id

  return (
    <li
      style={habitStyle(habit.color)}
      className="relative flex items-center gap-2 py-2.5 pl-4 pr-3 after:absolute after:bottom-0 after:left-17 after:right-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-60">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-habit/15 text-[1.375rem]">
          {habit.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-body font-medium">{habit.name}</span>
            {view.extra && (
              <span className="shrink-0 font-rounded text-footnote tabular-nums text-label-2">{view.extra}</span>
            )}
          </span>
          <span className={`block truncate text-footnote ${TONE[view.tone]}`}>{view.text}</span>
          {view.fraction !== null && (
            <span className="mt-1.5 block">
              <ProgressBar fraction={view.fraction} windowStart={view.windowStart} bad={view.tone === 'bad'} />
            </span>
          )}
        </span>
      </button>
      <LogButton habit={habit} loggedToday={loggedToday} running={running} onType={onOpen} />
    </li>
  )
}
