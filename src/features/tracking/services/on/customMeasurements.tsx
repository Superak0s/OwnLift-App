import { apiCall } from "@shared/services/apiClient"

export const customMeasurementsApi = {
  createType: async (keyName: string, label: string, unit?: string) =>
    apiCall(`/api/tracking/custom-measurements/types`, {
      method: "POST",
      body: JSON.stringify({ keyName, label, unit }),
    }),

  listTypes: async () =>
    apiCall(`/api/tracking/custom-measurements/types`),

  deleteType: async (id: number) =>
    apiCall(`/api/tracking/custom-measurements/types/${id}`, {
      method: "DELETE",
    }),

  logValue: async (typeId: number, value: number, measuredAt?: string, note?: string) =>
    apiCall(`/api/tracking/custom-measurements/values`, {
      method: "POST",
      body: JSON.stringify({ typeId, value, measuredAt: measuredAt || null, note: note || null }),
    }),

  getValuesForDate: async (date: string) =>
    apiCall(`/api/tracking/custom-measurements/values/${date}`),

  getValuesForType: async (typeId: number, limit = 90) =>
    apiCall(`/api/tracking/custom-measurements/values/type/${typeId}?limit=${limit}`),
}
