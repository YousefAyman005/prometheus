import { useState } from 'react'
import { describeRule } from '../../domain/format'
import { STARTERS } from '../../domain/starters'
import { appStore } from '../../store'
import { habitStyle } from '../../ui/colors'
import { CheckIcon } from '../../ui/icons'

/** First run: pick from common habits instead of facing an empty screen and a form. */
export function Starters({ onCustom }: { onCustom: () => void }) {
  const [picked, setPicked] = useState<Set<number>>(new Set())

  function toggle(index: number) {
    const next = new Set(picked)
    if (!next.delete(index)) next.add(index)
    setPicked(next)
  }

  function add() {
    const store = appStore.getState()
    STARTERS.forEach((starter, index) => {
      if (picked.has(index)) store.createHabit(starter)
    })
  }

  return (
    <section className="mx-4">
      <h2 className="px-4 pb-1.5 text-footnote text-label-2">Pick what you want to track. Goals can be changed later.</h2>
      <ul className="overflow-hidden rounded-xl bg-surface">
        {STARTERS.map((starter, index) => {
          const on = picked.has(index)
          return (
            <li key={starter.name} style={habitStyle(starter.color)} className="relative after:absolute after:bottom-0 after:left-17 after:right-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator last:after:hidden">
              <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(index)} className="flex w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left active:bg-fill-2">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-habit/15 text-[1.375rem]">{starter.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{starter.name}</span>
                  <span className="block text-footnote text-label-2">{describeRule(starter, starter)}</span>
                </span>
                <span aria-hidden className={`grid size-6.5 shrink-0 place-items-center rounded-full ${on ? 'bg-tint text-on-tint' : 'border-2 border-label-3 text-transparent'}`}>
                  <CheckIcon size={16} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" disabled={picked.size === 0} onClick={add} className="mt-5 min-h-12.5 w-full rounded-xl bg-tint text-body font-semibold text-on-tint active:opacity-70 disabled:opacity-30">
        {picked.size === 0 ? 'Add habits' : `Add ${picked.size} ${picked.size === 1 ? 'habit' : 'habits'}`}
      </button>
      <button type="button" onClick={onCustom} className="mt-1 min-h-11 w-full text-body text-tint active:opacity-50">
        Make my own
      </button>
    </section>
  )
}
