import * as DocumentPicker from "expo-document-picker"
import { getServerUrl } from "./config"
import { authenticatedFetch, authService } from "./auth"

export const workoutApi = {
  /**
   * Upload workout file and get all data
   */
  uploadWorkoutFile: async (fileUri) => {
    try {
      const API_BASE_URL = getServerUrl()
      console.log("Starting upload for file:", fileUri)

      const fileName = fileUri.split("/").pop()
      const fileType = fileName.split(".").pop().toLowerCase()

      const mimeTypes = {
        ods: "application/vnd.oasis.opendocument.spreadsheet",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
      }

      const mimeType = mimeTypes[fileType] || `application/${fileType}`

      const formData = new FormData()
      formData.append("workoutFile", {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      })

      const token = await authService.getToken()
      const headers = {
        "Content-Type": "multipart/form-data",
        ...(token && { Authorization: `Bearer ${token}` }),
      }

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error("Error uploading file:", error.message)
      throw error
    }
  },

  /**
   * Pick a file using the document picker
   */
  pickWorkoutFile: async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.oasis.opendocument.spreadsheet",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/octet-stream",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (result.canceled === true) return null

      if (result.assets && result.assets.length > 0) {
        return result.assets[0].uri
      }

      return result.uri || null
    } catch (error) {
      console.error("Error picking file:", error)
      throw error
    }
  },

  /**
   * Upload file and get specific person's weekly plan
   */
  getPersonWeeklyPlan: async (fileUri, personName) => {
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
      const headers = {
        "Content-Type": "multipart/form-data",
        ...(token && { Authorization: `Bearer ${token}` }),
      }

      const response = await fetch(
        `${API_BASE_URL}/upload/person/${encodeURIComponent(personName)}`,
        { method: "POST", body: formData, headers },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get person's plan")
      }

      return data
    } catch (error) {
      console.error("Error getting person plan:", error)
      throw error
    }
  },

  /**
   * Upload file and get specific day
   */
  getDayWorkout: async (fileUri, dayNumber) => {
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
      const headers = {
        "Content-Type": "multipart/form-data",
        ...(token && { Authorization: `Bearer ${token}` }),
      }

      const response = await fetch(`${API_BASE_URL}/upload/day/${dayNumber}`, {
        method: "POST",
        body: formData,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get day workout")
      }

      return data
    } catch (error) {
      console.error("Error getting day workout:", error)
      throw error
    }
  },

  /**
   * Health check
   */
  healthCheck: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await fetch(`${API_BASE_URL}/health`)
      return await response.json()
    } catch (error) {
      console.error("Error checking server health:", error)
      throw error
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a new workout session
   */
  startSession: async (
    person,
    dayNumber,
    dayTitle,
    muscleGroups,
    isDemo = false,
    startTime = null,
  ) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/start`,
        {
          method: "POST",
          body: JSON.stringify({
            person,
            dayNumber,
            dayTitle,
            muscleGroups,
            isDemo,
            startTime,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start session")
      }

      return data.session.id
    } catch (error) {
      console.error("Error starting session:", error)
      throw error
    }
  },

  /**
   * Record a set completion.
   *
   * @param {number}      sessionId
   * @param {string}      exerciseName  – Exercise name, e.g. "Barbell Back Squat"
   *                                     (replaces the old exerciseIndex number)
   * @param {number}      setIndex      – 0-based set position within the exercise
   * @param {string}      startTime     – ISO-8601
   * @param {string}      endTime       – ISO-8601
   * @param {number}      weight
   * @param {number}      reps
   * @param {string}      note          – optional
   * @param {boolean}     isWarmup      – optional
   * @param {string}      muscleGroup   – optional, used only on first insert of the exercise
   */
  recordSet: async (
    sessionId,
    exerciseName,
    setIndex,
    startTime,
    endTime,
    weight,
    reps,
    note = "",
    isWarmup = false,
    muscleGroup = null,
  ) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/${sessionId}/set`,
        {
          method: "POST",
          body: JSON.stringify({
            exerciseName,
            setIndex,
            startTime,
            endTime,
            weight,
            reps,
            note,
            isWarmup,
            muscleGroup,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to record set")
      }
      console.log(data.timing)
      return data.timing
    } catch (error) {
      console.error("Error recording set:", error)
      throw error
    }
  },

  /**
   * End a workout session
   */
  endSession: async (sessionId, endTime = null) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/${sessionId}/end`,
        {
          method: "POST",
          body: JSON.stringify({ endTime }), // ← add this
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to end session")
      }

      return data.session
    } catch (error) {
      console.error("Error ending session:", error)
      throw error
    }
  },

  /**
   * Get analytics (average rest time, set duration, etc.)
   */
  getAnalytics: async (person = null, dayNumber = null) => {
    const API_BASE_URL = getServerUrl()
    const params = new URLSearchParams()
    if (person) params.append("person", person)
    if (dayNumber) params.append("dayNumber", dayNumber.toString())

    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/analytics?${params.toString()}`,
      )

      const data = await response.json()

      if (response.ok) {
        return {
          averageTimeBetweenSets: data.analytics?.averageTimeBetweenSets || 120,
          totalSessions: data.analytics?.totalSessions || 0,
          totalSetsCompleted: data.analytics?.totalSetsCompleted || 0,
          totalVolume: data.analytics?.totalVolume || 0,
          averageRestTime: data.analytics?.averageRestTime || 0,
          averageSetDuration: data.analytics?.averageSetDuration || 0,
        }
      } else {
        throw new Error(data.error || "Failed to get analytics")
      }
    } catch (error) {
      if (error.message === "SESSION_EXPIRED") throw error

      console.error("[getAnalytics] Error:", error.message)

      return {
        averageTimeBetweenSets: 120,
        totalSessions: 0,
        totalSetsCompleted: 0,
        totalVolume: 0,
        averageRestTime: 0,
        averageSetDuration: 0,
      }
    }
  },

  /**
   * Get session history
   */
  getSessionHistory: async (
    person = null,
    dayNumber = null,
    limit = 10,
    includeTimings = false,
  ) => {
    try {
      const API_BASE_URL = getServerUrl()
      const params = new URLSearchParams()
      if (person) params.append("person", person)
      if (dayNumber) params.append("dayNumber", dayNumber.toString())
      if (limit) params.append("limit", limit.toString())
      if (includeTimings) params.append("includeTimings", "true")

      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions?${params.toString()}`,
      )
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Failed to get session history")
      return data.sessions
    } catch (error) {
      console.error("Error getting session history:", error)
      return []
    }
  },

  /**
   * Get specific session details.
   * Each set timing includes exercise_name and exercise_muscle_group.
   */
  getSession: async (sessionId) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/${sessionId}`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get session")
      }

      return data.session
    } catch (error) {
      console.error("Error getting session:", error)
      throw error
    }
  },

  /**
   * Clear all demo sessions
   */
  clearDemoSessions: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/demo`,
        { method: "DELETE" },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear demo sessions")
      }

      return data
    } catch (error) {
      console.error("Error clearing demo sessions:", error)
      throw error
    }
  },

  /**
   * Delete all sessions (requires confirmation)
   */
  deleteAllSessions: async () => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions`,
        {
          method: "DELETE",
          body: JSON.stringify({ confirmDelete: "DELETE_ALL_SESSIONS" }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete sessions")
      }

      return data
    } catch (error) {
      console.error("Error deleting sessions:", error)
      throw error
    }
  },

  /**
   * Delete all sessions for a specific person
   */
  deleteAllSessionsForPerson: async (person) => {
    try {
      const API_BASE_URL = getServerUrl()
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/sessions/person/${person}`,
        { method: "DELETE" },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete sessions")
      }

      console.log(`✓ Deleted ${data.deletedCount} sessions for ${person}`)
      return data
    } catch (error) {
      console.error("Error deleting sessions for person:", error)
      throw error
    }
  },
}
