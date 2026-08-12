// features/tracking/services/on/injury.ts
//
// Injury tracking API - Online mode

import { apiCall } from "@shared/services/apiClient";
import type {
  ApiResponse,
  InjuryRecord,
  LogInjuryParams,
} from "../../types/muscleRecovery";

export const injuryApi = {
  /**
   * Log a new injury
   * POST /api/tracking/injuries
   */
  logInjury: async (params: LogInjuryParams): Promise<ApiResponse<InjuryRecord>> =>
    apiCall(`/api/tracking/injuries`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * Get all injuries (chronological order, newest first)
   * GET /api/tracking/injuries
   */
  getAllInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> =>
    apiCall(`/api/tracking/injuries`),

  /**
   * Get injuries for a specific muscle group
   * GET /api/tracking/injuries/muscle/:muscle
   */
  getInjuriesByMuscle: async (muscle: string): Promise<ApiResponse<InjuryRecord[]>> =>
    apiCall(`/api/tracking/injuries/muscle/${muscle}`),

  /**
   * Get active (non-recovered) injuries
   * GET /api/tracking/injuries/active
   */
  getActiveInjuries: async (): Promise<ApiResponse<InjuryRecord[]>> =>
    apiCall(`/api/tracking/injuries/active`),
};
