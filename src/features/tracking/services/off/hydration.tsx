/**
 * Hydration API - Offline Mode
 * Returns mock data for offline testing
 */
export const hydrationApi = {
  logHydration: async (): Promise<import("../types").ApiResponse<{ id: number }>> => {
    return { success: true, data: { id: Date.now() } }
  },

  getHydrationHistory: async (): Promise<import("../types").ApiResponse<import("../types").HydrationEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          amountMl: 500,
          loggedAt: new Date(Date.now() - 3600000).toISOString(),
          note: null,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 2,
          amountMl: 400,
          loggedAt: new Date(Date.now() - 7200000).toISOString(),
          note: "After workout",
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    }
  },

  getDailyHydration: async (): Promise<import("../types").ApiResponse<import("../types").HydrationEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          amountMl: 500,
          loggedAt: new Date().toISOString(),
          note: null,
          createdAt: new Date().toISOString(),
        },
      ],
    }
  },

  getHydrationStats: async (): Promise<import("../types").ApiResponse<import("../types").HydrationStats>> => {
    return {
      success: true,
      data: {
        totalToday: 900,
        totalThisWeek: 6300,
        totalThisMonth: 28000,
        averageDaily: 900,
        entryCount: 3,
        lastEntry: {
          id: 1,
          amountMl: 500,
          loggedAt: new Date().toISOString(),
          note: null,
          createdAt: new Date().toISOString(),
        },
      },
    }
  },

  deleteHydrationEntry: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },

  getSettings: async (): Promise<import("../types").ApiResponse<{ goalMl: number; measurementErrorPercent: number }>> => {
    return {
      success: true,
      data: { goalMl: 2000, measurementErrorPercent: 5 },
    }
  },

  setSettings: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },
}

