import { apiCall } from "@shared/services/apiClient"

export const hydrationApi = {
  logHydration: async (amountMl: number, note?: string): Promise<import("../types").ApiResponse<{ id: number }>> =>
    apiCall(`/api/tracking/hydration`, {
      method: "POST",
      body: JSON.stringify({
        amountMl,
        loggedAt: new Date().toISOString(),
        note: note || null,
      }),
    }),

  getHydrationHistory: async (limit: number = 100): Promise<import("../types").ApiResponse<import("../types").HydrationEntry[]>> =>
    apiCall(`/api/tracking/hydration?limit=${limit}`),

  deleteHydrationEntry: async (id: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/hydration/${id}`, { method: "DELETE" }),

  getSettings: async (): Promise<import("../types").ApiResponse<{ goalMl: number; measurementErrorPercent: number }>> =>
    apiCall(`/api/tracking/hydration/settings`),

  setSettings: async (goalMl?: number, measurementErrorPercent?: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/hydration/settings`, {
      method: "POST",
      body: JSON.stringify({ goalMl, measurementErrorPercent }),
    }),
};
