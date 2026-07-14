// features/tracking/services/off/bodyStats.tsx

import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
import type {
  BodyFatMeasurements,
  Gender,
  HeightInput,
  HeightUnit,
  WeightUnit,
} from "../../types"

/**
 * Serverless Body Tracking
 * ────────────────────────
 * Drop-in replacement for services/on/bodyStats.tsx — same exported
 * names, same function signatures, same field naming (snake_case in
 * returned payloads) so screens don't need to know which mode is active.
 *
 * NOTE ON SHAPES: the "on" version's response shapes (fetchTrackingSnapshot,
 * getWeightHistory, getHeightAndUnits, getBodyFatHistory/Trend, getPhotoList)
 * are defined by your server and I don't have that source, only the calls
 * made against it. I've mirrored the parts that are visible from the client
 * (e.g. `{ entry: { weight_kg } }` from getCurrentWeight, `weightKg` /
 * `heightCm` / `heightUnit` / `weightUnit` field names from what's sent to
 * the server). Anywhere I had to guess a list-wrapper key or a trend
 * calculation, it's flagged below — check it against what your screens
 * actually destructure and adjust the key names if they don't match.
 */
const WEIGHT_KEY = "@off_body_weight_history"
const HEIGHT_KEY = "@off_body_height_units"
const BODYFAT_KEY = "@off_body_fat_history"
const PHOTOS_KEY = "@off_body_photos"
const PHOTOS_DIR = `${FileSystem.documentDirectory}progress-photos/`

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch (error) {
    console.error(`Error reading ${key}:`, error)
    return []
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list))
}

const lbsToKg = (lbs: number): number => lbs * 0.453592

// ── Internal record shapes (stored on-device) ────────────────────────────

interface WeightRecord {
  id: string
  weight_kg: number
  note: string | null
  recorded_at: string
}

interface HeightRecord {
  height_cm: number
  height_unit: HeightUnit
  weight_unit: WeightUnit
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

// ── Body Weight ────────────────────────────────────────────────────────────

export const bodyTrackingApi = {
  /**
   * Bundles everything this module has into one object, mirroring the
   * shape of GET /api/body/snapshot as closely as possible from the
   * client-visible field names. Adjust the top-level keys if your screens
   * expect something different.
   */
  fetchTrackingSnapshot: async (): Promise<unknown> => {
    try {
      const [weights, height, bodyFat, photos] = await Promise.all([
        readList<WeightRecord>(WEIGHT_KEY),
        AsyncStorage.getItem(HEIGHT_KEY),
        readList<BodyFatRecord>(BODYFAT_KEY),
        readList<PhotoRecord>(PHOTOS_KEY),
      ])
      const sortedWeights = [...weights].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      )
      const sortedBodyFat = [...bodyFat].sort(
        (a, b) =>
          new Date(b.calculated_at).getTime() -
          new Date(a.calculated_at).getTime(),
      )
      return {
        currentWeight: sortedWeights[0] || null,
        weightHistory: sortedWeights,
        heightAndUnits: height ? JSON.parse(height) : null,
        latestBodyFat: sortedBodyFat[0] || null,
        bodyFatHistory: sortedBodyFat,
        photos,
      }
    } catch (error) {
      console.error("Error building local tracking snapshot:", error)
      throw error
    }
  },

