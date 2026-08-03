/**
 * Soreness API - Offline Mode
 * Returns mock data for offline testing
 */
export const sorenessApi = {
  logSoreness: async (): Promise<import("../types").ApiResponse<{ id: number }>> => {
    return { success: true, data: { id: Date.now() } }
  },

  getSorenessHistory: async (): Promise<import("../types").ApiResponse<import("../types").SorenessEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          muscleGroup: "chest",
          intensity: 7,
          loggedAt: new Date(Date.now() - 3600000).toISOString(),
          note: "Post workout",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    }
  },

  getSorenessForDate: async (): Promise<import("../types").ApiResponse<import("../types").SorenessEntry[]>> => {
    return {
      success: true,
      data: [
        {
          id: 1,
          muscleGroup: "chest",
          intensity: 7,
          loggedAt: new Date().toISOString(),
          note: null,
          createdAt: new Date().toISOString(),
        },
      ],
    }
  },

  getSorenessMap: async (): Promise<import("../types").ApiResponse<Record<string, any>>> => {
    return {
      success: true,
      data: {
        date: new Date().toISOString(),
        entries: {
          chest: 7,
          back: 5,
          legs: 8,
          arms: 4,
        },
      },
    }
  },

  getSorenessMapForDate: async (): Promise<import("../types").ApiResponse<Record<string, any>>> => {
    return {
      success: true,
      data: {
        date: new Date().toISOString(),
        entries: {
          chest: 6,
          back: 4,
        },
      },
    }
  },

  getSorenessStats: async (): Promise<import("../types").ApiResponse<Record<string, any>>> => {
    return {
      success: true,
      data: {
        mostSoreMuscle: { muscle: "legs", intensity: 8 },
        averageIntensity: 6.2,
        affectedMuscles: 6,
        lastEntry: {
          id: 1,
          muscleGroup: "legs",
          intensity: 8,
          loggedAt: new Date().toISOString(),
          note: null,
          createdAt: new Date().toISOString(),
        },
      },
    }
  },

  getValidMuscleGroups: async (): Promise<import("../types").ApiResponse<string[]>> => {
    return {
      success: true,
      data: [
        "chest",
        "back",
        "legs",
        "quads",
        "hamstrings",
        "glutes",
        "arms",
        "biceps",
        "triceps",
        "forearms",
        "shoulders",
        "delts",
        "abs",
        "core",
        "calves",
        "lower_back",
        "neck",
        "traps",
      ],
    }
  },

  deleteSorenessEntry: async (): Promise<import("../types").ApiResponse<null>> => {
    return { success: true, data: null }
  },
}

