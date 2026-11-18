import { useState } from 'react'

const INPUT =
  'h-11 w-full min-w-0 rounded-[10px] bg-fill-2 px-3 text-body text-label outline-none ' +
  'placeholder:text-label-3 focus:ring-2 focus:ring-tint'

/** Marks the field a sheet should put the cursor in when it opens (see Sheet). */
const focusFirst = (on: boolean | undefined) => (on ? { 'data-autofocus': true } : {})

function parseNumber(text: string): number | null {
  const cleaned = text.replace(',', '.').trim()
  if (cleaned === '') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

interface NumberFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  /** Shown after the field, e.g. "pages". */
  suffix?: string
  decimals?: boolean
  autoFocus?: boolean
}

/**
 * A number typed on the numeric keypad. Empty is null, never zero.
 * The box keeps its own text so that half-typed input like "72." survives; it only
 * re-reads `value` when the parent changes it to something the text does not say.
 */
export function NumberField({ value, onChange, label, suffix, decimals = true, autoFocus }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== parseNumber(text)) setText(value === null ? '' : String(value))
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        className={`${INPUT} font-rounded tabular-nums`}
        inputMode={decimals ? 'decimal' : 'numeric'}
        placeholder="0"
        value={text}
        {...focusFirst(autoFocus)}
        onChange={(event) => {
          const next = event.target.value.replace(decimals ? /[^\d.,]/g : /\D/g, '')
          setText(next)
          onChange(parseNumber(next))
        }}
      />
      {suffix && <span className="shrink-0 text-body text-label-2">{suffix}</span>}
    </label>
  )
}

function toSeconds(hours: string, minutes: string): number | null {
  return hours === '' && minutes === '' ? null : Number(hours || 0) * 3600 + Number(minutes || 0) * 60
}

function toBoxes(seconds: number | null): { hours: string; minutes: string } {
  if (seconds === null) return { hours: '', minutes: '' }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return { hours: h > 0 ? String(h) : '', minutes: m > 0 || h === 0 ? String(m) : '' }
}

interface DurationFieldProps {
  /** Seconds, or null when both boxes are empty. */
  value: number | null
  onChange: (seconds: number | null) => void
  label: string
  autoFocus?: boolean
}

/** Hours and minutes as two keypad boxes: quicker and more exact on a phone than a wheel. */
export function DurationField({ value, onChange, label, autoFocus }: DurationFieldProps) {
  const [boxes, setBoxes] = useState(() => toBoxes(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== toSeconds(boxes.hours, boxes.minutes)) setBoxes(toBoxes(value))
  }

  function update(next: { hours: string; minutes: string }) {
    setBoxes(next)
    onChange(toSeconds(next.hours, next.minutes))
  }

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <input
        aria-label={`${label}, hours`}
        className={`${INPUT} font-rounded tabular-nums`}
        inputMode="numeric"
        placeholder="0"
        value={boxes.hours}
        {...focusFirst(autoFocus)}
        onChange={(event) => update({ ...boxes, hours: event.target.value.replace(/\D/g, '').slice(0, 3) })}
      />
      <span className="text-body text-label-2">h</span>
      <input
        aria-label={`${label}, minutes`}
        className={`${INPUT} font-rounded tabular-nums`}
        inputMode="numeric"
        placeholder="0"
        value={boxes.minutes}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
          update({ ...boxes, minutes: digits !== '' && Number(digits) > 59 ? '59' : digits })
        }}
      />
      <span className="text-body text-label-2">m</span>
    </fieldset>
  )
}

export function TextField(
  { value, onChange, label, placeholder, maxLength, autoFocus }:
  { value: string; onChange: (value: string) => void; label: string; placeholder?: string; maxLength?: number; autoFocus?: boolean },
) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        className={INPUT}
        value={value}
        placeholder={placeholder ?? label}
        maxLength={maxLength}
        autoComplete="off"
        {...focusFirst(autoFocus)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** The iOS segmented control. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-fill-2 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-8 flex-1 rounded-[7px] px-1 text-footnote font-medium ${
            option.value === value ? 'bg-surface text-label shadow-sm' : 'text-label-2'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The bar under a habit: how far along the week is, with a notch where a "between" window starts. */
export function ProgressBar(
  { fraction, windowStart, bad }: { fraction: number; windowStart: number | null; bad: boolean },
) {
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-fill-2">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${bad ? 'bg-bad' : 'bg-habit'}`}
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
      {windowStart !== null && (
        <div aria-hidden className="absolute inset-y-0 w-0.5 bg-label-2" style={{ left: `${windowStart * 100}%` }} />
      )}
    </div>
  )
}
