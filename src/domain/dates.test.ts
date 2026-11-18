import { describe, expect, it } from 'vitest'
import { addDays, dayKeyOf, daysBetween, isWeekComplete, weekDays, weekOf } from './dates'

// Tests run with TZ=Europe/Berlin (see the npm test script).
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()

describe('dayKeyOf', () => {
  it('uses the calendar day in the afternoon', () => {
    expect(dayKeyOf(at(2026, 11, 18, 14), 4)).toBe('2026-11-18')
  })

  it('counts the small hours as the day before', () => {
    expect(dayKeyOf(at(2026, 11, 19, 2, 30), 4)).toBe('2026-11-18')
  })

  it('starts the new day exactly at the day-end hour', () => {
    expect(dayKeyOf(at(2026, 11, 19, 4, 0), 4)).toBe('2026-11-19')
  })

  it('follows the calendar exactly when the day ends at midnight', () => {
    expect(dayKeyOf(at(2026, 11, 19, 0, 30), 0)).toBe('2026-11-19')
  })

  it('steps back across a year boundary', () => {
    expect(dayKeyOf(at(2027, 1, 1, 1), 4)).toBe('2026-12-31')
  })

  it('is not thrown off by the hour lost when clocks go forward', () => {
    // 28 March 2027: 02:00 jumps to 03:00 in Berlin.
    expect(dayKeyOf(at(2027, 3, 28, 4, 30), 4)).toBe('2027-03-28')
    expect(dayKeyOf(at(2027, 3, 28, 3, 30), 4)).toBe('2027-03-27')
  })

  it('is not thrown off by the hour repeated when clocks go back', () => {
    // 31 October 2027: 03:00 falls back to 02:00 in Berlin.
    expect(dayKeyOf(at(2027, 10, 31, 4, 30), 4)).toBe('2027-10-31')
    expect(dayKeyOf(at(2027, 10, 31, 1, 30), 4)).toBe('2027-10-30')
  })
})

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('counts whole days across a daylight-saving change', () => {
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29')
    expect(addDays('2027-10-30', 2)).toBe('2027-11-01')
  })
})

describe('daysBetween', () => {
  it('counts days from the first to the second, negative when reversed', () => {
    expect(daysBetween('2026-11-16', '2026-11-18')).toBe(2)
    expect(daysBetween('2026-11-18', '2026-11-16')).toBe(-2)
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2)
  })
})

describe('weekOf', () => {
  it('gives the Monday of a midweek day', () => {
    expect(weekOf('2026-11-18')).toBe('2026-11-16')
  })

  it('keeps a Monday and pulls a Sunday back to its Monday', () => {
    expect(weekOf('2026-11-16')).toBe('2026-11-16')
    expect(weekOf('2026-11-22')).toBe('2026-11-16')
  })

  it('reaches back into the previous year', () => {
    expect(weekOf('2027-01-01')).toBe('2026-12-28')
  })
})

describe('weekDays', () => {
  it('lists Monday to Sunday', () => {
    expect(weekDays('2026-11-16')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ])
  })
})

describe('isWeekComplete', () => {
  it('is still open on its Sunday and complete from the next Monday', () => {
    expect(isWeekComplete('2026-11-16', '2026-11-22')).toBe(false)
    expect(isWeekComplete('2026-11-16', '2026-11-23')).toBe(true)
  })
})
