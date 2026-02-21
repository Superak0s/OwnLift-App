import { getServerUrl } from "./config"
import { authenticatedFetch, authService } from "./auth"

/**
 * Workout Program API
 * Stores the user's parsed workout program on the server so it survives
 * app reinstalls. Uses /api/program endpoints.
 */
export const programApi = {
  /**
   * Upload a workout file and save it server-side for this user.
   * Replaces workoutApi.uploadWorkoutFile – call this instead so the
   * program is persisted automatically.
   * POST /api/program/upload
   */
  uploadAndSave: async (fileUri) => {
    try {
      const API_BASE_URL = getServerUrl()
      const fileName = fileUri.split("/").pop()
      const fileType = fileName.split(".").pop().toLowerCase()

      const mimeTypes = {
        ods: "application/vnd.oasis.opendocument.spreadsheet",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
      }

      const formData = new FormData()
      formData.append("workoutFile", {
        uri: fileUri,
        name: fileName,
        type: mimeTypes[fileType] || `application/${fileType}`,
      })

      const token = await authService.getToken()
      const response = await fetch(`${API_BASE_URL}/api/program/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || `Server error: ${response.status}`)
      return data
    } catch (error) {
      console.error("Error uploading program:", error)
      throw error
    }
  },

  /**
   * Fetch the user's saved program from the server.
   * Call this on login / app start to restore their workout data.
   * GET /api/program
   * Returns null if no program saved yet.
   */
  fetchSavedProgram: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(`${API_BASE_URL}/api/program`)

      if (response.status === 404) return null // no program saved yet – that's fine

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch program")
      return data // shape: { success, totalDays, people, days, originalFilename, uploadedAt }
    } catch (error) {
      if (error.message === "SESSION_EXPIRED") throw error
      console.warn("Could not fetch saved program:", error.message)
      return null
    }
  },

  /**
   * Delete the user's saved program.
   * DELETE /api/program
   */
  deleteProgram: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/program`,
        { method: "DELETE" },
      )
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
    dayNumber,
    person,
    exerciseIndex,
    newName,
    newMuscleGroup = undefined,
  ) => {
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
      // Non-fatal: local state already updated; log and continue
      console.warn(
        "programApi.renameExercise failed (will retry on next sync):",
        error.message,
      )
      return null
    }
  },

  /**
   * Add a brand-new exercise to the saved server program.
   * PATCH /api/program/exercise/add
   */
  addExercise: async (dayNumber, person, exercise) => {
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
        error.message,
      )
      return null
    }
  },

  /**
   * Update (increase) the set count of an exercise in the saved server program.
   * PATCH /api/program/exercise/sets
   */
  patchExerciseSets: async (
    dayNumber,
    person,
    exerciseIndex,
    additionalSets,
  ) => {
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
        error.message,
      )
      return null
    }
  },
}
