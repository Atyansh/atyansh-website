import { describe, it, expect } from 'vitest';
import { formatPacificDate, formatCalendarDate, formatPacificDateTime } from '../formatDate';

describe('formatPacificDate', () => {
  it('shows an evening Pacific session on its local date, not the next UTC day', () => {
    // 2025-06-25T03:30Z is 8:30 PM PDT on June 24
    expect(formatPacificDate('2025-06-25T03:30:00.000Z')).toBe('Jun 24, 2025');
  });

  it('accepts epoch milliseconds and custom options', () => {
    expect(formatPacificDate(Date.UTC(2026, 7, 10, 2, 0), { month: 'numeric', day: 'numeric', year: 'numeric' })).toBe('8/9/2026');
  });
});

describe('formatCalendarDate', () => {
  it('keeps date-only frontmatter values on their calendar day', () => {
    // z.coerce.date() parses "2026-01-19" as UTC midnight
    expect(formatCalendarDate(new Date('2026-01-19'))).toBe('January 19, 2026');
    expect(formatCalendarDate(new Date('2017-06-01'), { year: 'numeric', month: 'long' })).toBe('June 2017');
  });
});

describe('formatPacificDateTime', () => {
  it('includes the Pacific time zone label', () => {
    expect(formatPacificDateTime('2026-10-31T17:07:00.000Z')).toBe('Oct 31, 10:07 AM PDT');
  });
});
