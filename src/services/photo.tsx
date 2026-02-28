import { getServerUrl } from './config'
import { authenticatedFetch } from './auth'

/**
 * Enhanced Photo Tracking with Calendar Integration
 */
export const photoApi = {
  /**
   * Get photos for a specific date range
   * GET /api/tracking/photos/range
   */
  getPhotosInRange: async (startDate: Date, endDate: Date): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const start = startDate.toISOString().split('T')[0]
      const end = endDate.toISOString().split('T')[0]

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/photos/range?start=${start}&end=${end}`,
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to get photos in range')
      return data
    } catch (error) {
      console.error('Error getting photos in range:', error)
      throw error
    }
  },

  /**
   * Get photos grouped by date
   * GET /api/tracking/photos/grouped
   */
  getPhotosGroupedByDate: async (days: number = 90): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/photos/grouped?days=${days}`,
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to get grouped photos')
      return data
    } catch (error) {
      console.error('Error getting grouped photos:', error)
      throw error
    }
  },

  /**
   * Compare photos from two dates
   * POST /api/tracking/photos/compare
   */
  comparePhotos: async (date1: Date, date2: Date): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const d1 = date1.toISOString().split('T')[0]
      const d2 = date2.toISOString().split('T')[0]

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/photos/compare`,
        {
          method: 'POST',
          body: JSON.stringify({ date1: d1, date2: d2 }),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to compare photos')
      return data
    } catch (error) {
      console.error('Error comparing photos:', error)
      throw error
    }
  },
}
