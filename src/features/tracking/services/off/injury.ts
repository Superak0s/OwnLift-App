// features/tracking/services/off/injury.ts
//
// Injury tracking API - Offline mode (persisted to local storage)

import { createRecordStore } from "@shared/services/offlineHelpers";
import type {
  InjuryRecord,
  LogInjuryParams,
} from "../../types/muscleRecovery";
import type { ApiResponse } from "../types";

const STORAGE_KEY = "@off_injuries";

const store = createRecordStore<InjuryRecord>(
  "injuries",
  STORAGE_KEY,
  (e) => e.id,
  (e) => e.startDate,
);

let idCounter = Date.now();
function nextId(): number {
  return ++idCounter;
}

export const injuryApi = {
  logInjury: async (params: LogInjuryParams): Promise<ApiResponse<InjuryRecord>> => {
    const now = new Date().toISOString();
    const record: InjuryRecord = {
      id: nextId(),
      muscleGroup: params.muscleGroup,
      injuryType: params.injuryType,
      painLevel: params.painLevel,
      startDate: params.startDate,
      notes: params.notes || undefined,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await store.put(record);
    return { success: true, data: record };
  },

  getAllInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> => {
    const sorted = await store.getAll();
    return { success: true, data: sorted };
  },

  getInjuriesByMuscle: async (muscle: string): Promise<ApiResponse<InjuryRecord[]>> => {
    const entries = await store.getAll();
    const filtered = entries.filter((i) => i.muscleGroup === muscle);
    return { success: true, data: filtered };
  },

  getActiveInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> => {
    const entries = await store.getAll();
    const active = entries.filter((i) => i.status !== "recovered");
    return { success: true, data: active };
  },
};
