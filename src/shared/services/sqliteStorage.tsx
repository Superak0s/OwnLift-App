import * as SQLite from "expo-sqlite";
import logger from "./logger";

const db = SQLite.openDatabaseSync("asyncStorage.db");

db.execSync("PRAGMA journal_mode = WAL");
db.execSync("PRAGMA synchronous = NORMAL");

db.execSync(
  "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT)",
);

db.execSync(`CREATE TABLE IF NOT EXISTS kv_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (collection, id)
)`);
db.execSync(
  "CREATE INDEX IF NOT EXISTS idx_kv_records_sort ON kv_records (collection, sort_key)",
);

// ponytail: global queue serializes all kv_store access on one connection;
// switch to expo-sqlite's async connection pool if this becomes a throughput bottleneck.
const QUEUE_TIMEOUT_MS = 5000;
let queue: Promise<unknown> = Promise.resolve();
// Flags a label that's still in flight (queued or executing) when the same
// label is requested again — two callers racing on the same key/record,
// e.g. two effects or a double-tap firing the same read/write together. A
// label reused after its prior call already resolved is normal repeat
// access (logging another set into the same session row, etc.), not a bug.
const inFlightLabelCounts = new Map<string, number>();
function serialize<T>(label: string, task: () => Promise<T>): Promise<T> {
  if ((inFlightLabelCounts.get(label) ?? 0) > 0) {
    console.warn(`[sqlite] duplicate call: ${label}`);
  }
  inFlightLabelCounts.set(label, (inFlightLabelCounts.get(label) ?? 0) + 1);
  const queuedAt = Date.now();
  const timed = async () => {
    const waitMs = Date.now() - queuedAt;
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const count = inFlightLabelCounts.get(label) ?? 1;
      if (count <= 1) inFlightLabelCounts.delete(label);
      else inFlightLabelCounts.set(label, count - 1);
      if (waitMs > 150 || Date.now() - startedAt > 150) {
        logger.debug(
          `[sqlite] ${label} wait=${waitMs}ms exec=${Date.now() - startedAt}ms`,
        );
      }
    }
  };
  const result = queue.then(timed, timed);
  queue = Promise.race([
    result.then(
      () => {},
      () => {},
    ),
    new Promise<void>((resolve) => setTimeout(resolve, QUEUE_TIMEOUT_MS)),
  ]);
  return result;
}

export const getStorageItem = (key: string): Promise<string | null> =>
  serialize(`getStorageItem(${key})`, async () => {
    const row = db.getFirstSync<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = ?",
      [key],
    );
    return row?.value ?? null;
  });

export const setStorageItem = (key: string, value: string): Promise<void> =>
  serialize(`setStorageItem(${key})`, async () => {
    db.runSync(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  });

export const getStorageItems = (keys: string[]): Promise<Record<string, string>> =>
  serialize(`getStorageItems(${keys.length})`, async () => {
    if (keys.length === 0) return {}
    const placeholders = keys.map(() => "?").join(", ")
    const rows = db.getAllSync<{ key: string; value: string }>(
      `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
      keys,
    )
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  })

export const removeStorageItem = (key: string): Promise<void> =>
  serialize(`removeStorageItem(${key})`, async () => {
    db.runSync("DELETE FROM kv_store WHERE key = ?", [key]);
  });

export const removeStorageItems = (keys: string[]): Promise<void> =>
  serialize(`removeStorageItems(${keys.length})`, async () => {
    if (keys.length === 0) return;
    const placeholders = keys.map(() => "?").join(", ");
    db.runSync(
      `DELETE FROM kv_store WHERE key IN (${placeholders})`,
      keys,
    );
  });


const upsertRecordSql =
  "INSERT INTO kv_records (collection, id, sort_key, value) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(collection, id) DO UPDATE SET sort_key = excluded.sort_key, value = excluded.value";

export const getRecord = (
  collection: string,
  id: string,
): Promise<string | null> =>
  serialize(`getRecord(${collection}, ${id})`, async () => {
    const row = db.getFirstSync<{ value: string }>(
      "SELECT value FROM kv_records WHERE collection = ? AND id = ?",
      [collection, id],
    );
    return row?.value ?? null;
  });

export const listRecords = (
  collection: string,
  limit?: number,
): Promise<string[]> =>
  serialize(
    `listRecords(${collection}, limit=${limit ?? "none"})`,
    async () => {
      const rows =
        limit == null
          ? db.getAllSync<{ value: string }>(
              "SELECT value FROM kv_records WHERE collection = ? ORDER BY sort_key DESC",
              [collection],
            )
          : db.getAllSync<{ value: string }>(
              "SELECT value FROM kv_records WHERE collection = ? ORDER BY sort_key DESC LIMIT ?",
              [collection, limit],
            );
      return rows.map((r) => r.value);
    },
  );

export const listRecordsSince = (
  collection: string,
  sinceSortKey: string,
): Promise<string[]> =>
  serialize(`listRecordsSince(${collection})`, async () => {
    const rows = db.getAllSync<{ value: string }>(
      "SELECT value FROM kv_records WHERE collection = ? AND sort_key >= ? ORDER BY sort_key DESC",
      [collection, sinceSortKey],
    );
    return rows.map((r) => r.value);
  });

export const putRecord = (
  collection: string,
  id: string,
  sortKey: string,
  value: string,
): Promise<void> =>
  serialize(`putRecord(${collection}, ${id})`, async () => {
    db.runSync(upsertRecordSql, [collection, id, sortKey, value]);
  });

export interface RecordWrite {
  id: string;
  sortKey: string;
  value: string;
}

export const putRecords = (
  collection: string,
  records: RecordWrite[],
): Promise<void> =>
  serialize(`putRecords(${collection}, ${records.length})`, async () => {
    if (records.length === 0) return;
    db.withTransactionSync(() => {
      for (const r of records) {
        db.runSync(upsertRecordSql, [collection, r.id, r.sortKey, r.value]);
      }
    });
  });

export const deleteRecord = (collection: string, id: string): Promise<void> =>
  serialize(`deleteRecord(${collection}, ${id})`, async () => {
    db.runSync("DELETE FROM kv_records WHERE collection = ? AND id = ?", [
      collection,
      id,
    ]);
  });

export const deleteRecords = (
  collection: string,
  ids: string[],
): Promise<void> =>
  serialize(`deleteRecords(${collection}, ${ids.length})`, async () => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    db.runSync(
      `DELETE FROM kv_records WHERE collection = ? AND id IN (${placeholders})`,
      [collection, ...ids],
    );
  });

export const clearCollection = (collection: string): Promise<void> =>
  serialize(`clearCollection(${collection})`, async () => {
    db.runSync("DELETE FROM kv_records WHERE collection = ?", [collection]);
  });
