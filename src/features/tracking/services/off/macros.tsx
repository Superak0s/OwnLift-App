// features/tracking/services/off/macros.tsx

import AsyncStorage from "@react-native-async-storage/async-storage"
import { generateId } from "@utils/format"
import type { LogMacrosParams, MacrosGoals } from "../../types"

interface StoredMacrosEntry {
  id: string
  name: string | null
  protein: number | null
  carbs: number | null
  fat: number | null
  calories: number | null
  errorMargin: number
  time?: string
  takenAt: string
  note: string | null
}

const ENTRIES_KEY = "@offline_macros_entries"
const GOALS_KEY = "@offline_macros_goals"

const loadEntries = async (): Promise<StoredMacrosEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(ENTRIES_KEY)
    return raw ? (JSON.parse(raw) as StoredMacrosEntry[]) : []
  } catch (error) {
    console.error("Error loading offline macros entries:", error)
    return []
  }
}

const saveEntries = async (entries: StoredMacrosEntry[]): Promise<void> => {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

const sumField = (
  entries: StoredMacrosEntry[],
  field: keyof Pick<
    StoredMacrosEntry,
    "protein" | "carbs" | "fat" | "calories"
  >,
): number => entries.reduce((total, entry) => total + (entry[field] ?? 0), 0)

/**
 * Offline Macros Tracking API — same method names/signatures as
 * services/on/macros.tsx, backed by AsyncStorage instead of the server.
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
        takenAt,
        note,
      }

      const entries = await loadEntries()
      entries.push(entry)
      await saveEntries(entries)

      return { success: true, entry }
    } catch (error) {
      console.error("Error logging macros (offline):", error)
      throw error
    }
  },

  getMacrosHistory: async (days: number = 30): Promise<unknown> => {
    try {
      const entries = await loadEntries()
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const filtered = entries
        .filter((entry) => new Date(entry.takenAt).getTime() >= cutoff)
        .sort(
          (a, b) =>
            new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
        )
      return { entries: filtered }
    } catch (error) {
      console.error("Error getting macros history (offline):", error)
      throw error
    }
  },

  getMacrosStatsForDate: async (date: Date | string): Promise<unknown> => {
    try {
      const dateStr =
        date instanceof Date ? date.toISOString().split("T")[0] : date
      const entries = await loadEntries()
      const dayEntries = entries.filter((entry) =>
        entry.takenAt.startsWith(dateStr),
      )

      return {
        date: dateStr,
        entries: dayEntries,
        totals: {
          protein: sumField(dayEntries, "protein"),
          carbs: sumField(dayEntries, "carbs"),
          fat: sumField(dayEntries, "fat"),
          calories: sumField(dayEntries, "calories"),
        },
      }
    } catch (error) {
      console.error("Error getting macros stats (offline):", error)
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
      await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals))
      return { success: true, goals }
    } catch (error) {
      console.error("Error setting macros goals (offline):", error)
      throw error
    }
  },

  getMacrosGoals: async (): Promise<unknown> => {
    try {
      const raw = await AsyncStorage.getItem(GOALS_KEY)
      const goals: MacrosGoals = raw
        ? (JSON.parse(raw) as MacrosGoals)
        : { protein: null, carbs: null, fat: null, calories: null }
      return { goals }
    } catch (error) {
      console.error("Error getting macros goals (offline):", error)
      throw error
    }
  },

  deleteMacrosEntry: async (id: number | string): Promise<unknown> => {
    try {
      const entries = await loadEntries()
      const filtered = entries.filter((entry) => entry.id !== String(id))
      await saveEntries(filtered)
      return { success: true }
    } catch (error) {
      console.error("Error deleting macros entry (offline):", error)
      throw error
    }
  },

  getWeeklySummary: async (): Promise<unknown> => {
    try {
      const entries = await loadEntries()
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      const weekEntries = entries.filter(
        (entry) => new Date(entry.takenAt).getTime() >= cutoff,
      )
      const daysWithEntries =
        new Set(weekEntries.map((entry) => entry.takenAt.split("T")[0])).size ||
        1

      const totals = {
        protein: sumField(weekEntries, "protein"),
        carbs: sumField(weekEntries, "carbs"),
        fat: sumField(weekEntries, "fat"),
        calories: sumField(weekEntries, "calories"),
      }

      return {
        totals,
        dailyAverages: {
          protein: totals.protein / daysWithEntries,
          carbs: totals.carbs / daysWithEntries,
          fat: totals.fat / daysWithEntries,
          calories: totals.calories / daysWithEntries,
        },
        entries: weekEntries,
      }
    } catch (error) {
      console.error("Error getting weekly summary (offline):", error)
      throw error
    }
  },

  getMonthlySummary: async (): Promise<unknown> => {
    try {
      const entries = await loadEntries()
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      const monthEntries = entries.filter(
        (entry) => new Date(entry.takenAt).getTime() >= cutoff,
      )
      const daysWithEntries =
        new Set(monthEntries.map((entry) => entry.takenAt.split("T")[0]))
          .size || 1

      const totals = {
        protein: sumField(monthEntries, "protein"),
        carbs: sumField(monthEntries, "carbs"),
        fat: sumField(monthEntries, "fat"),
        calories: sumField(monthEntries, "calories"),
      }

      return {
        totals,
        dailyAverages: {
          protein: totals.protein / daysWithEntries,
          carbs: totals.carbs / daysWithEntries,
          fat: totals.fat / daysWithEntries,
          calories: totals.calories / daysWithEntries,
        },
        entries: monthEntries,
      }
    } catch (error) {
      console.error("Error getting monthly summary (offline):", error)
      throw error
    }
  },
}
