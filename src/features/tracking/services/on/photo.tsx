import { apiCall } from "@shared/services/apiClient"

/**
 * Enhanced Photo Tracking with Calendar Integration
 */
export const photoApi = {
  /**
   * Get photos for a specific date range
   * GET /api/tracking/photos/range
   */
  getPhotosInRange: async (
    startDate: Date,
    endDate: Date,
  ): Promise<unknown> => {
    const start = startDate.toISOString().split("T")[0]
    const end = endDate.toISOString().split("T")[0]
    return apiCall(`/api/tracking/photos/range?start=${start}&end=${end}`)
  },

  /**
   * Get photos grouped by date
   * GET /api/tracking/photos/grouped
   */
  getPhotosGroupedByDate: async (days: number = 90): Promise<unknown> =>
    apiCall(`/api/tracking/photos/grouped?days=${days}`),

  /**
   * Compare photos from two dates
   * POST /api/tracking/photos/compare
   */
  comparePhotos: async (date1: Date, date2: Date): Promise<unknown> => {
    const d1 = date1.toISOString().split("T")[0]
    const d2 = date2.toISOString().split("T")[0]
    return apiCall(`/api/tracking/photos/compare`, {
      method: "POST",
      body: JSON.stringify({ date1: d1, date2: d2 }),
    })
  },
}
