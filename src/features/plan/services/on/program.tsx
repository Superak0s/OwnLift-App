import { apiCall, parseApiResponse } from "@shared/services/apiClient"
import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import { parseWorkoutFileClient } from "../../../../utils/clientWorkoutParser"
import type { SavedProgram, ExercisePayload } from "../../types"
import type { WorkoutData } from "@shared/types"
import { migrateLegacyProgram } from "@utils/legacyProgram"

export const programApi = {
  uploadAndSave: async (fileUri: string): Promise<unknown> => {
    const originalFilename = fileUri.split("/").pop() ?? "workout"
    const weeklyPlan = await parseWorkoutFileClient(fileUri)
    return apiCall(`/api/program/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyPlan, originalFilename }),
    })
  },

  saveProgram: async (program: WorkoutData): Promise<unknown> =>
    apiCall(`/api/program/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyPlan: program,
        originalFilename: "template-update",
      }),
    }),

  /**
   * Fetch the user's saved program from the server.
   * GET /api/program
   * Returns null if no program saved yet.
   */
  fetchSavedProgram: async (): Promise<SavedProgram | null> => {
    try {
      const response = await authenticatedFetch(`/api/program`)
      if (response.status === 404) return null
      return migrateLegacyProgram(await parseApiResponse(response))
    } catch (error) {
      if ((error as Error).message === "SESSION_EXPIRED") throw error
      console.warn("Could not fetch saved program:", (error as Error).message)
      return null
    }
  },

  deleteProgram: async (): Promise<unknown> =>
    apiCall(`/api/program`, { method: "DELETE" }),

  renameExercise: async (
    dayNumber: number,
    split: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ): Promise<unknown> =>
    apiCall(`/api/program/exercise/rename`, {
      method: "PATCH",
      body: JSON.stringify({
        dayNumber,
        split,
        exerciseIndex,
        newName,
        ...(newMuscleGroup !== undefined && { newMuscleGroup }),
      }),
    }),

  addExercise: async (
    dayNumber: number,
    split: string,
    exercise: ExercisePayload,
  ): Promise<unknown> =>
    apiCall(`/api/program/exercise/add`, {
      method: "PATCH",
      body: JSON.stringify({ dayNumber, split, exercise }),
    }),

  patchExerciseSets: async (
    dayNumber: number,
    split: string,
    exerciseIndex: number,
    additionalSets: number,
  ): Promise<unknown> =>
    apiCall(`/api/program/exercise/sets`, {
      method: "PATCH",
      body: JSON.stringify({
        dayNumber,
        split,
        exerciseIndex,
        additionalSets,
      }),
    }),
}
