import * as SQLite from "expo-sqlite"

/**
 * SQLite-backed key/value storage. Replaces
 * @react-native-async-storage/async-storage app-wide — every call site uses
 * these functions directly instead of an AsyncStorage-shaped object.
 */

const db = SQLite.openDatabaseSync("asyncStorage.db")

// Default journal mode (DELETE) fsyncs the whole file on every write, and
// every kv_store write in the app funnels through this one connection —
// that's the "giga slow" saves/pull-to-refresh. WAL + synchronous=NORMAL
// removes the per-write fsync while staying crash-safe.
db.execSync("PRAGMA journal_mode = WAL")
db.execSync("PRAGMA synchronous = NORMAL")

db.execSync(
  "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT)",
)

// One row per record, instead of the kv_store pattern of one row holding a
// JSON-stringified array of every record ever created (every off/* service
// used to do that — meaning saving a single macro entry or workout set
// re-serialized and rewrote the *entire* history every time, which is what
// made those saves and their subsequent reads "giga slow" as history grew).
// `sort_key` lets recent-history reads use an indexed range scan instead of
// pulling + parsing the whole collection just to keep the last N.
db.execSync(`CREATE TABLE IF NOT EXISTS kv_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (collection, id)
)`)
db.execSync(
  "CREATE INDEX IF NOT EXISTS idx_kv_records_sort ON kv_records (collection, sort_key)",
)

// expo-sqlite's native binding rejects with "shared object already released" /
// "cannot be cast to NativeDatabase" when many statements are prepared
// concurrently against one openDatabaseSync connection (e.g. the ~15 parallel
// getStorageItem calls WorkoutContext fires on boot). Serialize every call
// through this connection so only one statement is ever in flight.
// ponytail: global queue serializes all kv_store access on one connection;
// switch to expo-sqlite's async connection pool if this becomes a throughput bottleneck.
// A timeout advances the queue even if a call never settles (the native
// binding can wedge after the "shared object released" failure above) —
// otherwise one stuck call would freeze every future storage read/write.
const QUEUE_TIMEOUT_MS = 5000
let queue: Promise<unknown> = Promise.resolve()
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = Promise.race([
    result.then(() => {}, () => {}),
    new Promise<void>((resolve) => setTimeout(resolve, QUEUE_TIMEOUT_MS)),
  ])
  return result
}

export const getStorageItem = (key: string): Promise<string | null> =>
  serialize(async () => {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = ?",
      [key],
    )
    return row?.value ?? null
  })

export const setStorageItem = (key: string, value: string): Promise<void> =>
  serialize(async () => {
    await db.runAsync(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    )
  })

export const removeStorageItem = (key: string): Promise<void> =>
  serialize(async () => {
    await db.runAsync("DELETE FROM kv_store WHERE key = ?", [key])
  })

export const removeStorageItems = (keys: string[]): Promise<void> =>
  serialize(async () => {
    if (keys.length === 0) return
    const placeholders = keys.map(() => "?").join(", ")
    await db.runAsync(`DELETE FROM kv_store WHERE key IN (${placeholders})`, keys)
  })

// ─── kv_records (row-per-record collections) ───────────────────────────────

const upsertRecordSql =
  "INSERT INTO kv_records (collection, id, sort_key, value) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(collection, id) DO UPDATE SET sort_key = excluded.sort_key, value = excluded.value"

export const getRecord = (collection: string, id: string): Promise<string | null> =>
  serialize(async () => {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_records WHERE collection = ? AND id = ?",
      [collection, id],
    )
    return row?.value ?? null
  })

export const listRecords = (collection: string, limit?: number): Promise<string[]> =>
  serialize(async () => {
    const rows =
      limit == null
        ? await db.getAllAsync<{ value: string }>(
            "SELECT value FROM kv_records WHERE collection = ? ORDER BY sort_key DESC",
            [collection],
          )
        : await db.getAllAsync<{ value: string }>(
            "SELECT value FROM kv_records WHERE collection = ? ORDER BY sort_key DESC LIMIT ?",
            [collection, limit],
          )
    return rows.map((r) => r.value)
  })

export const listRecordsSince = (collection: string, sinceSortKey: string): Promise<string[]> =>
  serialize(async () => {
    const rows = await db.getAllAsync<{ value: string }>(
      "SELECT value FROM kv_records WHERE collection = ? AND sort_key >= ? ORDER BY sort_key DESC",
      [collection, sinceSortKey],
    )
    return rows.map((r) => r.value)
  })

export const putRecord = (
  collection: string,
  id: string,
  sortKey: string,
  value: string,
): Promise<void> =>
  serialize(async () => {
    await db.runAsync(upsertRecordSql, [collection, id, sortKey, value])
  })

export interface RecordWrite {
  id: string
  sortKey: string
  value: string
}

export const putRecords = (collection: string, records: RecordWrite[]): Promise<void> =>
  serialize(async () => {
    if (records.length === 0) return
    await db.withTransactionAsync(async () => {
      for (const r of records) {
        await db.runAsync(upsertRecordSql, [collection, r.id, r.sortKey, r.value])
      }
    })
  })

export const deleteRecord = (collection: string, id: string): Promise<void> =>
  serialize(async () => {
    await db.runAsync("DELETE FROM kv_records WHERE collection = ? AND id = ?", [collection, id])
  })

export const deleteRecords = (collection: string, ids: string[]): Promise<void> =>
  serialize(async () => {
    if (ids.length === 0) return
    const placeholders = ids.map(() => "?").join(", ")
    await db.runAsync(
      `DELETE FROM kv_records WHERE collection = ? AND id IN (${placeholders})`,
      [collection, ...ids],
    )
  })

export const clearCollection = (collection: string): Promise<void> =>
  serialize(async () => {
    await db.runAsync("DELETE FROM kv_records WHERE collection = ?", [collection])
  })
