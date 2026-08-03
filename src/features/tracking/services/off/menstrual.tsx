import type { FlowIntensity } from "../types";

/**
 * Menstrual API - Offline Mode
 * Returns mock data for offline testing
 */

export const menstrualApi = {
  logMenstrualCycle: async (): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry>> => {
    const now = new Date().toISOString()
    return {
      success: true,
      data: {
        id: Date.now(),
        cycleStart: now,
        cycleEnd: null,
        durationDays: null,
        flowIntensity: "moderate",
        symptoms: null,
        createdAt: now,
        updatedAt: now,
      },
    }
  },

  endMenstrualCycle: async (): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry>> => {
    const now = new Date().toISOString()
    return {
      success: true,
      data: {
        id: Date.now(),
        cycleStart: now,
        cycleEnd: now,
        durationDays: 5,
        flowIntensity: "moderate",
        symptoms: null,
        createdAt: now,
        updatedAt: now,
      },
    }
  },

  getMenstrualHistory: async (): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          cycleStart: new Date(Date.now() - 2592000000).toISOString(),
          cycleEnd: new Date(Date.now() - 2592000000 + 432000000).toISOString(),
          durationDays: 28,
          flowIntensity: "moderate",
          symptoms: ["cramping", "bloating"],
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
          updatedAt: new Date(Date.now() - 2592000000 + 432000000).toISOString(),
        },
      ],
    }
  },

  getLastMenstrualCycle: async (): Promise<import("../types").ApiResponse<import("../types").MenstrualEntry | null>> => {
    return {
      success: true,
      data: {
        id: 1,
        cycleStart: new Date(Date.now() - 259200000).toISOString(),
        cycleEnd: null,
        durationDays: null,
        flowIntensity: "moderate",
        symptoms: ["cramping"],
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
      },
    }
  },

  getCycleStats: async (): Promise<import("../types").ApiResponse<import("../types").CycleStats>> => {
    return {
      success: true,
      data: {
        currentPhase: {
          phase: "follicular",
          daysInPhase: 7,
          estimatedEnd: new Date(Date.now() + 432000000).toISOString(),
        },
        averageCycleLength: 28,
        nextPeriodEstimate: new Date(Date.now() + 1814400000).toISOString(),
        lastCycleEntry: {
          id: 1,
          cycleStart: new Date(Date.now() - 259200000).toISOString(),
          cycleEnd: null,
          durationDays: null,
          flowIntensity: "moderate",
          symptoms: ["cramping"],
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          updatedAt: new Date(Date.now() - 259200000).toISOString(),
        },
      },
    }
  },

  deleteMenstrualEntry: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },

  getSettings: async (): Promise<import("../types").ApiResponse<{
    periodDays: number
    cycleLengthDays: number
  }>> => {
    return {
      success: true,
      data: { periodDays: 5, cycleLengthDays: 28 },
    }
  },

  setSettings: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },

  setDayFlow: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },

  getDayFlow: async (): Promise<import("../types").ApiResponse<{ date: string; intensity: import("../types").FlowIntensity } | null>> => {
    return {
      success: true,
      data: { date: new Date().toISOString().split('T')[0], intensity: "moderate" },
    }
  },

  deleteDayFlow: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },
}

