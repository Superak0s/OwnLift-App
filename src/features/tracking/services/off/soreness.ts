import { createRecordStore } from "@shared/services/offlineHelpers"
import type { ApiResponse } from "../types"
import type { SorenessEntry } from "../types"

const HISTORY_KEY = "@off_soreness_history"

const store = createRecordStore<SorenessEntry>(
  "soreness_entries",
  HISTORY_KEY,
  (e) => e.id,
  (e) => e.loggedAt,
)

let idCounter = Date.now()
function nextId(): number {
  return ++idCounter
}

export const sorenessApi = {
  logSoreness: async (
    muscleGroup: string,
    intensity: number,
    note?: string,
  ): Promise<ApiResponse<SorenessEntry>> => {
    const entry: SorenessEntry = {
      id: nextId(),
      muscleGroup,
      intensity,
      loggedAt: new Date().toISOString(),
      note: note || null,
      createdAt: new Date().toISOString(),
    }
    await store.put(entry)
    return { success: true, data: entry }
  },

  getSorenessHistory: async (
    limit: number = 100,
  ): Promise<ApiResponse<SorenessEntry[]>> => {
    const data = await store.getRecent(limit)
    return { success: true, data }
  },

  getSorenessMap: async (): Promise<ApiResponse<Record<string, number>>> => {
    const today = new Date().toISOString().split("T")[0]
    const todayEntries = await store.getSince(today)
    const map: Record<string, number> = {}
    todayEntries
      .filter((e) => e.loggedAt.startsWith(today))
      .forEach((e) => {
        const existing = map[e.muscleGroup]
        if (existing === undefined || e.intensity > existing) {
          map[e.muscleGroup] = e.intensity
        }
      })
    return { success: true, data: map }
  },

  deleteSorenessEntry: async (
    id: number,
  ): Promise<ApiResponse<null>> => {
    await store.remove(id)
    return { success: true, data: null }
  },
}
