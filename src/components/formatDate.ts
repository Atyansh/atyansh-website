// Build-time date formatting. Pages are rendered once, on a UTC build
// machine, so dates must be formatted with an explicit time zone and passed
// to components as strings (formatting in a hydrated component would also
// re-run in the visitor's time zone and cause hydration mismatches).

/** The site owner's time zone: activity timestamps are shown as the local date they happened on. */
export const SITE_TIME_ZONE = 'America/Los_Angeles';

type DateInput = Date | string | number;

/**
 * Format a moment in time (a timestamp such as a climbing session or a
 * "last played" time) as its calendar date in Pacific time, so an evening
 * session doesn't show up as the next day.
 */
export function formatPacificDate(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  return new Date(date).toLocaleDateString('en-US', { ...options, timeZone: SITE_TIME_ZONE });
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

/** Date and time in Pacific time, e.g. "Oct 31, 10:07 AM PDT". */
export function formatPacificDateTime(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' },
): string {
  return new Date(date).toLocaleString('en-US', { ...options, timeZone: SITE_TIME_ZONE });
}
