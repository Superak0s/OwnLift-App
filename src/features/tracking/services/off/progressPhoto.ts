import * as FileSystem from "expo-file-system/legacy"
import { generateId } from "@utils/format"
import { compressImageForUpload } from "@utils/compressImage"
import { createRecordStore } from "@shared/services/offlineHelpers"
import type {
  ProgressPhotoMuscle,
  LogProgressPhotoParams,
} from "../../types/muscleRecovery"
import type { ApiResponse } from "../types"

const PHOTOS_KEY = "@off_progress_photos_muscle"
const PHOTOS_DIR = `${FileSystem.documentDirectory}progress-photos/`

const store = createRecordStore<ProgressPhotoMuscle>(
  "progress_photos_muscle",
  PHOTOS_KEY,
  (p) => p.id,
  (p) => p.takenAt ?? "",
)

export const progressPhotoApi = {
  uploadPhoto: async (params: LogProgressPhotoParams): Promise<ApiResponse<ProgressPhotoMuscle>> => {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true }).catch(() => {
      // already exists — fine
    })

    const id = generateId()
    const extension = params.uri.toLowerCase().endsWith(".png") ? "png" : "jpg"
    const destUri = `${PHOTOS_DIR}${id}.${extension}`
    const compressedUri = await compressImageForUpload(params.uri)
    await FileSystem.copyAsync({ from: compressedUri, to: destUri })

    const photo: ProgressPhotoMuscle = {
      id,
      takenAt: params.takenAt || new Date().toISOString(),
      uri: destUri,
      muscleGroups: params.muscleGroups,
      notes: params.notes || undefined,
      angle: params.angle || "custom",
      customSideName: params.customSideName || undefined,
    }
    await store.put(photo)
    return { success: true, data: photo }
  },

  getAllPhotos: async (limit: number = 100): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const data = await store.getRecent(limit)
    return { success: true, data }
  },

  getPhotosByMuscle: async (muscle: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const photos = await store.getAll()
    const filtered = photos.filter((p) => p.muscleGroups?.includes(muscle as any))
    return { success: true, data: filtered }
  },

  getPhotosInRange: async (start: string, end: string): Promise<ApiResponse<ProgressPhotoMuscle[]>> => {
    const photos = await store.getSince(start)
    const filtered = photos.filter((p) => {
      const d = (p.takenAt ?? "").slice(0, 10)
      return d <= end
    })
    return { success: true, data: filtered }
  },

  deletePhoto: async (id: string | number): Promise<ApiResponse<null>> => {
    const photo = await store.getOne(id)
    if (photo?.uri) {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {
        // file already gone — fine
      })
    }
    await store.remove(id)
    return { success: true, data: null }
  },
}
