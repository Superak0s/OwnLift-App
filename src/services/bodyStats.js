import AsyncStorage from "@react-native-async-storage/async-storage"
import { getServerUrl } from "./config"
import { authenticatedFetch, authService } from "./auth"

/**
 * Body Tracking API - Weight, Height, Creatine, Progress Photos
 */
export const bodyTrackingApi = {
  /**
   * Fetch all tracking data in a single request
   * GET /api/body/snapshot
   */
  fetchTrackingSnapshot: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/body/snapshot`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tracking snapshot")
      }

      return data
    } catch (error) {
      console.error("Error fetching tracking snapshot:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────
  // BODY WEIGHT
  // ─────────────────────────────────────────────────────────────

  /**
   * Log a weight entry
   * POST /api/tracking/bodystats/weight
   *
   * @param {number} weight
   * @param {string} unit        - "kg" | "lbs"
   * @param {string} [note]
   * @param {string} [recordedAt] - ISO string; if omitted, uses current time.
   *                               Pass a YYYY-MM-DDTHH:MM:SS local string when
   *                               logging for a specific calendar date.
   */
  logWeight: async (weight, unit, note = null, recordedAt = null) => {
    try {
      const API_BASE_URL = getServerUrl()
      const weightKg = unit === "lbs" ? weight * 0.453592 : weight

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/weight`,
        {
          method: "POST",
          body: JSON.stringify({
            weightKg,
            recordedAt: recordedAt || new Date().toISOString(),
            note,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to log weight")
      }

      return data
    } catch (error) {
      console.error("Error logging weight:", error)
      throw error
    }
  },

  /**
   * Get weight history
   * GET /api/tracking/bodystats/weight
   */
  getWeightHistory: async (limit = 90) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/weight?limit=${limit}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get weight history")
      }

      return data
    } catch (error) {
      console.error("Error getting weight history:", error)
      throw error
    }
  },

  /**
   * Delete a weight entry
   * DELETE /api/tracking/bodystats/:id
   */
  deleteWeightEntry: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/weight/${id}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete weight entry")
      }

      return data
    } catch (error) {
      console.error("Error deleting weight entry:", error)
      throw error
    }
  },

  /**
   * Get current weight
   * GET /api/tracking/bodystats/current
   */
  getCurrentWeight: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/current`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get current weight")
      }

      return data
    } catch (error) {
      console.error("Error getting current weight:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────
  // HEIGHT & UNIT PREFERENCES
  // ─────────────────────────────────────────────────────────────

  /**
   * Save height and unit preferences
   * PUT /api/tracking/bodystats/height
   */
  saveHeightAndUnits: async (height, weightUnit) => {
    try {
      const API_BASE_URL = getServerUrl()
      let heightCm
      if (height.unit === "cm") {
        heightCm = height.value
      } else {
        // ft + in → cm
        const totalInches = height.value * 12 + (height.inches || 0)
        heightCm = totalInches * 2.54
      }

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/height`,
        {
          method: "PUT",
          body: JSON.stringify({
            heightCm,
            heightUnit: height.unit,
            weightUnit,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save height and units")
      }

      return data
    } catch (error) {
      console.error("Error saving height and units:", error)
      throw error
    }
  },

  /**
   * Get height and unit preferences
   * GET /api/tracking/bodystats/height
   */
  getHeightAndUnits: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/height`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get height and units")
      }

      return data
    } catch (error) {
      console.error("Error getting height and units:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────
  // CREATINE SETTINGS
  // ─────────────────────────────────────────────────────────────

  /**
   * Save creatine reminder settings
   * PUT /api/tracking/creatine/settings
   */
  saveCreatineSettings: async (
    timeBasedEnabled,
    locationBasedEnabled,
    reminderTime,
    defaultGrams = 5,
    notificationType = "notification",
  ) => {
    try {
      const API_BASE_URL = getServerUrl()

      const enabled = timeBasedEnabled || locationBasedEnabled

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/settings`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled,
            timeBasedEnabled,
            locationBasedEnabled,
            reminderTime,
            defaultGrams,
            notificationType,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save creatine settings")
      }

      return data
    } catch (error) {
      console.error("Error saving creatine settings:", error)
      throw error
    }
  },

  /**
   * Get creatine settings, today's status, and streak
   * GET /api/tracking/creatine/settings
   */
  getCreatineStatus: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/settings`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get creatine status")
      }

      return data
    } catch (error) {
      console.error("Error getting creatine status:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────
  // CREATINE LOG
  // ─────────────────────────────────────────────────────────────

  /**
   * Mark creatine as taken
   * POST /api/tracking/creatine/log
   *
   * @param {number} grams
   * @param {string} [note]
   * @param {string} [takenAt] - ISO/local datetime string; defaults to now.
   *                             Pass a YYYY-MM-DDTHH:MM:SS string when logging
   *                             for a specific calendar date.
   */
  markCreatineTaken: async (grams = 5, note = null, takenAt = null) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/log`,
        {
          method: "POST",
          body: JSON.stringify({
            grams,
            takenAt: takenAt || new Date().toISOString(),
            note,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to mark creatine taken")
      }

      return data
    } catch (error) {
      console.error("Error marking creatine taken:", error)
      throw error
    }
  },

  /**
   * Get creatine intake history
   * GET /api/tracking/creatine/log
   */
  getCreatineHistory: async (limit = 30) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/log?limit=${limit}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get creatine history")
      }

      return data
    } catch (error) {
      console.error("Error getting creatine history:", error)
      throw error
    }
  },

  /**
   * Delete a creatine log entry
   * DELETE /api/tracking/creatine/log/:id
   */
  deleteCreatineEntry: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/creatine/log/${id}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete creatine entry")
      }

      return data
    } catch (error) {
      console.error("Error deleting creatine entry:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────
  // PROGRESS PHOTOS
  // ─────────────────────────────────────────────────────────────

  /**
   * Upload a progress photo
   * POST /api/tracking/photos
   *
   * @param {string} localUri
   * @param {string} [mimeType]
   * @param {string} [note]
   * @param {string} [date] - YYYY-MM-DD; defaults to today.
   */
  uploadProgressPhoto: async (
    localUri,
    mimeType = "image/jpeg",
    note = null,
    date = null,
  ) => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await authService.getToken()

      const formData = new FormData()
      formData.append("photo", {
        uri: localUri,
        name: `photo_${Date.now()}.jpg`,
        type: mimeType,
      })

      // Use the provided date at noon local time, or fall back to now
      const takenAt = date ? `${date}T12:00:00` : new Date().toISOString()
      formData.append("takenAt", takenAt)
      if (note) formData.append("note", note)

      const response = await fetch(`${API_BASE_URL}/api/tracking/photos`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Photo upload failed")
      }

      return data
    } catch (error) {
      console.error("Error uploading progress photo:", error)
      throw error
    }
  },

  /**
   * Get photo metadata list
   * GET /api/tracking/photos
   */
  getPhotoList: async (limit = 50) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/photos?limit=${limit}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get photo list")
      }

      return data
    } catch (error) {
      console.error("Error getting photo list:", error)
      throw error
    }
  },

  /**
   * Get photo URL for rendering in <Image>
   */
  getPhotoUrl: (id) => {
    const API_BASE_URL = getServerUrl()
    return `${API_BASE_URL}/api/tracking/photos/${id}`
  },

  /**
   * Fetch a photo as a base64 data URI for React Native <Image>
   */
  fetchPhotoAsUri: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const token = await authService.getToken()

      const response = await fetch(
        `${API_BASE_URL}/api/tracking/photos/${id}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
      )

      if (!response.ok) {
        throw new Error("Photo not found")
      }

      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error("Error fetching photo as URI:", error)
      throw error
    }
  },

  /**
   * Delete a progress photo
   * DELETE /api/tracking/photos/:id
   */
  deleteProgressPhoto: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/photos/${id}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete progress photo")
      }

      return data
    } catch (error) {
      console.error("Error deleting progress photo:", error)
      throw error
    }
  },
}

/**
 * Helper function to get current body weight
 */
export const getCurrentBodyWeight = async (userId) => {
  try {
    const { entry } = await bodyTrackingApi.getCurrentWeight()
    if (entry) return entry.weight_kg
  } catch (err) {
    console.warn("Failed to get current weight from server:", err.message)
  }
  try {
    const key = userId ? `weightHistory_user_${userId}` : "weightHistory"
    const saved = await AsyncStorage.getItem(key)
    if (!saved) return null
    const history = JSON.parse(saved)
    if (!history.length) return null
    const sorted = [...history].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    )
    const latest = sorted[0]
    return latest.unit === "lbs" ? latest.weight * 0.453592 : latest.weight
  } catch (_) {
    return null
  }
}

/**
 * Body Fat Tracking API
 * US Navy Method calculation and historical tracking
 */
export const bodyFatApi = {
  /**
   * Log a body fat percentage calculation
   * POST /api/tracking/bodystats/bodyfat/log
   *
   * @param {number} percentage
   * @param {object} measurements  - {waist, neck, hip (optional), unit}
   * @param {string} gender        - "male" | "female"
   * @param {string} [date]        - YYYY-MM-DD or full ISO string; defaults to now.
   *                                 Pass a YYYY-MM-DD string when logging for a
   *                                 specific calendar date.
   */
  logBodyFat: async (percentage, measurements, gender, date = null) => {
    try {
      const API_BASE_URL = getServerUrl()

      // Resolve calculatedAt from the provided date or fall back to now
      let calculatedAt
      if (date) {
        // Accept both "YYYY-MM-DD" and a full ISO string
        calculatedAt = /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? `${date}T12:00:00`
          : date
      } else {
        calculatedAt = new Date().toISOString()
      }

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/bodyfat/log`,
        {
          method: "POST",
          body: JSON.stringify({
            percentage,
            measurements,
            gender,
            calculatedAt,
            method: "us_navy",
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to log body fat")
      }

      return data
    } catch (error) {
      console.error("Error logging body fat:", error)
      throw error
    }
  },

  /**
   * Get body fat history
   * GET /api/tracking/bodystats/bodyfat/log
   */
  getBodyFatHistory: async (limit = 90) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/bodyfat/log?limit=${limit}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get body fat history")
      }

      return data
    } catch (error) {
      console.error("Error getting body fat history:", error)
      throw error
    }
  },

  /**
   * Get latest body fat measurement
   * GET /api/tracking/bodystats/latest
   */
  getLatestBodyFat: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/latest`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get latest body fat")
      }

      return data
    } catch (error) {
      console.error("Error getting latest body fat:", error)
      throw error
    }
  },

  /**
   * Delete a body fat entry
   * DELETE /api/tracking/bodystats/bodyfat/log/:id
   */
  deleteBodyFatEntry: async (id) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/bodyfat/log/${id}`,
        {
          method: "DELETE",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete body fat entry")
      }

      return data
    } catch (error) {
      console.error("Error deleting body fat entry:", error)
      throw error
    }
  },

  /**
   * Get body fat trend analysis
   * GET /api/tracking/bodystats/trend
   */
  getBodyFatTrend: async (days = 90) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/tracking/bodystats/trend?days=${days}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get body fat trend")
      }

      return data
    } catch (error) {
      console.error("Error getting body fat trend:", error)
      throw error
    }
  },

  /**
   * Calculate body fat percentage (client-side helper)
   * Uses US Navy method
   */
  calculateBodyFatPercentage: (gender, height, waist, neck, hip = null) => {
    let bodyFatPercentage

    if (gender === "male") {
      bodyFatPercentage =
        495 /
          (1.0324 -
            0.19077 * Math.log10(waist - neck) +
            0.15456 * Math.log10(height)) -
        450
    } else {
      if (!hip) {
        throw new Error("Hip measurement required for female calculation")
      }
      bodyFatPercentage =
        495 /
          (1.29579 -
            0.35004 * Math.log10(waist + hip - neck) +
            0.221 * Math.log10(height)) -
        450
    }

    return parseFloat(bodyFatPercentage.toFixed(1))
  },
}
