// services/off/storage.ts
//
// Tiny shared helpers for the "off" (serverless) service implementations.
// Everything lives in SQLite as plain JSON blobs, keyed by string.
// This is intentionally dumb (no schema, no migrations) — it just needs to
// be a drop-in stand-in for what the server used to persist for us.

import {
  loadFromStorage,
  removeFromStorage,
  saveToStorage,
} from "./storage"
import {
  getRecord,
  listRecords,
  listRecordsSince,
  putRecord,
  putRecords,
  deleteRecord,
  deleteRecords,
  clearCollection,
} from "./sqliteStorage"
import { toDateString } from "@utils/format"

// These thin wrappers delegate to the shared SQLite storage primitives in
// `storage.tsx` so there's a single error-handling/logging path. They use raw
// keys (no per-user namespacing) by passing `userId = null`, matching the
// offline service's flat key space.

/** Read a JSON value, returning `fallback` if it's missing or unparsable. */
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const value = await loadFromStorage<T>(key)
  return value == null ? fallback : value
}

/** Write a JSON value. Throws if the underlying write fails. */
export async function writeJSON<T>(key: string, value: T): Promise<void> {
  const ok = await saveToStorage(key, value)
  if (!ok) {
    throw new Error(`[offline storage] Failed to write "${key}"`)
  }
}

/** Remove a key entirely. */
export async function removeKey(key: string): Promise<void> {
  await removeFromStorage(key)
}

/**
 * Row-per-record collection store, backed by the `kv_records` SQLite table
 * (see sqliteStorage.tsx). Replaces the old "whole collection is one JSON
 * blob under one kv_store key" pattern — saving/updating a single record no
 * longer requires reading, re-serializing, and rewriting every other record
 * in the collection.
 *
 * On first use it lazily migrates any data already saved under the old
 * blob key (`legacyBlobKey`) into rows, then deletes the blob — existing
 * users don't lose local history when this ships.
 */
export interface RecordStore<T> {
  getAll(): Promise<T[]>
  /** Most recent `limit` records (by sortKey, descending). */
  getRecent(limit: number): Promise<T[]>
  /** Records with sortKey >= sinceSortKey, most recent first. */
  getSince(sinceSortKey: string): Promise<T[]>
  getOne(id: string | number): Promise<T | null>
  put(record: T): Promise<void>
  putMany(records: T[]): Promise<void>
  remove(id: string | number): Promise<void>
  removeMany(ids: (string | number)[]): Promise<void>
  /** Clears the collection and writes exactly these records. */
  replaceAll(records: T[]): Promise<void>
  clear(): Promise<void>
}

export function createRecordStore<T>(
  collection: string,
  legacyBlobKey: string,
  idOf: (record: T) => string | number,
  sortKeyOf: (record: T) => string,
): RecordStore<T> {
  const toWrite = (record: T) => ({
    id: String(idOf(record)),
    sortKey: sortKeyOf(record),
    value: JSON.stringify(record),
  })

  let migration: Promise<void> | null = null
  const ensureMigrated = (): Promise<void> => {
    if (!migration) {
      migration = (async () => {
        const legacy = await loadFromStorage<T[]>(legacyBlobKey)
        if (legacy && legacy.length > 0) {
          await putRecords(collection, legacy.map(toWrite))
        }
        await removeFromStorage(legacyBlobKey)
      })()
    }
    return migration
  }

  // Multiple screens read the full collection around the same time on boot
  // (e.g. the home widget and the server-sync pass both list all sessions) —
  // share one in-flight scan instead of hitting SQLite twice for the same data.
  let inFlightGetAll: Promise<T[]> | null = null

  return {
    async getAll() {
      await ensureMigrated()
      if (!inFlightGetAll) {
        inFlightGetAll = listRecords(collection)
          .then((rows) => rows.map((v) => JSON.parse(v) as T))
          .finally(() => {
            inFlightGetAll = null
          })
      }
      return inFlightGetAll
    },
    async getRecent(limit) {
      await ensureMigrated()
      const rows = await listRecords(collection, limit)
      return rows.map((v) => JSON.parse(v) as T)
    },
    async getSince(sinceSortKey) {
      await ensureMigrated()
      const rows = await listRecordsSince(collection, sinceSortKey)
      return rows.map((v) => JSON.parse(v) as T)
    },
    async getOne(id) {
      await ensureMigrated()
      const row = await getRecord(collection, String(id))
      return row ? (JSON.parse(row) as T) : null
    },
    async put(record) {
      await ensureMigrated()
      const w = toWrite(record)
      await putRecord(collection, w.id, w.sortKey, w.value)
    },
    async putMany(records) {
      await ensureMigrated()
      if (records.length === 0) return
      await putRecords(collection, records.map(toWrite))
    },
    async remove(id) {
      await ensureMigrated()
      await deleteRecord(collection, String(id))
    },
    async removeMany(ids) {
      await ensureMigrated()
      if (ids.length === 0) return
      await deleteRecords(collection, ids.map(String))
    },
    async replaceAll(records) {
      await ensureMigrated()
      await clearCollection(collection)
      if (records.length > 0) await putRecords(collection, records.map(toWrite))
    },
    async clear() {
      await ensureMigrated()
      await clearCollection(collection)
    },
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

/**
 * YYYY-MM-DD in local time, used for day-granularity streak math.
 * Re-exported from shared format utilities — single source of truth.
 */
export { toDateString as dayKey } from "@utils/format"

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

  const days = new Set(timestamps.map((t) => toDateString(t)))
  const today = new Date()

  let cursor = new Date(today)
  if (!days.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(toDateString(cursor))) return 0
  }

  let streak = 0
  while (days.has(toDateString(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}


