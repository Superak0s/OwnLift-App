import { apiCall } from "@shared/services/apiClient"

export const bodyMeasurementsApi = {
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

  getMeasurementHistory: async (limit: number = 90): Promise<import("../types").ApiResponse<import("../types").MeasurementEntry[]>> =>
    apiCall(`/api/tracking/measurements?limit=${limit}`),

  deleteMeasurementEntry: async (id: number): Promise<unknown> =>
    apiCall(`/api/tracking/measurements/${id}`, { method: "DELETE" }),
}

