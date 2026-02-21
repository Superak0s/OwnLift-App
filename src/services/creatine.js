import { getServerUrl } from "./config"
import { authenticatedFetch } from "./auth"

/**
 * Creatine API
 */
export const creatineApi = {
  /**
   * Save creatine reminder location
   * PUT /api/tracking/creatine/location
   */
  saveReminderLocation: async (latitude, longitude, address, radius) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/location`,
        {
          method: "PUT",
          body: JSON.stringify({
            latitude,
            longitude,
            address,
            radius, // in meters
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save reminder location")
      }

      return data
    } catch (error) {
      console.error("Error saving reminder location:", error)
      throw error
    }
  },

  /**
   * Get reminder location
   * GET /api/tracking/creatine/location
   */
  getReminderLocation: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/location`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get reminder location")
      }

      return data
    } catch (error) {
      console.error("Error getting reminder location:", error)
      throw error
    }
  },

  /**
   * Enable/disable location-based reminders
   * PUT /api/tracking/creatine/location/toggle
   */
  toggleLocationReminder: async (enabled) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/location/toggle`,
        {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle location reminder")
      }

      return data
    } catch (error) {
      console.error("Error toggling location reminder:", error)
      throw error
    }
  },

  /**
   * Check if user is within reminder location
   * POST /api/tracking/creatine/location/check
   */
  checkIfAtLocation: async (currentLatitude, currentLongitude) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/location/check`,
        {
          method: "POST",
          body: JSON.stringify({
            latitude: currentLatitude,
            longitude: currentLongitude,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to check location")
      }

      return data // { withinRadius: boolean, distance: number }
    } catch (error) {
      console.error("Error checking location:", error)
      throw error
    }
  },
}
