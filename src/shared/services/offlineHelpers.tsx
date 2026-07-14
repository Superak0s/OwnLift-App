// services/off/storage.ts
//
// Tiny shared helpers for the "off" (serverless) service implementations.
// Everything lives in AsyncStorage as plain JSON blobs, keyed by string.
// This is intentionally dumb (no schema, no migrations) — it just needs to
// be a drop-in stand-in for what the server used to persist for us.

import AsyncStorage from "@react-native-async-storage/async-storage"

/** Read a JSON value, returning `fallback` if it's missing or unparsable. */
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch (error) {
    console.error(`[offline storage] Failed to read "${key}":`, error)
    return fallback
  }
}

/** Write a JSON value. */
export async function writeJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[offline storage] Failed to write "${key}":`, error)
    throw error
  }
}

/** Remove a key entirely. */
export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch (error) {
    console.error(`[offline storage] Failed to remove "${key}":`, error)
  }
}

/**
 * Auto-incrementing numeric id, persisted under `counterKey`.
 * Not safe for concurrent writers, but the app only ever has one — itself.
 */
export async function nextId(counterKey: string): Promise<number> {
  const current = await readJSON<number>(counterKey, 0)
  const next = current + 1
  await writeJSON(counterKey, next)
  return next
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** YYYY-MM-DD in local time, used for day-granularity streak math. */
export function dayKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Haversine distance in meters between two lat/lng points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Given a list of ISO timestamps, computes a "consecutive days" streak.
 * The streak counts backward from today; if nothing was logged today, it
 * counts backward from yesterday instead (so the streak doesn't zero out
 * the instant the clock rolls over, only once a full day is missed).
 */
export function computeDailyStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0

  const days = new Set(timestamps.map((t) => dayKey(t)))
  const today = new Date()

  let cursor = new Date(today)
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dayKey(cursor))) return 0
  }

  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Generic "not supported offline" error for server-only features. */
export function offlineUnsupported(feature: string): never {
  throw new Error(
    `${feature} isn't available in offline mode. Switch to server mode in Settings to use this feature.`,
  )
}
