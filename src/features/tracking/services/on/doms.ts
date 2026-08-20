// DOMS (Delayed Onset Muscle Soreness) tracking API - Online mode

import { apiCall } from "@shared/services/apiClient";
import type {
  ApiResponse,
  ActiveSoreness,
  SorenessFollowUp,
  DOMSStats,
  DOMSFollowUpItem,
  LogSorenessParams,
  UpdateSorenessParams,
} from "../../types/muscleRecovery";

export const domsApi = {
  /**
   * Log new soreness for a muscle group
   * Creates an ActiveSoreness record if one doesn't already exist for that muscle.
   * POST /api/tracking/doms/log
   */
  logSoreness: async (params: LogSorenessParams): Promise<ApiResponse<ActiveSoreness>> =>
    apiCall(`/api/tracking/doms/log`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getActiveSoreness: async (): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/active`),

  updateSoreness: async (params: UpdateSorenessParams): Promise<ApiResponse<ActiveSoreness>> =>
    apiCall(`/api/tracking/doms/${params.sorenessId}/followup`, {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  batchFollowUp: async (
    updates: Array<{ sorenessId: number; intensity: number; status: "still_sore" | "better" | "recovered"; notes?: string }>,
  ): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/batch-followup`, {
      method: "POST",
      body: JSON.stringify({ updates }),
    }),

  getHistoryByMuscle: async (muscle: string): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/history/${muscle}`),

  getStats: async (days: number = 30): Promise<ApiResponse<DOMSStats>> =>
    apiCall(`/api/tracking/doms/stats?days=${days}`),
};
