import { useMemo } from "react"
import { formatDate, formatDateTime, formatClockTime, toDateString, normalizeToDate } from "@utils/format"

/**
 * Shared date formatting helpers as a React hook.
 *
 * Returns memoized formatters so they're stable across re-renders and
 * can be used directly in screen components without re-creating closures.
 *
 * @example
 *   const { date, dateTime, time, iso, dayKey } = useDateFormatter()
 *   date(session.start_time)      // "Jul 15, 2026"
 *   dateTime(session.start_time)  // "Jul 15, 2026, 3:45 PM"
 *   time(session.start_time)      // "3:45 PM"
 *   iso("2026-07-15")             // "2026-07-15T12:00:00"
 *   dayKey(session.start_time)    // "2026-07-15"
 */
export function useDateFormatter(locale = "en-US") {
  return useMemo(
    () => ({
      /** "Jul 15, 2026" */
      date: (input: Date | string | number) => formatDate(input, undefined, locale),
      /** "Jul 15, 2026, 3:45 PM" */
      dateTime: (input: Date | string | number) => formatDateTime(input, undefined, locale),
      /** "3:45 PM" */
      time: (input: Date | string | number) => formatClockTime(input, undefined, locale),
      /** "2026-07-15T12:00:00" (normalizes date-only strings) */
      iso: (input: Date | string | null) => normalizeToDate(input),
      /** "2026-07-15" (local time) */
      dayKey: (input: Date | string) => toDateString(input),
    }),
    [locale],
  )
}
