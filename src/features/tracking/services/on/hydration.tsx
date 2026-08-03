import { apiCall } from "@shared/services/apiClient"

export const hydrationApi = {
  /**
   * Log hydration intake
   * POST /api/tracking/hydration
   */
  logHydration: async (amountMl: number, note?: string): Promise<import("../types").ApiResponse<{ id: number }>> =>
    apiCall(`/api/tracking/hydration`, {
      method: "POST",
      body: JSON.stringify({
        amountMl,
        loggedAt: new Date().toISOString(),
        note: note || null,
      }),
    }),

  /**
   * Get hydration history
   * GET /api/tracking/hydration?limit=N
   */
  getHydrationHistory: async (limit: number = 100): Promise<import("../types").ApiResponse<import("../types").HydrationEntry[]>> =>
    apiCall(`/api/tracking/hydration?limit=${limit}`),

  /**
   * Get daily hydration
   * GET /api/tracking/hydration/daily/:date
   */
  getDailyHydration: async (date: Date | string): Promise<import("../types").ApiResponse<import("../types").HydrationEntry[]>> => {
    const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : date
    return apiCall(`/api/tracking/hydration/daily/${dateStr}`)
  },

  /**
   * Get hydration stats
   * GET /api/tracking/hydration/stats
   */
  getHydrationStats: async (): Promise<import("../types").ApiResponse<import("../types").HydrationStats>> =>
    apiCall(`/api/tracking/hydration/stats`),

  /**
   * Delete hydration entry
   * DELETE /api/tracking/hydration/:id
   */
  deleteHydrationEntry: async (id: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/hydration/${id}`, { method: "DELETE" }),

  // Hydration settings
  getSettings: async (): Promise<import("../types").ApiResponse<{ goalMl: number; measurementErrorPercent: number }>> =>
    apiCall(`/api/tracking/hydration/settings`),

  setSettings: async (goalMl?: number, measurementErrorPercent?: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/hydration/settings`, {
      method: "POST",
      body: JSON.stringify({ goalMl, measurementErrorPercent }),
    }),
};
