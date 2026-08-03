// Shared formatting / id helpers.
// Single source of truth for date formatting and local id generation so the
// per-screen copies don't drift apart.

/**
 * Format a date as a localized date string.
 *
 * Accepts a Date, an ISO string, or an epoch number. Pass Intl options to
 * control the output (defaults to e.g. "Jul 15, 2026").
 */
export const formatDate = (
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
  locale = "en-US",
): string => new Date(input).toLocaleDateString(locale, options)

/**
 * Format a date + time as a localized string (e.g. "Jul 15, 2026, 3:45 PM").
 */
export const formatDateTime = (
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  locale = "en-US",
): string => new Date(input).toLocaleString(locale, options)

/**
 * Format the time-of-day portion of a date (e.g. "3:45 PM").
 */
export const formatClockTime = (
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  },
  locale = "en-US",
): string => new Date(input).toLocaleTimeString(locale, options)

/**
 * Generate a short, locally-unique id. Not cryptographically strong — for
 * client-side entities (macros/body entries, custom themes) that are later
 * reconciled with the server.
 *
 * @param prefix Optional prefix, e.g. generateId("custom") -> "custom_...".
 *               Defaults to "local_" for consistency across the codebase.
 */
export const generateId = (prefix?: string): string => {
  const resolvedPrefix = prefix ?? "local"
  const core = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `${resolvedPrefix}_${core}`
}

/**
 * Convert a Date or ISO string to a YYYY-MM-DD string in **local time**.
 * Uses local date components (getFullYear, getMonth, getDate) so it
 * matches the user's calendar day — critical for streak calculations
 * and day-granularity comparisons.
 * Previously duplicated as `dayKey` in offlineHelpers.
 */
export const toDateString = (input: Date | string): string => {
  const date = typeof input === "string" ? new Date(input) : input
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Normalize a date argument that may be a Date instance or a YYYY-MM-DD string
 * to a proper ISO timestamp (YYYY-MM-DDT00:00:00.000Z or the original if it
 * already looks like a full timestamp).
 */
export const normalizeToDate = (date: Date | string | null): string => {
  if (!date) return new Date().toISOString()
  if (date instanceof Date) return date.toISOString()
  // Already a string — if it's a date-only string, midday it; otherwise pass through
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date
}