  /**
   * Log a weight entry locally.
   */
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
      const history = await readList<WeightRecord>(WEIGHT_KEY)
      history.push(entry)
      await writeList(WEIGHT_KEY, history)
      return { success: true, entry }
    } catch (error) {
      console.error("Error logging weight locally:", error)
      throw error
    }
  },

  /**
   * Get weight history, most recent first.
   */
  getWeightHistory: async (limit: number = 90): Promise<unknown> => {
    try {
      const history = await readList<WeightRecord>(WEIGHT_KEY)
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      )
      return { entries: sorted.slice(0, limit) }
    } catch (error) {
      console.error("Error getting local weight history:", error)
      throw error
    }
  },

  /**
   * Delete a weight entry by id.
   */
  deleteWeightEntry: async (id: number | string): Promise<unknown> => {
    try {
      const history = await readList<WeightRecord>(WEIGHT_KEY)
      const filtered = history.filter((entry) => entry.id !== String(id))
      await writeList(WEIGHT_KEY, filtered)
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
      const history = await readList<WeightRecord>(WEIGHT_KEY)
      if (!history.length) return {}
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      )
      return { entry: { weight_kg: sorted[0].weight_kg } }
    } catch (error) {
      console.error("Error getting local current weight:", error)
      throw error
    }
  },

  // ── Height & Unit Preferences ─────────────────────────────────────────────

  saveHeightAndUnits: async (
    height: HeightInput,
    weightUnit: WeightUnit,
  ): Promise<unknown> => {
    try {
      let heightCm: number
      if (height.unit === "cm") {
        heightCm = height.value
      } else {
        const totalInches = height.value * 12 + (height.inches || 0)
        heightCm = totalInches * 2.54
      }
      const record: HeightRecord = {
        height_cm: heightCm,
        height_unit: height.unit,
        weight_unit: weightUnit,
      }
      await AsyncStorage.setItem(HEIGHT_KEY, JSON.stringify(record))
      return { success: true, ...record }
    } catch (error) {
      console.error("Error saving local height and units:", error)
      throw error
    }
  },

  getHeightAndUnits: async (): Promise<unknown> => {
    try {
      const raw = await AsyncStorage.getItem(HEIGHT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (error) {
      console.error("Error getting local height and units:", error)
      throw error
    }
  },

  // ── Progress Photos ───────────────────────────────────────────────────────

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
      await FileSystem.copyAsync({ from: localUri, to: destUri })

      const takenAt = date ? `${date}T12:00:00` : new Date().toISOString()
      const record: PhotoRecord = {
        id,
        uri: destUri,
        mime_type: mimeType,
        note,
        taken_at: takenAt,
      }
      const photos = await readList<PhotoRecord>(PHOTOS_KEY)
      photos.push(record)
      await writeList(PHOTOS_KEY, photos)
      return { success: true, photo: record }
    } catch (error) {
      console.error("Error saving local progress photo:", error)
      throw error
    }
  },

  getPhotoList: async (limit: number = 50): Promise<unknown> => {
    try {
      const photos = await readList<PhotoRecord>(PHOTOS_KEY)
      const sorted = [...photos].sort(
        (a, b) =>
          new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime(),
      )
      return { photos: sorted.slice(0, limit) }
    } catch (error) {
      console.error("Error getting local photo list:", error)
      throw error
    }
  },

  /**
   * In "on" mode this builds a server URL; in "off" mode the photo is
   * already a local file, so this just looks up its on-device path.
   * NOTE: this is now effectively async-backed data returned sync — since
   * we can't await inside a sync function, this returns a `file://` guess
   * based on id only if you keep the same directory/extension convention.
   * Prefer `fetchPhotoAsUri` (below) in "off" mode, which reads the real
   * stored path and is safe to call from an async context.
   */
  getPhotoUrl: (id: number | string): string => {
    // Best-effort synchronous path — assumes .jpg, which is what
    // uploadProgressPhoto defaults to. Use fetchPhotoAsUri for a
    // guaranteed-correct path/extension.
    return `${PHOTOS_DIR}${id}.jpg`
  },

  /**
   * Returns the actual on-device file URI for a photo (RN's <Image> can
   * render `file://` URIs directly — no base64 conversion needed offline).
   */
  fetchPhotoAsUri: async (id: number | string): Promise<string> => {
    try {
      const photos = await readList<PhotoRecord>(PHOTOS_KEY)
      const photo = photos.find((p) => p.id === String(id))
      if (!photo) throw new Error("Photo not found")
      return photo.uri
    } catch (error) {
      console.error("Error reading local photo uri:", error)
      throw error
    }
  },

  deleteProgressPhoto: async (id: number | string): Promise<unknown> => {
    try {
      const photos = await readList<PhotoRecord>(PHOTOS_KEY)
      const photo = photos.find((p) => p.id === String(id))
      if (photo) {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
          () => {
            // file already gone — fine
          },
        )
      }
      const filtered = photos.filter((p) => p.id !== String(id))
      await writeList(PHOTOS_KEY, filtered)
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
 * (which falls back to AsyncStorage on network failure — here it's just
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
      const history = await readList<BodyFatRecord>(BODYFAT_KEY)
      history.push(record)
      await writeList(BODYFAT_KEY, history)
      return { success: true, entry: record }
    } catch (error) {
      console.error("Error logging local body fat:", error)
      throw error
    }
  },

  getBodyFatHistory: async (limit: number = 90): Promise<unknown> => {
    try {
      const history = await readList<BodyFatRecord>(BODYFAT_KEY)
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.calculated_at).getTime() -
          new Date(a.calculated_at).getTime(),
      )
      return { entries: sorted.slice(0, limit) }
    } catch (error) {
      console.error("Error getting local body fat history:", error)
      throw error
    }
  },

  getLatestBodyFat: async (): Promise<unknown> => {
    try {
      const history = await readList<BodyFatRecord>(BODYFAT_KEY)
      if (!history.length) return {}
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.calculated_at).getTime() -
          new Date(a.calculated_at).getTime(),
      )
      return { entry: sorted[0] }
    } catch (error) {
      console.error("Error getting local latest body fat:", error)
      throw error
    }
  },

  deleteBodyFatEntry: async (id: number | string): Promise<unknown> => {
    try {
      const history = await readList<BodyFatRecord>(BODYFAT_KEY)
      const filtered = history.filter((entry) => entry.id !== String(id))
      await writeList(BODYFAT_KEY, filtered)
      return { success: true }
    } catch (error) {
      console.error("Error deleting local body fat entry:", error)
      throw error
    }
  },

  /**
   * Simple locally-computed trend: first-vs-last percentage and average
   * change per week over the requested window. Your server's actual
   * /trend endpoint may compute something more elaborate — treat this as
   * a starting point and adjust to match whatever your trend screen reads.
   */
  getBodyFatTrend: async (days: number = 90): Promise<unknown> => {
    try {
      const history = await readList<BodyFatRecord>(BODYFAT_KEY)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const inWindow = history
        .filter((entry) => new Date(entry.calculated_at).getTime() >= cutoff)
        .sort(
          (a, b) =>
            new Date(a.calculated_at).getTime() -
            new Date(b.calculated_at).getTime(),
        )

      if (inWindow.length < 2) {
        return { entries: inWindow, change: null, changePerWeek: null }
      }

      const first = inWindow[0]
      const last = inWindow[inWindow.length - 1]
      const change = parseFloat((last.percentage - first.percentage).toFixed(1))
      const spanDays = Math.max(
        1,
        (new Date(last.calculated_at).getTime() -
          new Date(first.calculated_at).getTime()) /
          (24 * 60 * 60 * 1000),
      )
      const changePerWeek = parseFloat(((change / spanDays) * 7).toFixed(2))

      return { entries: inWindow, change, changePerWeek }
    } catch (error) {
      console.error("Error computing local body fat trend:", error)
      throw error
    }
  },

  /**
   * Pure math, identical to services/on/bodyStats.tsx — no server
   * involved either way, so this is copied over unchanged.
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
