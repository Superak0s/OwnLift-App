import { apiCall } from "@shared/services/apiClient"

export const bodyMeasurementsApi = {
  /**
   * Log body measurements
   * POST /api/tracking/measurements
   */
  logMeasurement: async (
    waistCm?: number | null,
    armLeftCm?: number | null,
    armRightCm?: number | null,
    chestCm?: number | null,
    measuredAt?: string,
    note?: string,
  ): Promise<unknown> =>
    apiCall(`/api/tracking/measurements`, {
      method: "POST",
      body: JSON.stringify({
        waistCm: waistCm || null,
        armLeftCm: armLeftCm || null,
        armRightCm: armRightCm || null,
        chestCm: chestCm || null,
        measuredAt: measuredAt || new Date().toISOString(),
        note: note || null,
      }),
    }),

  /**
   * Get measurement history
   * GET /api/tracking/measurements?limit=N
   */
  getMeasurementHistory: async (limit: number = 90): Promise<import("../types").ApiResponse<import("../types").MeasurementEntry[]>> =>
    apiCall(`/api/tracking/measurements?limit=${limit}`),

  /**
   * Get latest measurement
   * GET /api/tracking/measurements/latest
   */
  getLatestMeasurement: async (): Promise<unknown> =>
    apiCall(`/api/tracking/measurements/latest`),

  /**
   * Get measurement stats
   * GET /api/tracking/measurements/stats?days=N
   */
  getMeasurementStats: async (days: number = 90): Promise<unknown> =>
    apiCall(`/api/tracking/measurements/stats?days=${days}`),

  /**
   * Delete measurement entry
   * DELETE /api/tracking/measurements/:id
   */
  deleteMeasurementEntry: async (id: number): Promise<unknown> =>
    apiCall(`/api/tracking/measurements/${id}`, { method: "DELETE" }),
}

