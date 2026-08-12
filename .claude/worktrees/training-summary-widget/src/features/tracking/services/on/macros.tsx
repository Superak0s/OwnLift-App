import { apiCall } from "@shared/services/apiClient"
import type { LogMacrosParams, MacrosGoals } from "../../types"
import type { MacrosEntry } from "@shared/types"

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
  getMacrosHistory: async (
    days: number = 30,
  ): Promise<{ entries: MacrosEntry[] }> =>
    apiCall(`/api/tracking/macros/log?days=${days}`),

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
   * Delete a macros entry
   * DELETE /api/tracking/macros/log/:id
   */
  deleteMacrosEntry: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/macros/log/${id}`, { method: "DELETE" }),
}
