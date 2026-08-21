import * as FileSystem from "expo-file-system/legacy"
import { generateId } from "@utils/format"
import { compressImageForUpload } from "@utils/compressImage"
import { createRecordStore } from "@shared/services/offlineHelpers"
import type {
  BodyFatMeasurements,
  Gender,
  WeightUnit,
} from "../../types"
import type {
  BodyFatEntry,
  ProgressPhoto,
  WeightHistoryResponse,
} from "@shared/types"

const WEIGHT_KEY = "@off_body_weight_history"
const BODYFAT_KEY = "@off_body_fat_history"
const PHOTOS_KEY = "@off_body_photos"
const PHOTOS_DIR = `${FileSystem.documentDirectory}progress-photos/`

const lbsToKg = (lbs: number): number => lbs * 0.453592


interface WeightRecord {
  id: string
  weight_kg: number
  note: string | null
  recorded_at: string
}

interface BodyFatRecord {
  id: string
  percentage: number
  measurements: BodyFatMeasurements
  gender: Gender
  calculated_at: string
  method: "us_navy"
}

interface PhotoRecord {
  id: string
  uri: string
  mime_type: string
  note: string | null
  taken_at: string
}

const weightStore = createRecordStore<WeightRecord>(
  "body_weight",
  WEIGHT_KEY,
  (r) => r.id,
  (r) => r.recorded_at,
)
const bodyFatStore = createRecordStore<BodyFatRecord>(
  "body_fat",
  BODYFAT_KEY,
  (r) => r.id,
  (r) => r.calculated_at,
)
const photosStore = createRecordStore<PhotoRecord>(
  "body_photos",
  PHOTOS_KEY,
  (r) => r.id,
  (r) => r.taken_at,
)


export const bodyTrackingApi = {
  logWeight: async (
    weight: number,
    unit: WeightUnit,
    note: string | null = null,
    recordedAt: string | null = null,
  ): Promise<unknown> => {
    try {
      const weightKg = unit === "lbs" ? lbsToKg(weight) : weight
      const entry: WeightRecord = {
        id: generateId(),
        weight_kg: weightKg,
        note,
        recorded_at: recordedAt || new Date().toISOString(),
      }
      await weightStore.put(entry)
      return { success: true, entry }
    } catch (error) {
      console.error("Error logging weight locally:", error)
      throw error
    }
  },

  getWeightHistory: async (
    limit: number = 90,
  ): Promise<WeightHistoryResponse> => {
    try {
      const entries = await weightStore.getRecent(limit)
      return { entries }
    } catch (error) {
      console.error("Error getting local weight history:", error)
      throw error
    }
  },

  deleteWeightEntry: async (id: number | string): Promise<unknown> => {
    try {
      await weightStore.remove(id)
      return { success: true }
    } catch (error) {
      console.error("Error deleting local weight entry:", error)
      throw error
    }
  },

  /**
   * Get current (most recent) weight. Shape matches services/on/bodyStats.tsx
   * (`{ entry?: { weight_kg } }`) so getCurrentBodyWeight below works
   * unmodified in either mode.
   */
  getCurrentWeight: async (): Promise<{ entry?: { weight_kg: number } }> => {
    try {
      const [latest] = await weightStore.getRecent(1)
      return latest ? { entry: { weight_kg: latest.weight_kg } } : {}
    } catch (error) {
      console.error("Error getting local current weight:", error)
      throw error
    }
  },


  /**
   * "Uploads" a progress photo by copying it into permanent app storage
   * (the localUri passed in is often a temp cache path from the image
   * picker, which the OS can clear).
   */
  uploadProgressPhoto: async (
    localUri: string,
    mimeType: string = "image/jpeg",
    note: string | null = null,
    date: string | null = null,
  ): Promise<unknown> => {
    try {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, {
        intermediates: true,
      }).catch(() => {
        // already exists — fine
      })

      const id = generateId()
      const extension = mimeType.includes("png") ? "png" : "jpg"
      const destUri = `${PHOTOS_DIR}${id}.${extension}`
      const compressedUri = await compressImageForUpload(localUri)
      await FileSystem.copyAsync({ from: compressedUri, to: destUri })

      const takenAt = date ? `${date}T12:00:00` : new Date().toISOString()
      const record: PhotoRecord = {
        id,
        uri: destUri,
        mime_type: mimeType,
        note,
        taken_at: takenAt,
      }
      await photosStore.put(record)
      return { success: true, photo: record }
    } catch (error) {
      console.error("Error saving local progress photo:", error)
      throw error
    }
  },

  /**
   * List progress photos (most recent first), mirrors on/bodyStats.tsx shape.
   */
  getProgressPhotos: async (
    limit: number = 200,
  ): Promise<{ photos: ProgressPhoto[] }> => {
    try {
      const photos = await photosStore.getRecent(limit)
      return { photos }
    } catch (error) {
      console.error("Error getting local progress photos:", error)
      throw error
    }
  },

  /**
   * Best-effort synchronous path — assumes .jpg, which is what
   * uploadProgressPhoto defaults to.
   */
  getPhotoUrl: (id: number | string): string => {
    return `${PHOTOS_DIR}${id}.jpg`
  },

  deleteProgressPhoto: async (id: number | string): Promise<unknown> => {
    try {
      const photo = await photosStore.getOne(id)
      if (photo) {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
          () => {
            // file already gone — fine
          },
        )
      }
      await photosStore.remove(id)
      return { success: true }
    } catch (error) {
      console.error("Error deleting local progress photo:", error)
      throw error
    }
  },
}

/**
 * Helper function to get current body weight in kg, reading straight from
 * local storage. Kept for interface parity with services/on/bodyStats.tsx
 * (which falls back to local SQLite storage on network failure — here it's just
 * always the local path).
 */
export const getCurrentBodyWeight = async (
  _userId?: string | null,
): Promise<number | null> => {
  try {
    const { entry } = await bodyTrackingApi.getCurrentWeight()
    return entry ? entry.weight_kg : null
  } catch {
    return null
  }
}

/**
 * Serverless Body Fat Tracking — US Navy Method
 */
export const bodyFatApi = {
  logBodyFat: async (
    percentage: number,
    measurements: BodyFatMeasurements,
    gender: Gender,
    date: string | null = null,
  ): Promise<unknown> => {
    try {
      let calculatedAt: string
      if (date) {
        calculatedAt = /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? `${date}T12:00:00`
          : date
      } else {
        calculatedAt = new Date().toISOString()
      }
      const record: BodyFatRecord = {
        id: generateId(),
        percentage,
        measurements,
        gender,
        calculated_at: calculatedAt,
        method: "us_navy",
      }
      await bodyFatStore.put(record)
      return { success: true, entry: record }
    } catch (error) {
      console.error("Error logging local body fat:", error)
      throw error
    }
  },

  getBodyFatHistory: async (
    limit: number = 90,
  ): Promise<{ entries: BodyFatEntry[] }> => {
    try {
      const entries = await bodyFatStore.getRecent(limit)
      return { entries }
    } catch (error) {
      console.error("Error getting local body fat history:", error)
      throw error
    }
  },

  deleteBodyFatEntry: async (id: number | string): Promise<unknown> => {
    try {
      await bodyFatStore.remove(id)
      return { success: true }
    } catch (error) {
      console.error("Error deleting local body fat entry:", error)
      throw error
    }
  },
}
