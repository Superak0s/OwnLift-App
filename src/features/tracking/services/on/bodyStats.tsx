import { apiCall } from "@shared/services/apiClient"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type {
  BodyFatMeasurements,
  Gender,
  HeightInput,
  WeightUnit,
} from "../../types"

/**
 * Body Tracking API - Weight, Height, Progress Photos
 *
 * Imports fixed as part of the feature-based refactor:
 *  - getServerUrl now comes from @shared/services/on/config (was a
 *    relative "./config" import into a flat services/ folder).
 *  - authenticatedFetch now comes from @shared/services/authenticatedFetch
 *    (moved out of features/auth — see that feature's notes).
 *  - authService.getToken() calls replaced with tokenStorage.get(),
 *    since importing authService here would be a feature-to-feature
 *    import (tracking → auth), which breaks the shared → features → app
 *    rule. tokenStorage is the shared piece both auth and tracking are
 *    meant to use for raw token reads.
 */
export const bodyTrackingApi = {
  /**
   * Fetch all tracking data in a single request
   * GET /api/body/snapshot
   */
  fetchTrackingSnapshot: async (): Promise<unknown> =>
    apiCall(`/api/body/snapshot`),

  // ── Body Weight ───────────────────────────────────────────────────────────

  /**
   * Log a weight entry
   * POST /api/tracking/bodystats/weight
   */
  logWeight: async (
    weight: number,
    unit: WeightUnit,
    note: string | null = null,
    recordedAt: string | null = null,
  ): Promise<unknown> => {
    const weightKg = unit === "lbs" ? weight * 0.453592 : weight
    return apiCall(`/api/tracking/bodystats/weight`, {
      method: "POST",
      body: JSON.stringify({
        weightKg,
        recordedAt: recordedAt || new Date().toISOString(),
        note,
      }),
    })
  },

  /**
   * Get weight history
   * GET /api/tracking/bodystats/weight
   */
  getWeightHistory: async (limit: number = 90): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/weight?limit=${limit}`),

  /**
   * Delete a weight entry
   * DELETE /api/tracking/bodystats/weight/:id
   */
  deleteWeightEntry: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/weight/${id}`, { method: "DELETE" }),

  /**
   * Get current weight
   * GET /api/tracking/bodystats/weight/current
   */
  getCurrentWeight: async (): Promise<{ entry?: { weight_kg: number } }> =>
    apiCall(`/api/tracking/bodystats/weight/current`),

  // ── Height & Unit Preferences ─────────────────────────────────────────────

  /**
   * Save height and unit preferences
   * PUT /api/tracking/bodystats/height
   */
  saveHeightAndUnits: async (
    height: HeightInput,
    weightUnit: WeightUnit,
  ): Promise<unknown> => {
    let heightCm: number
    if (height.unit === "cm") {
      heightCm = height.value
    } else {
      const totalInches = height.value * 12 + (height.inches || 0)
      heightCm = totalInches * 2.54
    }
    return apiCall(`/api/tracking/bodystats/height`, {
      method: "PUT",
      body: JSON.stringify({
        heightCm,
        heightUnit: height.unit,
        weightUnit,
      }),
    })
  },

  /**
   * Get height and unit preferences
   * GET /api/tracking/bodystats/height
   */
  getHeightAndUnits: async (): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/height`),

  // ── Progress Photos ───────────────────────────────────────────────────────

  /**
   * Upload a progress photo — uses raw fetch for FormData (multipart/form-data)
   * POST /api/tracking/photos
   */
  uploadProgressPhoto: async (
    localUri: string,
    mimeType: string = "image/jpeg",
    note: string | null = null,
    date: string | null = null,
  ): Promise<unknown> => {
    const API_BASE_URL = getServerUrl()
    const token = await tokenStorage.get()

    const formData = new FormData()
    formData.append("photo", {
      uri: localUri,
      name: `photo_${Date.now()}.jpg`,
      type: mimeType,
    } as unknown as Blob)

    const takenAt = date ? `${date}T12:00:00` : new Date().toISOString()
    formData.append("takenAt", takenAt)
    if (note) formData.append("note", note)

    const response = await fetch(`${API_BASE_URL}/api/tracking/photos`, {
      method: "POST",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Photo upload failed")
    return data
  },

  /**
   * Get photo metadata list
   * GET /api/tracking/photos
   */
  getPhotoList: async (limit: number = 50): Promise<unknown> =>
    apiCall(`/api/tracking/photos?limit=${limit}`),

  /**
   * Get photo URL for rendering in <Image>
   */
  getPhotoUrl: (id: number | string): string => {
    const API_BASE_URL = getServerUrl()
    return `${API_BASE_URL}/api/tracking/photos/${id}`
  },

  /**
   * Fetch a photo as a base64 data URI for React Native <Image>
   */
  fetchPhotoAsUri: async (id: number | string): Promise<string> => {
    const API_BASE_URL = getServerUrl()
    const token = await tokenStorage.get()

    const response = await fetch(`${API_BASE_URL}/api/tracking/photos/${id}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    })

    if (!response.ok) throw new Error("Photo not found")

    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  },

  /**
   * Delete a progress photo
   * DELETE /api/tracking/photos/:id
   */
  deleteProgressPhoto: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/photos/${id}`, { method: "DELETE" }),
}

/**
 * Helper function to get current body weight in kg.
 * Falls back to AsyncStorage if the server call fails.
 */
export const getCurrentBodyWeight = async (
  userId?: string | null,
): Promise<number | null> => {
  try {
    const { entry } = await bodyTrackingApi.getCurrentWeight()
    if (entry) return entry.weight_kg
  } catch (err) {
    console.warn(
      "Failed to get current weight from server:",
      (err as Error).message,
    )
  }
  try {
    const key = userId ? `weightHistory_user_${userId}` : "weightHistory"
    const saved = await AsyncStorage.getItem(key)
    if (!saved) return null
    const history: Array<{ date: string; weight: number; unit: WeightUnit }> =
      JSON.parse(saved)
    if (!history.length) return null
    const sorted = [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    const latest = sorted[0]
    return latest.unit === "lbs" ? latest.weight * 0.453592 : latest.weight
  } catch {
    return null
  }
}

/**
 * Body Fat Tracking API — US Navy Method
 */
export const bodyFatApi = {
  /**
   * Log a body fat percentage calculation
   * POST /api/tracking/bodystats/bodyfat/log
   */
  logBodyFat: async (
    percentage: number,
    measurements: BodyFatMeasurements,
    gender: Gender,
    date: string | null = null,
  ): Promise<unknown> => {
    let calculatedAt: string
    if (date) {
      calculatedAt = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${date}T12:00:00`
        : date
    } else {
      calculatedAt = new Date().toISOString()
    }
    return apiCall(`/api/tracking/bodystats/bodyfat/log`, {
      method: "POST",
      body: JSON.stringify({
        percentage,
        measurements,
        gender,
        calculatedAt,
        method: "us_navy",
      }),
    })
  },

  /**
   * Get body fat history
   * GET /api/tracking/bodystats/bodyfat/log
   */
  getBodyFatHistory: async (limit: number = 90): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/bodyfat/log?limit=${limit}`),

  /**
   * Get latest body fat measurement
   * GET /api/tracking/bodystats/latest
   */
  getLatestBodyFat: async (): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/latest`),

  /**
   * Delete a body fat entry
   * DELETE /api/tracking/bodystats/bodyfat/log/:id
   */
  deleteBodyFatEntry: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/bodyfat/log/${id}`, { method: "DELETE" }),

  /**
   * Get body fat trend analysis
   * GET /api/tracking/bodystats/trend
   */
  getBodyFatTrend: async (days: number = 90): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/trend?days=${days}`),

  /**
   * Calculate body fat percentage client-side (US Navy method).
   * All measurements in the same unit (cm or inches).
   */
  calculateBodyFatPercentage: (
    gender: Gender,
    height: number,
    waist: number,
    neck: number,
    hip: number | null = null,
  ): number => {
    let bodyFatPercentage: number

    if (gender === "male") {
      bodyFatPercentage =
        495 /
          (1.0324 -
            0.19077 * Math.log10(waist - neck) +
            0.15456 * Math.log10(height)) -
        450
    } else {
      if (!hip)
        throw new Error("Hip measurement required for female calculation")
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
