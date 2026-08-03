// features/tracking/services/off/doms.ts
//
// DOMS tracking API - Offline mode (mock data)

import type {
  ApiResponse,
  ActiveSoreness,
  DOMSStats,
  LogSorenessParams,
  UpdateSorenessParams,
} from "../../types/muscleRecovery";

let localIdCounter = 100;

const mockActiveSoreness: ActiveSoreness[] = [
  {
    id: 1,
    muscleGroup: "chest_upper",
    intensity: 7,
    notes: "After bench press session",
    loggedAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    status: "active",
    followUps: [],
  },
  {
    id: 2,
    muscleGroup: "quads",
    intensity: 5,
    notes: "Leg day yesterday",
    loggedAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    status: "active",
    followUps: [],
  },
  {
    id: 3,
    muscleGroup: "biceps",
    intensity: 3,
    loggedAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    status: "recovering",
    recoveredAt: new Date().toISOString(),
    followUps: [
      {
        id: 1,
        sorenessId: 3,
        intensity: 3,
        status: "better",
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  },
];

export const domsApi = {
  logSoreness: async (params: LogSorenessParams): Promise<ApiResponse<ActiveSoreness>> => {
    const entry: ActiveSoreness = {
      id: ++localIdCounter,
      muscleGroup: params.muscleGroup,
      intensity: params.intensity,
      notes: params.notes || undefined,
      loggedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
      followUps: [],
    };
    return { success: true, data: entry };
  },

  getActiveSoreness: async (): Promise<ApiResponse<ActiveSoreness[]>> => {
    return { success: true, data: mockActiveSoreness };
  },

  updateSoreness: async (params: UpdateSorenessParams): Promise<ApiResponse<ActiveSoreness>> => {
    const entry: ActiveSoreness = {
      ...mockActiveSoreness[0]!,
      intensity: params.intensity,
      status: params.status === "recovered" ? "recovered" : params.status === "better" ? "recovering" : "active",
      updatedAt: new Date().toISOString(),
      recoveredAt: params.status === "recovered" ? new Date().toISOString() : undefined,
    };
    return { success: true, data: entry };
  },

  batchFollowUp: async (_updates: Array<{ sorenessId: number; intensity: number; status: "still_sore" | "better" | "recovered"; notes?: string }>): Promise<ApiResponse<ActiveSoreness[]>> => {
    return { success: true, data: mockActiveSoreness };
  },

  getHistoryByMuscle: async (muscle: string): Promise<ApiResponse<ActiveSoreness[]>> => {
    const filtered = mockActiveSoreness.filter((s) => s.muscleGroup === muscle);
    return { success: true, data: filtered };
  },

  getStats: async (_days: number = 30): Promise<ApiResponse<DOMSStats>> => {
    return {
      success: true,
      data: {
        totalActiveSoreness: 2,
        totalRecoveryEpisodes: 5,
        averageRecoveryDays: 2.5,
        mostSoreMuscle: "quads",
        muscleRecoveryStats: [
          {
            muscleGroup: "chest_upper",
            totalEpisodes: 8,
            averageRecoveryDays: 2.3,
            maxRecoveryDays: 4,
            averageSeverity: 6.5,
            lastSorenessDate: new Date().toISOString(),
            isCurrentlySore: true,
            currentIntensity: 7,
          },
          {
            muscleGroup: "quads",
            totalEpisodes: 12,
            averageRecoveryDays: 3.1,
            maxRecoveryDays: 5,
            averageSeverity: 7.2,
            lastSorenessDate: new Date().toISOString(),
            isCurrentlySore: true,
            currentIntensity: 5,
          },
          {
            muscleGroup: "biceps",
            totalEpisodes: 4,
            averageRecoveryDays: 1.8,
            maxRecoveryDays: 3,
            averageSeverity: 4.0,
            lastSorenessDate: new Date(Date.now() - 172800000).toISOString(),
            isCurrentlySore: false,
          },
        ],
        severityTrend: [],
        heatmapData: {
          chest_upper: 8,
          chest_lower: 3,
          back_upper: 5,
          back_lower: 2,
          lats: 4,
          traps: 3,
          neck: 1,
          shoulders_front: 6,
          shoulders_side: 4,
          shoulders_rear: 2,
          biceps: 4,
          triceps: 5,
          forearms: 2,
          abs_upper: 3,
          abs_lower: 2,
          obliques: 1,
          lower_back: 3,
          glutes: 7,
          quads: 12,
          hamstrings: 6,
          calves: 3,
          adductors: 2,
          abductors: 1,
          hip_flexors: 2,
        },
      },
    };
  },

  getSorenessMap: async (): Promise<ApiResponse<Record<string, number>>> => {
    const map: Record<string, number> = {};
    mockActiveSoreness.forEach((s) => {
      if (s.status !== "recovered") {
        map[s.muscleGroup] = s.intensity;
      }
    });
    return { success: true, data: map };
  },

  getRange: async (_start: string, _end: string): Promise<ApiResponse<ActiveSoreness[]>> => {
    return { success: true, data: mockActiveSoreness };
  },
};
