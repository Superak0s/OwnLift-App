import { apiCall } from "@shared/services/apiClient"
import { getServerUrl } from "@shared/services/config"
import { tokenStorage } from "@shared/services/tokenStorage"
import { getStorageItem } from "@shared/services/sqliteStorage"
import { compressImageForUpload } from "@utils/compressImage"
import type {
  BodyFatMeasurements,
  Gender,
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
    const compressedUri = await compressImageForUpload(localUri)

    const formData = new FormData()
    formData.append("photo", {
      uri: compressedUri,
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
   * List progress photos (metadata only, not image bytes)
   * GET /api/tracking/photos
   */
  getProgressPhotos: async (limit: number = 200): Promise<unknown> =>
    apiCall(`/api/tracking/photos?limit=${limit}`),

  /**
   * Get photo URL for rendering in <Image>
   */
  getPhotoUrl: (id: number | string): string => {
    const API_BASE_URL = getServerUrl()
    return `${API_BASE_URL}/api/tracking/photos/${id}`
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
 * Falls back to local SQLite storage if the server call fails.
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
    const saved = await getStorageItem(key)
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
   * Delete a body fat entry
   * DELETE /api/tracking/bodystats/bodyfat/log/:id
   */
  deleteBodyFatEntry: async (id: number | string): Promise<unknown> =>
    apiCall(`/api/tracking/bodystats/bodyfat/log/${id}`, { method: "DELETE" }),
}
