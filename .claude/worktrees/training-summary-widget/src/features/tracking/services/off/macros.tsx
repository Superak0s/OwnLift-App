import { setStorageItem } from "@shared/services/sqliteStorage"
import { createRecordStore } from "@shared/services/offlineHelpers"
import { generateId } from "@utils/format"
import type { LogMacrosParams, MacrosGoals } from "../../types"
import type { MacrosEntry } from "@shared/types"

interface StoredMacrosEntry {
  id: string
  name: string | null
  protein: number | null
  carbs: number | null
  fat: number | null
  calories: number | null
  errorMargin: number
  time?: string
  date: string
  takenAt: string
  note: string | null
}

const ENTRIES_KEY = "@offline_macros_entries"
const GOALS_KEY = "@offline_macros_goals"

const entriesStore = createRecordStore<StoredMacrosEntry>(
  "macros_entries",
  ENTRIES_KEY,
  (e) => e.id,
  (e) => e.takenAt,
)

/**
 * Offline Macros Tracking API — same method names/signatures as
 * services/on/macros.tsx, backed by local SQLite storage instead of the server.
 */
export const macrosTrackingApi = {
  logMacros: async ({
    name,
    protein,
    carbs,
    fat,
    calories,
    errorMargin = 0,
    time,
    date = null,
    note = null,
  }: LogMacrosParams): Promise<unknown> => {
    try {
      let takenAt: string
      if (date) {
        const timeStr = time || new Date().toTimeString().slice(0, 5)
        takenAt = `${date}T${timeStr}:00`
      } else {
        takenAt = new Date().toISOString()
      }

      const entry: StoredMacrosEntry = {
        id: generateId(),
        name: name ?? null,
        protein: protein ?? null,
        carbs: carbs ?? null,
        fat: fat ?? null,
        calories: calories ?? null,
        errorMargin: errorMargin ?? 0,
        time,
        date: takenAt.split("T")[0],
        takenAt,
        note,
      }

      await entriesStore.put(entry)

      return { success: true, entry }
    } catch (error) {
      console.error("Error logging macros (offline):", error)
      throw error
    }
  },

  getMacrosHistory: async (
    days: number = 30,
  ): Promise<{ entries: MacrosEntry[] }> => {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const entries = await entriesStore.getSince(cutoff)
      return { entries: entries.map((e) => ({ ...e, name: e.name ?? undefined })) }
    } catch (error) {
      console.error("Error getting macros history (offline):", error)
      throw error
    }
  },

  setMacrosGoals: async ({
    protein,
    carbs,
    fat,
    calories,
  }: MacrosGoals): Promise<unknown> => {
    try {
      const goals: Required<MacrosGoals> = {
        protein: protein ?? null,
        carbs: carbs ?? null,
        fat: fat ?? null,
        calories: calories ?? null,
      }
      await setStorageItem(GOALS_KEY, JSON.stringify(goals))
      return { success: true, goals }
    } catch (error) {
      console.error("Error setting macros goals (offline):", error)
      throw error
    }
  },

  deleteMacrosEntry: async (id: number | string): Promise<unknown> => {
    try {
      await entriesStore.remove(id)
      return { success: true }
    } catch (error) {
      console.error("Error deleting macros entry (offline):", error)
      throw error
    }
  },
}
