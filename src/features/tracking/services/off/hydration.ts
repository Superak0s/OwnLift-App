import { getStorageItem, setStorageItem } from "@shared/services/sqliteStorage"
import { createRecordStore } from "@shared/services/offlineHelpers"
import type {
  ApiResponse,
  HydrationEntry,
} from "../types"

const HISTORY_KEY = "@off_hydration_history"
const SETTINGS_KEY = "@off_hydration_settings"
const DEFAULT_SETTINGS = { goalMl: 2500, measurementErrorPercent: 5 }

const store = createRecordStore<HydrationEntry>(
  "hydration_entries",
  HISTORY_KEY,
  (e) => e.id,
  (e) => e.loggedAt,
)

async function readSettings(): Promise<{ goalMl: number; measurementErrorPercent: number }> {
  try {
    const raw = await getStorageItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let idCounter = Date.now()
function nextId(): number {
  return ++idCounter
}

export const hydrationApi = {
  logHydration: async (
    amountMl: number,
    note?: string,
  ): Promise<ApiResponse<{ id: number }>> => {
    const entry: HydrationEntry = {
      id: nextId(),
      amountMl,
      loggedAt: new Date().toISOString(),
      note: note || null,
      createdAt: new Date().toISOString(),
    }
    await store.put(entry)
    return { success: true, data: { id: entry.id } }
  },

  getHydrationHistory: async (
    limit: number = 100,
  ): Promise<ApiResponse<HydrationEntry[]>> => {
    const data = await store.getRecent(limit)
    return { success: true, data }
  },

  deleteHydrationEntry: async (
    id: number,
  ): Promise<ApiResponse<null>> => {
    await store.remove(id)
    return { success: true, data: null }
  },

  getSettings: async (): Promise<ApiResponse<{ goalMl: number; measurementErrorPercent: number }>> => {
    const settings = await readSettings()
    return { success: true, data: settings }
  },

  setSettings: async (
    goalMl?: number,
    measurementErrorPercent?: number,
  ): Promise<ApiResponse<null>> => {
    const current = await readSettings()
    const updated = {
      goalMl: goalMl ?? current.goalMl,
      measurementErrorPercent: measurementErrorPercent ?? current.measurementErrorPercent,
    }
    await setStorageItem(SETTINGS_KEY, JSON.stringify(updated))
    return { success: true, data: null }
  },
}
