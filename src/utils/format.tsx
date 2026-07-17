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
 */
export const generateId = (prefix?: string): string => {
  const core = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return prefix ? `${prefix}_${core}` : core
}
