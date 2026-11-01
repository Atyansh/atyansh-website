// Build-time date formatting. Pages are rendered once, on a UTC build
// machine, so dates must be formatted with an explicit time zone and passed
// to components as strings (formatting in a hydrated component would also
// re-run in the visitor's time zone and cause hydration mismatches).

import { siteConfig } from '../site.config';

/** The site owner's time zone (siteConfig.timeZone): activity timestamps are shown as the local date they happened on. */
export const SITE_TIME_ZONE = siteConfig.timeZone;

type DateInput = Date | string | number;

/**
 * Format a moment in time (a timestamp such as a climbing session or a
 * "last played" time) as its calendar date in the site's time zone, so an
 * evening session doesn't show up as the next day.
 */
export function formatSiteDate(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  timeZone: string = SITE_TIME_ZONE,
): string {
  return new Date(date).toLocaleDateString('en-US', { ...options, timeZone });
}

/**
 * Format a date-only value (frontmatter like `pubDate: 2026-01-19`, which
 * parses to UTC midnight) without shifting it to the previous day.
 */
export function formatCalendarDate(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  return new Date(date).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/** Date and time in the site's time zone, e.g. "Oct 31, 10:07 AM PDT". */
export function formatSiteDateTime(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' },
  timeZone: string = SITE_TIME_ZONE,
): string {
  return new Date(date).toLocaleString('en-US', { ...options, timeZone });
}

/** Like the formatters above, but tolerant of missing/invalid input (returns undefined). */
export function maybeDate(date: DateInput | null | undefined): Date | undefined {
  if (date === null || date === undefined || date === '') return undefined;
  const d = new Date(date);
  return isNaN(d.getTime()) ? undefined : d;
}
