// features/tracking/services/off/injury.ts
//
// Injury tracking API - Offline mode (mock data)

import type {
  ApiResponse,
  InjuryRecord,
  LogInjuryParams,
  UpdateInjuryParams,
} from "../../types/muscleRecovery";

const mockInjuries: InjuryRecord[] = [
  {
    id: 1,
    muscleGroup: "shoulders_front",
    injuryType: "strain",
    painLevel: 6,
    startDate: new Date(Date.now() - 604800000).toISOString(),
    notes: "Mild strain from overhead press, feeling better each day",
    status: "recovering",
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    muscleGroup: "lower_back",
    injuryType: "overuse",
    painLevel: 3,
    startDate: new Date(Date.now() - 2592000000).toISOString(),
    recoveryDate: new Date(Date.now() - 86400000).toISOString(),
    notes: "Tightness from heavy deadlifts, resolved with rest and stretching",
    status: "recovered",
    createdAt: new Date(Date.now() - 2592000000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 3,
    muscleGroup: "hamstrings",
    injuryType: "tear",
    painLevel: 8,
    startDate: new Date(Date.now() - 15552000000).toISOString(),
    recoveryDate: new Date(Date.now() - 2592000000).toISOString(),
    notes: "Grade 1 hamstring tear during sprinting, took 4 weeks to recover",
    status: "recovered",
    createdAt: new Date(Date.now() - 15552000000).toISOString(),
    updatedAt: new Date(Date.now() - 2592000000).toISOString(),
  },
];

let localIdCounter = 100;

export const injuryApi = {
  logInjury: async (params: LogInjuryParams): Promise<ApiResponse<InjuryRecord>> => {
    const record: InjuryRecord = {
      id: ++localIdCounter,
      muscleGroup: params.muscleGroup,
      injuryType: params.injuryType,
      painLevel: params.painLevel,
      startDate: params.startDate,
      notes: params.notes || undefined,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: record };
  },

  updateInjury: async (params: UpdateInjuryParams): Promise<ApiResponse<InjuryRecord>> => {
    return {
      success: true,
      data: {
        ...mockInjuries[0]!,
        ...params,
        updatedAt: new Date().toISOString(),
      } as InjuryRecord,
    };
  },

  getAllInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> => {
    return { success: true, data: mockInjuries };
  },

  getInjuriesByMuscle: async (muscle: string): Promise<ApiResponse<InjuryRecord[]>> => {
    const filtered = mockInjuries.filter((i) => i.muscleGroup === muscle);
    return { success: true, data: filtered };
  },

  getActiveInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> => {
    const active = mockInjuries.filter((i) => i.status !== "recovered");
    return { success: true, data: active };
  },

  deleteInjury: async (_id: number): Promise<ApiResponse<null>> => {
    return { success: true, data: null };
  },
};
