/**
 * Body Measurements API - Offline Mode
 * Returns mock data for offline testing
 */
export const bodyMeasurementsApi = {
  logMeasurement: async (): Promise<unknown> => {
    return { success: true, id: Date.now() }
  },

  getMeasurementHistory: async (): Promise<import("../types").ApiResponse<import("../types").MeasurementEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          waistCm: 85,
          armLeftCm: 32,
          armRightCm: 33,
          chestCm: 100,
          measuredAt: new Date(Date.now() - 604800000).toISOString(),
          note: null,
          createdAt: new Date(Date.now() - 604800000).toISOString(),
        },
        {
          id: 2,
          waistCm: 84,
          armLeftCm: 32.5,
          armRightCm: 33.5,
          chestCm: 101,
          measuredAt: new Date().toISOString(),
          note: "Good pump",
          createdAt: new Date().toISOString(),
        },
      ],
    }
  },

  getLatestMeasurement: async (): Promise<unknown> => {
    return {
      success: true,
      data: {
        id: 2,
        waistCm: 84,
        armLeftCm: 32.5,
        armRightCm: 33.5,
        chestCm: 101,
        measuredAt: new Date().toISOString(),
        note: "Good pump",
        createdAt: new Date().toISOString(),
      },
    }
  },

  getMeasurementStats: async (): Promise<unknown> => {
    return {
      success: true,
      data: {
        current: {
          id: 2,
          waistCm: 84,
          armLeftCm: 32.5,
          armRightCm: 33.5,
          chestCm: 101,
          measuredAt: new Date().toISOString(),
          note: "Good pump",
          createdAt: new Date().toISOString(),
        },
        minWaist: 83,
        maxWaist: 85,
        minChest: 99,
        maxChest: 101,
        minArmLeft: 31,
        maxArmLeft: 32.5,
        entryCount: 10,
      },
    }
  },

  deleteMeasurementEntry: async (): Promise<unknown> => {
    return { success: true }
  },
}

