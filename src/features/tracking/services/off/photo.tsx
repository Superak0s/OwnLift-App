import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * OFFLINE Photo Calendar API
 *
 * ASSUMPTION (please verify against your services/off/bodyStats.tsx):
 * the actual photo files/URIs are stored and managed by
 * bodyTrackingApi.uploadProgressPhoto / getPhotoList / getPhotoUrl /
 * deleteProgressPhoto in off/bodyStats.tsx. This file assumes that data
 * lives under the AsyncStorage key below as an array of objects shaped
 * like StoredPhoto, and only adds calendar-style querying (range /
 * grouped / compare) on top of it.
 *
 * I don't have off/bodyStats.tsx's contents, so if it uses a different
 * key or a different shape (e.g. keyed by date, or storing files via
 * expo-file-system instead of a single AsyncStorage array), update
 * PHOTOS_KEY / StoredPhoto / loadPhotos here to match it exactly —
 * otherwise this file will just see an empty list.
 */

const PHOTOS_KEY = "@offline_progress_photos"

interface StoredPhoto {
  id: string
  uri: string
  takenAt: string // ISO date or full ISO timestamp, e.g. "2026-07-11" or "2026-07-11T10:03:00.000Z"
  note?: string
}

const loadPhotos = async (): Promise<StoredPhoto[]> => {
  try {
    const raw = await AsyncStorage.getItem(PHOTOS_KEY)
    return raw ? (JSON.parse(raw) as StoredPhoto[]) : []
  } catch (error) {
    console.error("Error loading offline photos:", error)
    return []
  }
}

const dateOnly = (value: string): string => value.split("T")[0]

export const photoApi = {
  getPhotosInRange: async (
    startDate: Date,
    endDate: Date,
  ): Promise<unknown> => {
    try {
      const start = startDate.toISOString().split("T")[0]
      const end = endDate.toISOString().split("T")[0]
      const photos = await loadPhotos()
      const inRange = photos.filter((photo) => {
        const d = dateOnly(photo.takenAt)
        return d >= start && d <= end
      })
      return { photos: inRange }
    } catch (error) {
      console.error("Error getting photos in range (offline):", error)
      throw error
    }
  },

  getPhotosGroupedByDate: async (days: number = 90): Promise<unknown> => {
    try {
      const photos = await loadPhotos()
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const recent = photos.filter(
        (photo) => new Date(photo.takenAt).getTime() >= cutoff,
      )

      const grouped: Record<string, StoredPhoto[]> = {}
      for (const photo of recent) {
        const day = dateOnly(photo.takenAt)
        if (!grouped[day]) grouped[day] = []
        grouped[day].push(photo)
      }

      return { grouped }
    } catch (error) {
      console.error("Error getting grouped photos (offline):", error)
      throw error
    }
  },

  comparePhotos: async (date1: Date, date2: Date): Promise<unknown> => {
    try {
      const d1 = date1.toISOString().split("T")[0]
      const d2 = date2.toISOString().split("T")[0]
      const photos = await loadPhotos()

      const photosForDate = (target: string) =>
        photos.filter((photo) => dateOnly(photo.takenAt) === target)

      return {
        date1: d1,
        date2: d2,
        photos1: photosForDate(d1),
        photos2: photosForDate(d2),
      }
    } catch (error) {
      console.error("Error comparing photos (offline):", error)
      throw error
    }
  },
}
