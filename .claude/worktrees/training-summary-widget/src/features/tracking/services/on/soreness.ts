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
   * Delete soreness entry
   * DELETE /api/tracking/soreness/:id
   */
  deleteSorenessEntry: async (id: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/soreness/${id}`, { method: "DELETE" }),
}

