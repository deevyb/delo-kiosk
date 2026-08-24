import { describe, it, expect } from 'vitest'
import { utcRangeForLocalDay, formatDuration, formatPrepTime } from './dateUtils'

describe('utcRangeForLocalDay', () => {
  it('LA summer day (PDT, UTC-7)', () => {
    expect(utcRangeForLocalDay('2026-08-23', 'America/Los_Angeles')).toEqual({
      startIso: '2026-08-23T07:00:00.000Z',
      endIso: '2026-08-24T07:00:00.000Z',
    })
  })
  it('LA winter day (PST, UTC-8)', () => {
    expect(utcRangeForLocalDay('2026-01-15', 'America/Los_Angeles')).toEqual({
      startIso: '2026-01-15T08:00:00.000Z',
      endIso: '2026-01-16T08:00:00.000Z',
    })
  })
  it('spring-forward day starts in PST and ends in PDT', () => {
    expect(utcRangeForLocalDay('2026-03-08', 'America/Los_Angeles')).toEqual({
      startIso: '2026-03-08T08:00:00.000Z',
      endIso: '2026-03-09T07:00:00.000Z',
    })
  })
  it('UTC is the identity', () => {
    expect(utcRangeForLocalDay('2026-08-23', 'UTC')).toEqual({
      startIso: '2026-08-23T00:00:00.000Z',
      endIso: '2026-08-24T00:00:00.000Z',
    })
  })
})

describe('formatDuration', () => {
  it('matches the formatPrepTime formats', () => {
    expect(formatDuration(0)).toBe('< 1s')
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(180)).toBe('3m')
    expect(formatDuration(150)).toBe('2m 30s')
    expect(formatDuration(-5)).toBe('< 1s') // clamps like formatPrepTime
  })
  it('formatPrepTime still behaves identically after delegating', () => {
    expect(formatPrepTime('2026-08-23T17:00:00Z', '2026-08-23T17:02:30Z')).toBe('2m 30s')
    expect(formatPrepTime('2026-08-23T17:00:00Z', '2026-08-23T16:59:00Z')).toBe('< 1s')
  })
})
