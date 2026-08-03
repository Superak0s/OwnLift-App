// features/tracking/services/on/doms.ts
//
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

  /**
   * Get all active (non-recovered) soreness records
   * GET /api/tracking/doms/active
   */
  getActiveSoreness: async (): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/active`),

  /**
   * Update soreness status via follow-up
   * PUT /api/tracking/doms/:id/followup
   */
  updateSoreness: async (params: UpdateSorenessParams): Promise<ApiResponse<ActiveSoreness>> =>
    apiCall(`/api/tracking/doms/${params.sorenessId}/followup`, {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  /**
   * Batch update multiple soreness records (for DOMS follow-up)
   * POST /api/tracking/doms/batch-followup
   */
  batchFollowUp: async (
    updates: Array<{ sorenessId: number; intensity: number; status: "still_sore" | "better" | "recovered"; notes?: string }>,
  ): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/batch-followup`, {
      method: "POST",
      body: JSON.stringify({ updates }),
    }),

  /**
   * Get DOMS history for a specific muscle group
   * GET /api/tracking/doms/history/:muscle
   */
  getHistoryByMuscle: async (muscle: string): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/history/${muscle}`),

  /**
   * Get DOMS statistics and heatmap data
   * GET /api/tracking/doms/stats?days=N
   */
  getStats: async (days: number = 30): Promise<ApiResponse<DOMSStats>> =>
    apiCall(`/api/tracking/doms/stats?days=${days}`),

  /**
   * Get soreness map (muscle -> current intensity)
   * GET /api/tracking/doms/map
   */
  getSorenessMap: async (): Promise<ApiResponse<Record<string, number>>> =>
    apiCall(`/api/tracking/doms/map`),

  /**
   * Get soreness records for a specific date range (for heatmap/timeline)
   * GET /api/tracking/doms/range?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  getRange: async (startDate: string, endDate: string): Promise<ApiResponse<ActiveSoreness[]>> =>
    apiCall(`/api/tracking/doms/range?start=${startDate}&end=${endDate}`),
};
