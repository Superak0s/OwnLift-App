import { apiCall } from "@shared/services/apiClient"

export const sorenessApi = {
  /**
   * Log soreness (DOMS)
   * POST /api/tracking/soreness
   */
  logSoreness: async (
    muscleGroup: string,
    intensity: number,
    note?: string,
  ): Promise<unknown> =>
    apiCall(`/api/tracking/soreness`, {
      method: "POST",
      body: JSON.stringify({
        muscleGroup,
        intensity,
        loggedAt: new Date().toISOString(),
        note: note || null,
      }),
    }),

  /**
   * Get soreness history
   * GET /api/tracking/soreness?limit=N
   */
  getSorenessHistory: async (limit: number = 100): Promise<import("../types").ApiResponse<import("../types").SorenessEntry[]>> =>
    apiCall(`/api/tracking/soreness?limit=${limit}`),

  /**
   * Get soreness for specific date
   * GET /api/tracking/soreness/date/:date
   */
  getSorenessForDate: async (date: Date | string): Promise<import("../types").ApiResponse<import("../types").SorenessEntry[]>> => {
    const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : date
    return apiCall(`/api/tracking/soreness/date/${dateStr}`)
  },

  /**
   * Get soreness map (visual representation)
   * GET /api/tracking/soreness/map
   */
  getSorenessMap: async (): Promise<import("../types").ApiResponse<Record<string, any>>> =>
    apiCall(`/api/tracking/soreness/map`),

  /**
   * Get soreness map for specific date
   * GET /api/tracking/soreness/map/:date
   */
  getSorenessMapForDate: async (date: Date | string): Promise<import("../types").ApiResponse<Record<string, any>>> => {
    const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : date
    return apiCall(`/api/tracking/soreness/map/${dateStr}`)
  },

  /**
   * Get soreness stats
   * GET /api/tracking/soreness/stats?days=N
   */
  getSorenessStats: async (days: number = 7): Promise<import("../types").ApiResponse<Record<string, any>>> =>
    apiCall(`/api/tracking/soreness/stats?days=${days}`),

  /**
   * Get valid muscle groups
   * GET /api/tracking/soreness/muscles/list
   */
  getValidMuscleGroups: async (): Promise<import("../types").ApiResponse<string[]>> =>
    apiCall(`/api/tracking/soreness/muscles/list`),

  /**
   * Delete soreness entry
   * DELETE /api/tracking/soreness/:id
   */
  deleteSorenessEntry: async (id: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/soreness/${id}`, { method: "DELETE" }),
}

