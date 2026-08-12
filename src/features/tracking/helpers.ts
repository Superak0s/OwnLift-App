import type { DayModalState } from "./types";

export function filterDayModalEntry(prev: DayModalState | null, entryId: string | number) {
  if (!prev) return null;
  const remaining = (prev.existingEntries || []).filter((e: any) => e.id !== entryId);
  return {
    ...prev,
    existingEntries: remaining.length > 0 ? remaining : null,
  };
}

export function createDeleteHandler<T>(
  apiDelete: (id: any) => Promise<any>,
  setHistory: (updater: (prev: T[]) => T[]) => void,
  setDayModal: (updater: (prev: DayModalState | null) => DayModalState | null) => void,
  onAlert: (title: string, msg: string, buttons?: any[], type?: any) => void,
  extraCleanup?: (entry: T) => void,
) {
  const inFlightIds = new Set<string | number>();
  return async (entry: T) => {
    const entryId = (entry as { id: string | number }).id;
    if (inFlightIds.has(entryId)) return;
    inFlightIds.add(entryId);
    try {
      await apiDelete(entryId);
      setHistory((prev) => prev.filter((e) => (e as { id: string | number }).id !== entryId));
      setDayModal((prev) => filterDayModalEntry(prev, entryId));
      extraCleanup?.(entry);
    } catch (err) {
      onAlert(
        "Error",
        err instanceof Error ? err.message : String(err),
        [{ text: "OK" }],
        "error",
      );
    } finally {
      inFlightIds.delete(entryId);
    }
  };
}
