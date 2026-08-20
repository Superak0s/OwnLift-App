import { apiCall } from "@shared/services/apiClient"
import type { FlowIntensity } from "../types"

export const menstrualApi = {
  logMenstrualCycle: async (
    cycleStart: Date | string,
    flowIntensity: FlowIntensity = "moderate",
    symptoms?: string[],
  ): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry>> => {
    const startStr = cycleStart instanceof Date ? cycleStart.toISOString() : cycleStart
    return apiCall(`/api/tracking/menstrual`, {
      method: "POST",
      body: JSON.stringify({
        cycleStart: startStr,
        flowIntensity,
        symptoms: symptoms || null,
      }),
    })
  },

  getMenstrualHistory: async (limit: number = 12): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry[]>> =>
    apiCall(`/api/tracking/menstrual?limit=${limit}`),

  getCycleStats: async (_settingsOverride?: {
    periodDays: number
    cycleLengthDays: number
  }): Promise<import("../types").ApiResponse<import("../types").CycleStats>> =>
    apiCall(`/api/tracking/menstrual/stats`),

  deleteMenstrualEntry: async (id: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/menstrual/${id}`, { method: "DELETE" }),

  getSettings: async (): Promise<import("../types").ApiResponse<{
    periodDays: number
    cycleLengthDays: number
  }>> =>
    apiCall(`/api/tracking/menstrual/settings`),

  setSettings: async (periodDays?: number, cycleLengthDays?: number): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/menstrual/settings`, {
      method: "POST",
      body: JSON.stringify({ periodDays, cycleLengthDays }),
    }),

  setDayFlow: async (date: string, intensity: import("../types").FlowIntensity = "moderate", note?: string): Promise<import("../types").ApiResponse<null>> =>
    apiCall(`/api/tracking/menstrual/day-flow`, {
      method: "POST",
      body: JSON.stringify({ date, intensity, note: note || null }),
    }),

  getDayFlow: async (date: string): Promise<import("../types").ApiResponse<{ date: string; intensity: import("../types").FlowIntensity } | null>> =>
    apiCall(`/api/tracking/menstrual/day-flow?date=${encodeURIComponent(date)}`),
}

