import { getServerUrl } from "@shared/services/config"
import { authenticatedFetch } from "@shared/services/authenticatedFetch"
import { parseWorkoutFileClient } from "../../../../utils/clientWorkoutParser"
import type { SavedProgram, ExercisePayload } from "../../types"
import type { WorkoutData } from "@shared/types"

export const programApi = {
  uploadAndSave: async (fileUri: string): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const originalFilename = fileUri.split("/").pop() ?? "workout"

      const weeklyPlan = await parseWorkoutFileClient(fileUri)

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weeklyPlan, originalFilename }),
        },
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || `Server error: ${response.status}`)
      return data
    } catch (error) {
      console.error("Error uploading program:", error)
      throw error
    }
  },

  saveProgram: async (program: WorkoutData): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weeklyPlan: program,
            originalFilename: "template-update",
          }),
        },
      )

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || `Server error: ${response.status}`)
      return data
    } catch (error) {
      console.error("Error saving program:", error)
      throw error
    }
  },

  /**
   * Fetch the user's saved program from the server.
   * GET /api/program
   * Returns null if no program saved yet.
   */
  fetchSavedProgram: async (): Promise<SavedProgram | null> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(`${API_BASE_URL}/api/program`)

      if (response.status === 404) return null

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch program")
      return data as SavedProgram
    } catch (error) {
      if ((error as Error).message === "SESSION_EXPIRED") throw error
      console.warn("Could not fetch saved program:", (error as Error).message)
      return null
    }
  },

  /**
   * Delete the user's saved program.
   * DELETE /api/program
   */
  deleteProgram: async (): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(`${API_BASE_URL}/api/program`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to delete program")
      return data
    } catch (error) {
      console.error("Error deleting program:", error)
      throw error
    }
  },

  /**
   * Rename an exercise in the saved server program.
   * PATCH /api/program/exercise/rename
   */
  renameExercise: async (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    newName: string,
    newMuscleGroup?: string,
  ): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program/exercise/rename`,
        {
          method: "PATCH",
          body: JSON.stringify({
            dayNumber,
            person,
            exerciseIndex,
            newName,
            ...(newMuscleGroup !== undefined && { newMuscleGroup }),
          }),
        },
      )
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to rename exercise")
      return data
    } catch (error) {
      console.warn(
        "programApi.renameExercise failed (will retry on next sync):",
        (error as Error).message,
      )
      return null
    }
  },

  /**
   * Add a brand-new exercise to the saved server program.
   * PATCH /api/program/exercise/add
   */
  addExercise: async (
    dayNumber: number,
    person: string,
    exercise: ExercisePayload,
  ): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program/exercise/add`,
        {
          method: "PATCH",
          body: JSON.stringify({ dayNumber, person, exercise }),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to add exercise")
      return data
    } catch (error) {
      console.warn(
        "programApi.addExercise failed (will retry on next sync):",
        (error as Error).message,
      )
      return null
    }
  },

  /**
   * Update (increase) the set count of an exercise.
   * PATCH /api/program/exercise/sets
   */
  patchExerciseSets: async (
    dayNumber: number,
    person: string,
    exerciseIndex: number,
    additionalSets: number,
  ): Promise<unknown> => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program/exercise/sets`,
        {
          method: "PATCH",
          body: JSON.stringify({
            dayNumber,
            person,
            exerciseIndex,
            additionalSets,
          }),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update sets")
      return data
    } catch (error) {
      console.warn(
        "programApi.patchExerciseSets failed (will retry on next sync):",
        (error as Error).message,
      )
      return null
    }
  },
}
