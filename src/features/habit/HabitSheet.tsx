import { useState } from 'react'
import { addDays, weekDays, weekOf } from '../../domain/dates'
import { weekFigure, weekStatus } from '../../domain/evaluate'
import { describeRule, describeWeek, formatCompact, formatDayLong, formatWeekRange } from '../../domain/format'
import { versionAt } from '../../domain/evaluate'
import type { DayKey, Habit } from '../../domain/types'
import { appStore, useApp } from '../../store'
import { habitStyle } from '../../ui/colors'
import { useToday } from '../../ui/hooks'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { Sheet, SheetHeader, TextButton } from '../../ui/Sheet'
import { DayEditor } from './DayEditor'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Body({ habit, onEdit, onClose }: { habit: Habit; onEdit: () => void; onClose: () => void }) {
  const data = useApp((s) => s.data)
  const today = useToday()
  const thisWeek = weekOf(today)
  const [week, setWeek] = useState(thisWeek)
  const [day, setDay] = useState<DayKey>(today)

  const figure = weekFigure(habit, data, week, today)
  const view = describeWeek(habit, figure, weekStatus(habit, data, week, today))
  const rule = versionAt(habit.rules, week) ?? habit.rules[0]

  function goToWeek(next: DayKey) {
    setWeek(next)
    setDay(next === thisWeek ? today : next)
  }

  return (
    <div style={habitStyle(habit.color)}>
      <SheetHeader
        title={`${habit.emoji} ${habit.name}`}
        left={<TextButton onClick={onEdit}>Edit</TextButton>}
        right={<TextButton strong onClick={onClose}>Done</TextButton>}
      />

      <div className="px-4">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous week" onClick={() => goToWeek(addDays(week, -7))} className="grid size-11 place-items-center text-tint active:opacity-50">
            <ChevronLeftIcon />
          </button>
          <div className="text-center">
            <p className="text-subhead font-semibold">{week === thisWeek ? 'This week' : formatWeekRange(week)}</p>
            <p className="text-footnote text-label-2">{view.text}</p>
          </div>
          <button type="button" aria-label="Next week" disabled={week >= thisWeek} onClick={() => goToWeek(addDays(week, 7))} className="grid size-11 place-items-center text-tint active:opacity-50 disabled:text-label-3">
            <ChevronRightIcon />
          </button>
        </div>

        <div role="radiogroup" aria-label="Day" className="mt-2 grid grid-cols-7 gap-1">
          {weekDays(week).map((d, i) => {
            const value = figure.perDay[i]
            const selected = d === day
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={formatDayLong(d)}
                disabled={d > today}
                onClick={() => setDay(d)}
                className={`flex h-14 flex-col items-center justify-center rounded-[10px] disabled:opacity-30 ${
                  selected ? 'bg-habit text-on-habit' : 'bg-surface text-label'
                }`}
              >
                <span className={`text-caption ${selected ? '' : d === today ? 'font-semibold text-tint' : 'text-label-2'}`}>
                  {WEEKDAYS[i]}
                </span>
                <span className="font-rounded text-footnote font-semibold tabular-nums">
                  {value !== null && value > 0 ? formatCompact(habit, value) : ' '}
                </span>
              </button>
            )
          })}
        </div>

        <h3 className="mb-2 mt-5 text-footnote text-label-2">{day === today ? 'Today' : formatDayLong(day)}</h3>
        {/* Keyed so typed-but-unsaved text never carries over to another day. */}
        <DayEditor key={day} habit={habit} day={day} />

        <p className="mt-6 text-center text-footnote text-label-2">{describeRule(habit, rule)}</p>
        <div className="mt-1 flex justify-center">
          <TextButton
            tone="destructive"
            onClick={() => {
              appStore.getState().archiveHabit(habit.id)
              onClose()
            }}
          >
            Archive habit
          </TextButton>
        </div>
      </div>
    </div>
  )
}

interface HabitSheetProps {
  habitId: string | null
  onClose: () => void
  onEdit: (id: string) => void
}

/** One habit's week: pick a day, then add, change or remove what was logged. */
export function HabitSheet({ habitId, onClose, onEdit }: HabitSheetProps) {
  const habit = useApp((s) => (habitId ? s.data.habits[habitId] : undefined))
  return (
    <Sheet open={habit !== undefined} onClose={onClose} label={habit?.name ?? 'Habit'}>
      {habit && <Body key={habit.id} habit={habit} onEdit={() => onEdit(habit.id)} onClose={onClose} />}
    </Sheet>
  )
}
