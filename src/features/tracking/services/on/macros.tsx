import { apiCall } from "@shared/services/apiClient"
import type { LogMacrosParams, MacrosGoals } from "../../types"

/**
 * Macros Tracking API
 * All macro fields (protein, carbs, fat, calories) are optional.
 */
export const macrosTrackingApi = {
  /**
   * Log a macros intake entry
   * POST /api/tracking/macros/log
   */
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
    let takenAt: string
    if (date) {
      const timeStr = time || new Date().toTimeString().slice(0, 5)
      takenAt = `${date}T${timeStr}:00`
    } else {
      takenAt = new Date().toISOString()
    }

    return apiCall(`/api/tracking/macros/log`, {
      method: "POST",
      body: JSON.stringify({
        name: name || null,
        protein: protein != null ? protein : null,
        carbs: carbs != null ? carbs : null,
        fat: fat != null ? fat : null,
        calories: calories != null ? calories : null,
        errorMargin: errorMargin ?? 0,
        time,
        takenAt,
        note,
      }),
    })
  },

  /**
   * Get macros intake history
   * GET /api/tracking/macros/log?days=N
   */
  getMacrosHistory: async (days: number = 30): Promise<unknown> =>
    apiCall(`/api/tracking/macros/log?days=${days}`),

  /**
   * Get macros stats for a specific date
   * GET /api/tracking/macros/stats/:date
   */
  getMacrosStatsForDate: async (date: Date | string): Promise<unknown> => {
    const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : date
    return apiCall(`/api/tracking/macros/stats/${dateStr}`)
  },

  /**
   * Set daily macros goals
   * PUT /api/tracking/macros/goals
   */
  setMacrosGoals: async ({
    protein,
    carbs,
    fat,
    calories,
  }: MacrosGoals): Promise<unknown> =>
    apiCall(`/api/tracking/macros/goals`, {
      method: "PUT",
      body: JSON.stringify({
        protein: protein != null ? protein : null,
        carbs: carbs != null ? carbs : null,
        fat: fat != null ? fat : null,
        calories: calories != null ? calories : null,
      }),
    }),

  /**
   * Get macros goals
   * GET /api/tracking/macros/goals
   */
  getMacrosGoals: async (): Promise<unknown> =>
    apiCall(`/api/tracking/macros/goals`),

  /**
   * Delete a macros entry
   * DELETE /api/tracking/macros/log/:id
   */
  deleteMacrosEntry: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/macros/log/${id}`, { method: "DELETE" }),

  /**
   * Get weekly macros summary
   * GET /api/tracking/macros/summary/week
   */
  getWeeklySummary: async (): Promise<unknown> =>
    apiCall(`/api/tracking/macros/summary/week`),

  /**
   * Get monthly macros summary
   * GET /api/tracking/macros/summary/month
   */
  getMonthlySummary: async (): Promise<unknown> =>
    apiCall(`/api/tracking/macros/summary/month`),
}
