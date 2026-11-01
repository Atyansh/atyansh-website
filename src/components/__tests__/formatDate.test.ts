import { describe, it, expect } from 'vitest';
import { formatSiteDate, formatCalendarDate, formatSiteDateTime, SITE_TIME_ZONE } from '../formatDate';
import { siteConfig } from '../../site.config';

// Explicit zone, so the tests don't depend on what a fork sets in site.config.ts
const LA = 'America/Los_Angeles';

describe('formatSiteDate', () => {
  it('shows an evening Pacific session on its local date, not the next UTC day', () => {
    // 2025-06-25T03:30Z is 8:30 PM PDT on June 24
    expect(formatSiteDate('2025-06-25T03:30:00.000Z', undefined, LA)).toBe('Jun 24, 2025');
  });

  it('accepts epoch milliseconds and custom options', () => {
    expect(formatSiteDate(Date.UTC(2026, 7, 10, 2, 0), { month: 'numeric', day: 'numeric', year: 'numeric' }, LA)).toBe('8/9/2026');
  });

  it('formats in the configured time zone by default', () => {
    expect(SITE_TIME_ZONE).toBe(siteConfig.timeZone);
    expect(formatSiteDate('2025-06-25T03:30:00.000Z')).toBe(formatSiteDate('2025-06-25T03:30:00.000Z', undefined, siteConfig.timeZone));
    expect(formatSiteDate('2025-06-25T12:00:00.000Z', undefined, 'Asia/Tokyo')).toBe('Jun 25, 2025');
  });
});

describe('formatCalendarDate', () => {
  it('keeps date-only frontmatter values on their calendar day', () => {
    // z.coerce.date() parses "2026-01-19" as UTC midnight
    expect(formatCalendarDate(new Date('2026-01-19'))).toBe('January 19, 2026');
    expect(formatCalendarDate(new Date('2017-06-01'), { year: 'numeric', month: 'long' })).toBe('June 2017');
  });
});

describe('formatSiteDateTime', () => {
  it('includes the time zone label', () => {
    expect(formatSiteDateTime('2026-10-31T17:07:00.000Z', undefined, LA)).toBe('Oct 31, 10:07 AM PDT');
  });
});
