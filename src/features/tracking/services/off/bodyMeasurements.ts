import { createRecordStore } from "@shared/services/offlineHelpers"
import type { ApiResponse } from "../types"
import type { MeasurementEntry } from "../types"

const HISTORY_KEY = "@off_body_measurements"

const store = createRecordStore<MeasurementEntry>(
  "body_measurements",
  HISTORY_KEY,
  (e) => e.id,
  (e) => e.measuredAt,
)

let idCounter = Date.now()
function nextId(): number {
  return ++idCounter
}

export const bodyMeasurementsApi = {
  logMeasurement: async (
    waistCm?: number | null,
    armLeftCm?: number | null,
    armRightCm?: number | null,
    chestCm?: number | null,
    measuredAt?: string,
    note?: string,
  ): Promise<ApiResponse<MeasurementEntry>> => {
    const entry: MeasurementEntry = {
      id: nextId(),
      waistCm: waistCm || null,
      armLeftCm: armLeftCm || null,
      armRightCm: armRightCm || null,
      chestCm: chestCm || null,
      measuredAt: measuredAt || new Date().toISOString(),
      note: note || null,
      createdAt: new Date().toISOString(),
    }
    await store.put(entry)
    return { success: true, data: entry }
  },

  getMeasurementHistory: async (
    limit: number = 90,
  ): Promise<ApiResponse<MeasurementEntry[]>> => {
    const data = await store.getRecent(limit)
    return { success: true, data }
  },

  deleteMeasurementEntry: async (
    id: number,
  ): Promise<ApiResponse<null>> => {
    await store.remove(id)
    return { success: true, data: null }
  },
}
