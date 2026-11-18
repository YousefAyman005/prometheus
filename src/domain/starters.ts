import type { HabitDraft } from './habits'

const HOUR = 3600

/**
 * Suggestions offered on first run. Between them they show every way of logging
 * and every kind of goal, so they double as examples.
 */
export const STARTERS: HabitDraft[] = [
  {
    name: 'Gym', emoji: '🏋️', color: 'orange', measure: 'duration', input: 'timer',
    basis: 'days', target: { op: 'atLeast', min: 3 },
  },
  {
    name: 'Study', emoji: '📚', color: 'blue', measure: 'duration', input: 'timer',
    basis: 'total', target: { op: 'atLeast', min: 10 * HOUR },
  },
  {
    name: 'Sleep', emoji: '😴', color: 'indigo', measure: 'duration', input: 'daily',
    basis: 'dailyAverage', target: { op: 'between', min: 7 * HOUR, max: 9 * HOUR },
  },
  {
    name: 'Water', emoji: '💧', color: 'teal', measure: 'number', input: 'counter', unit: 'glasses', step: 1,
    basis: 'dailyAverage', target: { op: 'atLeast', min: 8 },
  },
  {
    name: 'Reading', emoji: '📖', color: 'green', measure: 'number', input: 'counter', unit: 'pages', step: 5,
    basis: 'total', target: { op: 'atLeast', min: 50 },
  },
  {
    name: 'Screen time', emoji: '📱', color: 'red', measure: 'duration', input: 'daily',
    basis: 'dailyAverage', target: { op: 'atMost', max: 3 * HOUR },
  },
]
