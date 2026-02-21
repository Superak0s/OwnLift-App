import { getServerUrl } from "./config"
import { authenticatedFetch } from "./auth"

/**
 * Macros Tracking API
 * All macro fields (protein, carbs, fat, calories) are optional.
 * Log only what you know — even just a name and calories is valid.
 */
export const macrosTrackingApi = {
  /**
   * Log a macros intake entry
   * POST /api/tracking/macros/log
   *
   * @param {object} params
   * @param {string}  [params.name]        - Food/meal name (e.g. "Chicken & rice")
   * @param {number}  [params.protein]     - Grams of protein
   * @param {number}  [params.carbs]       - Grams of carbohydrates
   * @param {number}  [params.fat]         - Grams of fat
   * @param {number}  [params.calories]    - Kilocalories
   * @param {number}  [params.errorMargin] - Measurement error ±% (default 0)
   * @param {string}   params.time         - HH:MM format
   * @param {string}  [params.date]        - YYYY-MM-DD (defaults to today)
   * @param {string}  [params.note]        - Optional free-text note
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
  }) => {
    try {
      const API_BASE_URL = getServerUrl()

      // Build takenAt from the provided date + time, or fall back to now
      let takenAt
      if (date) {
        const timeStr = time || new Date().toTimeString().slice(0, 5)
        takenAt = `${date}T${timeStr}:00`
      } else {
        takenAt = new Date().toISOString()
      }

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/log`,
        {
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
        },
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to log macros")
      return data
    } catch (error) {
      console.error("Error logging macros:", error)
      throw error
    }
  },

  /**
   * Get macros intake history
   * GET /api/tracking/macros/log?days=N
   */
  getMacrosHistory: async (days = 30) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/log?days=${days}`,
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get macros history")
      return data
    } catch (error) {
      console.error("Error getting macros history:", error)
      throw error
    }
  },

  /**
   * Get macros stats for a specific date
   * GET /api/tracking/macros/stats/:date
   */
  getMacrosStatsForDate: async (date) => {
    try {
      const API_BASE_URL = getServerUrl()
      const dateStr =
        date instanceof Date ? date.toISOString().split("T")[0] : date
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/stats/${dateStr}`,
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get macros stats")
      return data
    } catch (error) {
      console.error("Error getting macros stats:", error)
      throw error
    }
  },

  /**
   * Set daily macros goals (all optional — only provided values are updated)
   * PUT /api/tracking/macros/goals
   */
  setMacrosGoals: async ({ protein, carbs, fat, calories }) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/goals`,
        {
          method: "PUT",
          body: JSON.stringify({
            protein: protein != null ? protein : null,
            carbs: carbs != null ? carbs : null,
            fat: fat != null ? fat : null,
            calories: calories != null ? calories : null,
          }),
        },
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to set macros goals")
      return data
    } catch (error) {
      console.error("Error setting macros goals:", error)
      throw error
    }
  },

  /**
   * Get macros goals
   * GET /api/tracking/macros/goals
   */
  getMacrosGoals: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/goals`,
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get macros goals")
      return data
    } catch (error) {
      console.error("Error getting macros goals:", error)
      throw error
    }
  },

  /**
   * Delete a macros entry
   * DELETE /api/tracking/macros/log/:id
   */
  deleteMacrosEntry: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/log/${id}`,
        { method: "DELETE" },
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to delete macros entry")
      return data
    } catch (error) {
      console.error("Error deleting macros entry:", error)
      throw error
    }
  },

  /**
   * Get weekly macros summary
   * GET /api/tracking/macros/summary/week
   */
  getWeeklySummary: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/summary/week`,
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get weekly summary")
      return data
    } catch (error) {
      console.error("Error getting weekly summary:", error)
      throw error
    }
  },

  /**
   * Get monthly macros summary
   * GET /api/tracking/macros/summary/month
   */
  getMonthlySummary: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/macros/summary/month`,
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get monthly summary")
      return data
    } catch (error) {
      console.error("Error getting monthly summary:", error)
      throw error
    }
  },
}
